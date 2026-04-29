/**
 * Sample Turf Profile Modal — b35fix368 (slim version)
 * ============================================================================
 * Per-sample turf override editor. Surfaces only when the active site has
 * GAIP_SiteConfig.isMultiSiteTurfEnabled === true.
 *
 * b35fix368 simplification: TWO fields only — species + companion.
 *   - Turf type dropped: council multi-site is always sports
 *   - Sub-category dropped: sports has no sub-categories
 *   - Variety dropped: council operators don't track per-cultivar
 *
 * Sports species list: Couch, Kikuyu, Perennial Ryegrass, Kentucky Bluegrass,
 * Tall Fescue. NO Seashore Paspalum (no AU paspalum sports grounds — paspalum's
 * placement is golf greens or coastal lawns, not sports fields).
 *
 * Saves to sample.turfProfile via GAIP_SampleManager.setSampleTurfProfile.
 * Only stores fields that differ from site-level (delta), so changes to the
 * site-level species cascade to non-overriding samples.
 *
 * Public API:
 *   GaipSampleTurfProfileModal.open(dataType, sampleId, onSave)
 *   GaipSampleTurfProfileModal.close()
 */
(function (global) {
    'use strict';

    var VERSION = '2.0.0';   // 2.x = b35fix368 slim
    var _modal = null;
    var _state = {
        dataType: null,
        sampleId: null,
        onSave: null,
        species: null,
        companionSpecies: null,
        siteLevel: {}
    };

    // =========================================================================
    // PURE HELPERS
    // =========================================================================

    function _getSportsSpeciesOptions() {
        var hardcoded = [
            { value: 'Couch',                label: 'Couch (Bermudagrass)',  type: 'C4' },
            { value: 'Kikuyu',               label: 'Kikuyu',                 type: 'C4' },
            { value: 'Perennial Ryegrass',   label: 'Perennial Ryegrass',     type: 'C3' },
            { value: 'Kentucky Bluegrass',   label: 'Kentucky Bluegrass',     type: 'C3' },
            { value: 'Tall Fescue',          label: 'Tall Fescue',            type: 'C3' }
        ];
        var tp = global.GaipTurfProfile;
        if (!tp || !tp.speciesByType || !tp.speciesByType.sports) return hardcoded;
        var sports = tp.speciesByType.sports;
        var combined = (sports.c4 || []).concat(sports.c3 || []).filter(function (s) {
            return (s.value || '').toLowerCase().indexOf('paspalum') === -1;
        });
        var hardNames = hardcoded.map(function (h) { return h.value; });
        var combinedNames = combined.map(function (c) { return c.value; });
        var allPresent = hardNames.every(function (n) { return combinedNames.indexOf(n) !== -1; });
        return allPresent ? combined : hardcoded;
    }

    function _captureSiteLevel() {
        var tp = global.GaipTurfProfile;
        var s = (tp && tp.state) ? tp.state : {};
        return {
            species:          s.species || null,
            companionSpecies: s.overseedSpecies || null
        };
    }

    function _computeDelta(working, siteLevel) {
        var delta = {};
        if (working.species && working.species !== siteLevel.species) {
            delta.species = working.species;
        }
        if (working.companionSpecies && working.companionSpecies !== siteLevel.companionSpecies) {
            delta.companionSpecies = working.companionSpecies;
        }
        return Object.keys(delta).length > 0 ? delta : null;
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function _ensureModal() {
        if (_modal) return _modal;

        var overlay = document.createElement('div');
        overlay.className = 'gaip-sample-turf-modal-overlay';
        overlay.style.cssText =
            'position:fixed;inset:0;background:rgba(0,0,0,0.55);' +
            'display:none;align-items:center;justify-content:center;z-index:99999;';

        var dialog = document.createElement('div');
        dialog.className = 'gaip-sample-turf-modal';
        dialog.style.cssText =
            'background:var(--gaip-surface,#1a2332);color:var(--gaip-text,#e5e7eb);' +
            'border:1px solid var(--gaip-border,#374151);border-radius:8px;' +
            'padding:20px;max-width:480px;width:92%;max-height:90vh;overflow:auto;' +
            'box-shadow:0 20px 60px rgba(0,0,0,0.5);font-size:13px;';

        dialog.innerHTML =
            '<div style="font-weight:600;font-size:15px;margin-bottom:4px;">' +
                '🌱 Per-Sample Turf Profile' +
            '</div>' +
            '<div class="gaip-stp-sample-label" style="font-size:12px;color:var(--gaip-text-secondary,#9ca3af);margin-bottom:14px;"></div>' +

            '<div style="background:var(--gaip-info-bg,rgba(59,130,246,0.1));padding:8px 10px;border-radius:4px;font-size:11px;margin-bottom:14px;line-height:1.5;">' +
                'Override the site-level turf identity for this sample. Leave a ' +
                'field as <em>(no change)</em> to inherit from the site.' +
            '</div>' +

            '<div class="gaip-stp-row" style="margin-bottom:10px;">' +
                '<label style="display:block;font-size:11px;font-weight:600;margin-bottom:4px;">Species</label>' +
                '<select class="gaip-stp-species" style="width:100%;padding:6px;background:var(--gaip-input-bg,#0f172a);color:inherit;border:1px solid var(--gaip-border,#374151);border-radius:4px;"></select>' +
            '</div>' +

            '<div class="gaip-stp-row" style="margin-bottom:14px;">' +
                '<label style="display:block;font-size:11px;font-weight:600;margin-bottom:4px;">Companion / overseed species</label>' +
                '<input type="text" class="gaip-stp-companion" placeholder="e.g. Perennial Ryegrass — leave blank for none" style="width:100%;padding:6px;background:var(--gaip-input-bg,#0f172a);color:inherit;border:1px solid var(--gaip-border,#374151);border-radius:4px;box-sizing:border-box;">' +
            '</div>' +

            '<div class="gaip-stp-current-override" style="font-size:11px;color:var(--gaip-text-secondary,#9ca3af);margin-bottom:14px;padding:8px;border-left:3px solid var(--gaip-border,#374151);background:var(--gaip-surface-muted,#0f172a);"></div>' +

            '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">' +
                '<button type="button" class="gaip-stp-clear" style="padding:7px 14px;background:transparent;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer;font-size:12px;">Clear override</button>' +
                '<button type="button" class="gaip-stp-cancel" style="padding:7px 14px;background:var(--gaip-surface-muted,#0f172a);color:inherit;border:1px solid var(--gaip-border,#374151);border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>' +
                '<button type="button" class="gaip-stp-save" style="padding:7px 14px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Save override</button>' +
            '</div>';

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        var speciesSel  = dialog.querySelector('.gaip-stp-species');
        var companionInp = dialog.querySelector('.gaip-stp-companion');

        // Populate species dropdown once — sports list is static
        speciesSel.innerHTML = '<option value="">(no change — inherit from site)</option>';
        var opts = _getSportsSpeciesOptions();
        for (var i = 0; i < opts.length; i++) {
            var o = opts[i];
            var opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label + ' (' + o.type + ')';
            speciesSel.appendChild(opt);
        }

        speciesSel.addEventListener('change', function () {
            _state.species = this.value || null;
        });
        companionInp.addEventListener('input', function () {
            _state.companionSpecies = this.value.trim() || null;
        });

        dialog.querySelector('.gaip-stp-cancel').addEventListener('click', close);
        dialog.querySelector('.gaip-stp-clear').addEventListener('click', function () {
            try {
                global.GAIP_SampleManager.setSampleTurfProfile(_state.dataType, _state.sampleId, null);
                if (_state.onSave) _state.onSave(null);
                close();
            } catch (e) {
                alert('Clear failed: ' + e.message);
            }
        });
        dialog.querySelector('.gaip-stp-save').addEventListener('click', function () {
            var working = {
                species:          _state.species,
                companionSpecies: _state.companionSpecies
            };
            var delta = _computeDelta(working, _state.siteLevel);
            try {
                global.GAIP_SampleManager.setSampleTurfProfile(_state.dataType, _state.sampleId, delta);
                if (_state.onSave) _state.onSave(delta);
                close();
            } catch (e) {
                alert('Save failed: ' + e.message);
            }
        });

        _modal = {
            overlay: overlay,
            dialog: dialog,
            speciesSel: speciesSel,
            companionInp: companionInp
        };
        return _modal;
    }

    function open(dataType, sampleId, onSave) {
        _ensureModal();
        var SM = global.GAIP_SampleManager;
        if (!SM) { console.warn('[SampleTurfModal] GAIP_SampleManager not available'); return; }

        var sample = (SM.getSamples ? SM.getSamples(dataType) : []).find(function (s) {
            return s.id === sampleId;
        });
        var existing = SM.getSampleTurfProfile ? SM.getSampleTurfProfile(dataType, sampleId) : null;

        _state.dataType = dataType;
        _state.sampleId = sampleId;
        _state.onSave   = onSave || null;
        _state.siteLevel = _captureSiteLevel();
        _state.species          = (existing && existing.species)          || null;
        _state.companionSpecies = (existing && existing.companionSpecies) || null;

        var label = sample ? (sample.label || sample.id) : sampleId;
        _modal.dialog.querySelector('.gaip-stp-sample-label').textContent = 'Sample: ' + label;

        _modal.speciesSel.value   = _state.species || '';
        _modal.companionInp.value = _state.companionSpecies || '';

        var ovEl = _modal.dialog.querySelector('.gaip-stp-current-override');
        if (existing) {
            var parts = [];
            if (existing.species) parts.push('species: ' + existing.species);
            if (existing.companionSpecies) parts.push('companion: ' + existing.companionSpecies);
            ovEl.innerHTML = '<strong>Current override:</strong> ' + (parts.length ? parts.join(' · ') : '(empty)');
        } else {
            ovEl.innerHTML = '<strong>Current override:</strong> none — sample inherits site-level values';
        }

        _modal.overlay.style.display = 'flex';
    }

    function close() {
        if (_modal && _modal.overlay) _modal.overlay.style.display = 'none';
    }

    global.GaipSampleTurfProfileModal = {
        version: VERSION,
        open: open,
        close: close,
        _computeDelta: _computeDelta,
        _captureSiteLevel: _captureSiteLevel,
        _getSportsSpeciesOptions: _getSportsSpeciesOptions
    };
})(typeof window !== 'undefined' ? window : this);
