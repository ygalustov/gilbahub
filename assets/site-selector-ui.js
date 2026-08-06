/**
 * =============================================================================
 * GILBA HUB SITE SELECTOR UI v1.0.1
 * =============================================================================
 *
 * Site management UI for consultants managing multiple courses/venues.
 *
 * DEPENDENCIES:
 *   - sample-manager.js (GAIP_SampleManager site API)
 *
 * @author Gilba Solutions
 * @version 1.0.1
 * =============================================================================
 */

(function(global) {
    'use strict';

    var _injected = false; // guard — inject() also checks getElementById but this silences strict-mode ReferenceError

    var CONFIG = {
        version: '1.0.1',
        debug: true,
        anchorSelectors: [
            '.gaip-sample-switcher-soil',
            '.gaip-section[data-section="soil-chemistry"]',
            '.gaip-mlsn-body',
            '#gaip-hub-container'
        ]
    };

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
            console.log('[SiteSelector]', message, data);
        } else {
            console.log('[SiteSelector]', message);
        }
    }

    function buildSiteBar() {
        var SM = global.GAIP_SampleManager;
        if (!SM || typeof SM.getSiteList !== 'function') {
            log('SampleManager site API not available');
            return null;
        }

        var sites = SM.getSiteList();
        var activeId = SM.getActiveSiteId();

        var bar = document.createElement('div');
        bar.className = 'gaip-site-bar';
        bar.id = 'gaip-site-bar';

        var label = document.createElement('span');
        label.className = 'gaip-site-bar-label';
        label.textContent = '\uD83C\uDFCC\uFE0F Site:';
        bar.appendChild(label);

        var select = document.createElement('select');
        select.className = 'gaip-site-select';
        select.id = 'gaip-site-select';
        for (var i = 0; i < sites.length; i++) {
            var opt = document.createElement('option');
            opt.value = sites[i].id;
            opt.textContent = sites[i].label;
            if (sites[i].id === activeId) opt.selected = true;
            select.appendChild(opt);
        }
        bar.appendChild(select);

        var addBtn = document.createElement('button');
        addBtn.className = 'gaip-site-btn gaip-site-btn-add';
        addBtn.title = 'Add new site';
        addBtn.textContent = '+';
        addBtn.type = 'button';
        bar.appendChild(addBtn);

        var renameBtn = document.createElement('button');
        renameBtn.className = 'gaip-site-btn gaip-site-btn-rename';
        renameBtn.title = 'Rename current site';
        renameBtn.textContent = '\u270E';
        renameBtn.type = 'button';
        bar.appendChild(renameBtn);

        var delBtn = document.createElement('button');
        delBtn.className = 'gaip-site-btn gaip-site-btn-delete';
        delBtn.title = 'Remove current site';
        delBtn.textContent = '\u2715';
        delBtn.type = 'button';
        if (activeId === 'default') delBtn.style.display = 'none';
        bar.appendChild(delBtn);

        var saveBtn = document.createElement('button');
        saveBtn.className = 'gaip-site-btn gaip-site-btn-save';
        saveBtn.title = 'Save current site configuration';
        saveBtn.textContent = '\uD83D\uDCBE';
        saveBtn.type = 'button';
        saveBtn.style.cssText = 'font-size: 14px; cursor: pointer;';
        bar.appendChild(saveBtn);

        var badge = document.createElement('span');
        badge.className = 'gaip-site-sample-count';
        badge.id = 'gaip-site-sample-count';
        badge.textContent = getSampleCountText();
        bar.appendChild(badge);

        select.addEventListener('change', function() {
            var newSiteId = select.value;
            log('User switching to site: ' + newSiteId);
            _lastDispatchedSiteId = null;  // force dispatch on explicit user switch
            SM.setActiveSite(newSiteId);
            reloadActiveSample();
            updateUI();
        });

        addBtn.addEventListener('click', function() {
            var name = prompt('Enter site name (e.g. "Royal Melbourne GC"):');
            if (!name || !name.trim()) return;
            var id = SM.addSite(name.trim());
            SM.setActiveSite(id);
            clearAllForms();
            updateUI();
        });

        renameBtn.addEventListener('click', function() {
            var currentLabel = SM.getActiveSiteLabel();
            var newName = prompt('Rename site:', currentLabel);
            if (!newName || !newName.trim() || newName.trim() === currentLabel) return;
            SM.renameSite(SM.getActiveSiteId(), newName.trim());
            updateUI();
        });

        delBtn.addEventListener('click', function() {
            var siteLabel = SM.getActiveSiteLabel();
            var siteId = SM.getActiveSiteId();
            if (siteId === 'default') return;
            if (!confirm('Remove "' + siteLabel + '" and all its samples? This cannot be undone.')) return;
            SM.removeSite(siteId);
            reloadActiveSample();
            updateUI();
        });

        saveBtn.addEventListener('click', function() {
            var siteLabel = SM.getActiveSiteLabel();
            document.dispatchEvent(new CustomEvent('gaip:site-save-requested', {
                detail: { siteId: SM.getActiveSiteId(), label: siteLabel }
            }));
            // Visual feedback
            var origText = saveBtn.textContent;
            saveBtn.textContent = '✓';
            saveBtn.style.color = '#28a745';
            setTimeout(function() {
                saveBtn.textContent = origText;
                saveBtn.style.color = '';
            }, 1500);
        });

        return bar;
    }

    // ─── Sample selectors (soil + water) ─────────────────────────────────────
    // Compact dropdown buttons in the site bar, styled like sn-drop-* in soil-nutrition-analysis.js.

    var _smpDropCss = [
        '.ss-smp-sep{margin:0 6px;color:#d1d5db;font-size:14px;line-height:1}',
        '.ss-smp-wrap{position:relative;display:inline-flex;align-items:center}',
        '.ss-smp-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid #86efac;border-radius:6px;background:var(--gaip-surface,#fff);cursor:pointer;font-size:12px;color:#166534;white-space:nowrap;max-width:200px;font-family:inherit}',
        '.ss-smp-btn:hover{border-color:#2da85e;color:#166534}',
        '.ss-smp-btn:disabled{opacity:.5;cursor:default}',
        '.ss-smp-type{font-weight:700;flex-shrink:0;margin-right:2px}',
        '.ss-smp-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px}',
        '.ss-smp-panel{display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:9999;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);min-width:200px;max-width:300px;padding:4px 0;font-family:inherit}',
        '.ss-smp-open .ss-smp-panel{display:block}',
        '.ss-smp-row{display:flex;justify-content:space-between;align-items:center;padding:7px 12px;cursor:pointer;font-size:12px;color:#374151;gap:8px}',
        '.ss-smp-row:hover{background:#f0fdf4}',
        '.ss-smp-row.active{background:#f0fdf4;font-weight:600;color:#166534}',
        '.ss-smp-row-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.ss-smp-row-date{flex-shrink:0;font-size:11px;color:#9ca3af}',
    ].join('');

    var _smpCssInjected = false;
    function _injectSmpCss() {
        if (_smpCssInjected) return;
        var st = document.createElement('style');
        st.textContent = _smpDropCss;
        document.head.appendChild(st);
        _smpCssInjected = true;
    }

    function _smpLabel(sample) {
        if (!sample) return null;
        return sample.label || sample.id || null;
    }

    function _buildSmpRows(samples, activeId) {
        if (!samples || !samples.length) return '<div style="padding:8px 12px;font-size:12px;color:#9ca3af">No samples</div>';
        return samples.map(function(s) {
            var id = s.id || s.sampleId;
            var name = _smpLabel(s) || id;
            var date = s.date ? s.date.slice(0, 10) : '';
            var active = (id === activeId);
            return '<div class="ss-smp-row' + (active ? ' active' : '') + '" data-id="' + id.replace(/"/g, '&quot;') + '">' +
                '<span class="ss-smp-row-name">' + name + '</span>' +
                (date ? '<span class="ss-smp-row-date">' + date + '</span>' : '') +
                '</div>';
        }).join('');
    }

    function _buildSampleDropdown(dataType) {
        var SM = global.GAIP_SampleManager;
        var samples = (SM && SM.getSamples && SM.getSamples(dataType)) || [];
        var activeId = SM && SM.getActiveSampleId && SM.getActiveSampleId(dataType);
        var activeSmp = samples.find(function(s){ return (s.id || s.sampleId) === activeId; });
        var label = activeSmp ? (_smpLabel(activeSmp) || activeId) : (samples.length > 0 ? '—' : 'No ' + dataType);
        var typeLbl = dataType === 'soil' ? 'Soil' : 'Water';

        var wrap = document.createElement('div');
        wrap.className = 'ss-smp-wrap';
        wrap.id = 'ss-smp-wrap-' + dataType;
        wrap.dataset.type = dataType;

        var svgChev = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M6 9l6 6 6-6"/></svg>';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ss-smp-btn';
        btn.id = 'ss-smp-btn-' + dataType;
        btn.innerHTML = '<span class="ss-smp-type">' + typeLbl + ':</span><span class="ss-smp-label" id="ss-smp-label-' + dataType + '">' + label + '</span>' + svgChev;
        btn.disabled = samples.length === 0;
        wrap.appendChild(btn);

        var panel = document.createElement('div');
        panel.className = 'ss-smp-panel';
        panel.id = 'ss-smp-panel-' + dataType;
        panel.innerHTML = _buildSmpRows(samples, activeId);
        wrap.appendChild(panel);

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var other = dataType === 'soil' ? 'water' : 'soil';
            var ow = document.getElementById('ss-smp-wrap-' + other);
            if (ow) ow.classList.remove('ss-smp-open');
            wrap.classList.toggle('ss-smp-open');
        });

        panel.addEventListener('click', function(e) {
            var row = e.target.closest('.ss-smp-row[data-id]');
            if (!row) return;
            wrap.classList.remove('ss-smp-open');
            _switchSample(dataType, row.dataset.id);
        });

        return wrap;
    }

    function _switchSample(dataType, sampleId) {
        var SM = global.GAIP_SampleManager;
        if (!SM || !sampleId) return;
        log('Switching ' + dataType + ' sample to: ' + sampleId);
        SM.loadSample(dataType, sampleId);
        updateSampleSelectors();
        setTimeout(function() {
            var runBtn = document.querySelector('.gaip-run-btn');
            if (runBtn) runBtn.click();
        }, 80);
    }

    function updateSampleSelectors() {
        ['soil', 'water'].forEach(function(dataType) {
            var SM = global.GAIP_SampleManager;
            var samples = (SM && SM.getSamples && SM.getSamples(dataType)) || [];
            var activeId = SM && SM.getActiveSampleId && SM.getActiveSampleId(dataType);
            var activeSmp = samples.find(function(s){ return (s.id || s.sampleId) === activeId; });
            var label = activeSmp ? (_smpLabel(activeSmp) || activeId) : (samples.length > 0 ? '—' : 'No ' + dataType);
            var labelEl = document.getElementById('ss-smp-label-' + dataType);
            if (labelEl) labelEl.textContent = label;
            var btn = document.getElementById('ss-smp-btn-' + dataType);
            if (btn) btn.disabled = samples.length === 0;
            var panel = document.getElementById('ss-smp-panel-' + dataType);
            if (panel) panel.innerHTML = _buildSmpRows(samples, activeId);
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', function() {
        document.querySelectorAll('.ss-smp-wrap.ss-smp-open').forEach(function(w){ w.classList.remove('ss-smp-open'); });
    });

    // ─────────────────────────────────────────────────────────────────────────

    var _updatingUI = false;
    var _lastDispatchedSiteId = null;  // prevents bounce from restore-triggered updateUI calls
    function updateUI() {
        if (_updatingUI) return;
        _updatingUI = true;

        var SM = global.GAIP_SampleManager;
        if (!SM) { _updatingUI = false; return; }

        var select = document.getElementById('gaip-site-select');
        if (!select) {
            _updatingUI = false;
            inject();
            return;
        }

        var sites = SM.getSiteList();
        var activeId = SM.getActiveSiteId();

        select.innerHTML = '';
        for (var i = 0; i < sites.length; i++) {
            var opt = document.createElement('option');
            opt.value = sites[i].id;
            opt.textContent = sites[i].label;
            if (sites[i].id === activeId) opt.selected = true;
            select.appendChild(opt);
        }

        // Sync PHP-rendered top bar select (gaip-site-select-top)
        var selectTop = document.getElementById('gaip-site-select-top');
        if (selectTop) {
            selectTop.innerHTML = '';
            for (var j = 0; j < sites.length; j++) {
                var optT = document.createElement('option');
                optT.value = sites[j].id;
                optT.textContent = sites[j].label;
                if (sites[j].id === activeId) optT.selected = true;
                selectTop.appendChild(optT);
            }
            var delBtnTop = document.getElementById('gaip-site-delete-top');
            if (delBtnTop) delBtnTop.style.display = (activeId === 'default') ? 'none' : '';
        }

        var delBtn = document.querySelector('.gaip-site-btn-delete');
        if (delBtn) {
            delBtn.style.display = (activeId === 'default') ? 'none' : '';
        }

        var badge = document.getElementById('gaip-site-sample-count');
        if (badge) badge.textContent = getSampleCountText();

        updateSampleSelectors();

        // Update sample switcher dropdowns if available
        var switchers = document.querySelectorAll('.gaip-sample-select');
        // b35fix98: dispatch unconditionally — previously gated on switchers.length
        // which prevented cleanup of stale globals on site switch when no dropdowns present
        if (activeId !== _lastDispatchedSiteId) {
            _lastDispatchedSiteId = activeId;
            document.dispatchEvent(new CustomEvent('gaip:site-changed', {
                detail: { siteId: activeId, label: SM.getActiveSiteLabel() }
            }));
        }

        log('UI updated: ' + activeId + ' (' + SM.getActiveSiteLabel() + '), ' + getSampleCountText());
        _updatingUI = false;
    }

    /**
     * Reload the active site's samples into forms.
     * For each data type: if the site has an active sample, load it.
     * If not, clear that form so stale data from the previous site doesn't persist.
     */
    function reloadActiveSample() {
        var SM = global.GAIP_SampleManager;
        if (!SM) return;

        var types = ['soil', 'water', 'tissue', 'loi'];
        var clearFns = {
            soil: clearSoilForm,
            water: clearWaterForm,
            tissue: clearTissueForm,
            loi: clearLOIForm
        };

        for (var t = 0; t < types.length; t++) {
            var dt = types[t];
            var activeId = SM.getActiveSampleId(dt);

            if (activeId) {
                var sample = SM.getSample(dt, activeId);
                if (sample) {
                    SM.loadSample(dt, activeId);
                    log('Loaded ' + dt + ' sample: ' + activeId);
                    continue;
                }
            }

            // No active sample for this type on the current site
            // Check if there are ANY samples of this type; load the first one
            var allSamples = SM.getSamples(dt);
            if (allSamples && allSamples.length > 0) {
                var firstId = allSamples[0].id || allSamples[0].sampleId;
                if (firstId) {
                    SM.loadSample(dt, firstId);
                    log('Auto-loaded first ' + dt + ' sample: ' + firstId);
                    continue;
                }
            }

            // No samples at all for this type on this site - clear the form
            if (clearFns[dt]) {
                clearFns[dt]();
                log('Cleared ' + dt + ' form (no samples on this site)');
            }
        }

        updateSampleSelectors();

        // Signal that the DOM forms now reflect the currently active site, so
        // consumers that gate an analysis run on "site data ready" (rather than
        // guessing with an independent timer) have something authoritative to
        // wait for. Fires every time this function completes, regardless of
        // which of the several call sites (site dropdown, samples-restored,
        // site-changed, etc.) triggered the reload.
        document.dispatchEvent(new CustomEvent('gaip:site-samples-ready', {
            detail: { siteId: SM.getActiveSiteId ? SM.getActiveSiteId() : null }
        }));
    }

    /**
     * Clear soil form fields.
     */
    function clearSoilForm() {
        var soilFields = [
            '.gaip-soil-k', '.gaip-soil-p', '.gaip-soil-ca', '.gaip-soil-mg',
            '.gaip-soil-s', '.gaip-soil-fe', '.gaip-soil-mn', '.gaip-soil-cu',
            '.gaip-soil-zn', '.gaip-soil-b', '.gaip-cec', '.gaip-soil-ph',
            '.gaip-soil-ec', '.gaip-soil-na', '.gaip-soil-date', '.gaip-depth',
            '.gaip-bd', '.gaip-soil-ph-cacl2'
        ];
        clearFields(soilFields);
        // Also clear the MLSN progressive-disclosure grid inputs (data-mlsn attributes)
        // These are read by collectGridValues() and are NOT covered by the named selectors above
        var mlsnGrid = document.querySelector('.gaip-soil-grid');
        if (mlsnGrid) {
            var mlsnInputs = mlsnGrid.querySelectorAll('input[data-mlsn]');
            for (var i = 0; i < mlsnInputs.length; i++) {
                mlsnInputs[i].value = '';
            }
        }
    }

    /**
     * Clear water form fields.
     * b35fix434 / C43: extended to clear water sample metadata fields
     * (source-label, lab-ref, date). Pre-fix these survived site-switch and
     * fed word-export.js DOM-fallback reads at line ~7917-7924, producing
     * cross-site bleed (Shirley docx showing Rockingham's "Dam" / "Bore" /
     * "2024-07-02" with byte-identical metadata). The fix mirrors the
     * SampleManager-scoped path: ALL water-related DOM fields clear together.
     */
    function clearWaterForm() {
        var waterFields = [
            '.gaip-water-ph', '.gaip-ecw',
            '[data-ion="Ca"]', '[data-ion="Mg"]', '[data-ion="Na"]', '[data-ion="K"]',
            '[data-ion="Cl"]', '[data-ion="SO4"]', '[data-ion="HCO3"]', '[data-ion="CO3"]',
            '[data-ion="B"]', '[data-ion="Fe"]', '[data-ion="NO3"]', '[data-ion="PO4"]',
            '[data-ion="Mn"]',
            // b35fix434 / C43: metadata fields cleared in parallel with ion inputs.
            '.gaip-water-source-label', '.gaip-water-lab-ref', '.gaip-water-date'
        ];
        clearFields(waterFields);
    }

    /**
     * Clear tissue form fields.
     */
    function clearTissueForm() {
        var container = document.querySelector('#gaipTissueModule') ||
                       document.querySelector('.gaip-tissue-module') || document;
        // Tissue uses data-val attributes on inputs
        var tissueInputs = container.querySelectorAll('input[data-val]');
        for (var i = 0; i < tissueInputs.length; i++) {
            tissueInputs[i].value = '';
            tissueInputs[i].dispatchEvent(new Event('input', { bubbles: true }));
        }
        // Also try tr[data-el] pattern
        var trInputs = container.querySelectorAll('tr[data-el] input');
        for (var j = 0; j < trInputs.length; j++) {
            trInputs[j].value = '';
            trInputs[j].dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    /**
     * Clear LOI/OM form fields.
     */
    function clearLOIForm() {
        var loiFields = [
            '.gaip-loi-0-2', '.gaip-loi-2-4', '.gaip-loi-4-6', '.gaip-loi'
        ];
        clearFields(loiFields);
    }

    /**
     * Helper: clear a list of fields by selector.
     */
    function clearFields(selectors) {
        for (var i = 0; i < selectors.length; i++) {
            var input = document.querySelector(selectors[i]);
            if (input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    /**
     * Clear all form fields (when creating new empty site or switching to empty site).
     */
    function clearAllForms() {
        clearSoilForm();
        clearWaterForm();
        clearTissueForm();
        clearLOIForm();
        log('All forms cleared');
    }

    function getSampleCountText() {
        var SM = global.GAIP_SampleManager;
        if (!SM) return '';
        var soilCount = SM.getSampleCount('soil') || 0;
        var waterCount = SM.getSampleCount('water') || 0;
        var tissueCount = SM.getSampleCount('tissue') || 0;
        var total = soilCount + waterCount + tissueCount;
        if (total === 0) return 'no samples';
        var parts = [];
        if (soilCount > 0) parts.push(soilCount + ' soil');
        if (waterCount > 0) parts.push(waterCount + ' water');
        if (tissueCount > 0) parts.push(tissueCount + ' tissue');
        return parts.join(', ');
    }

    function inject() {
        if (document.getElementById('gaip-site-bar')) return;
        var bar = buildSiteBar();
        if (!bar) return;
        var anchor = null;
        for (var i = 0; i < CONFIG.anchorSelectors.length; i++) {
            anchor = document.querySelector(CONFIG.anchorSelectors[i]);
            if (anchor) break;
        }
        if (!anchor) {
            log('No anchor found for site bar injection');
            return;
        }
        anchor.parentNode.insertBefore(bar, anchor);
        _injected = true;
        log('Site bar injected');
    }

    function init() {
        log('Site Selector UI v' + CONFIG.version + ' initializing');
        inject();
        setTimeout(inject, 500);
        setTimeout(inject, 1500);

        // After persistence restores samples, reload the active site's sample
        document.addEventListener('gaip:samples-restored', function() {
            log('Samples restored, reloading active site sample');
            updateUI();
            // Delay to let form DOM settle after persistence restore
            setTimeout(function() {
                reloadActiveSample();
            }, 400);
        });

        // site-config-applied fires on every page load (with or without saved samples).
        // gaip:samples-restored only fires when restoredCount > 0 — on a clean install
        // or after cache clear there are no samples so the dropdown stays stuck on
        // "Loading sites...". This listener covers that gap.
        document.addEventListener('gaip:site-config-applied', function() {
            updateUI();
        });

        document.addEventListener('gaip:samples-imported', function() {
            var badge = document.getElementById('gaip-site-sample-count');
            if (badge) badge.textContent = getSampleCountText();
        });

        document.addEventListener('gaip:samples-cleared', function() {
            var badge = document.getElementById('gaip-site-sample-count');
            if (badge) badge.textContent = getSampleCountText();
        });

        document.addEventListener('gaip:sample-deleted', function() {
            var badge = document.getElementById('gaip-site-sample-count');
            if (badge) badge.textContent = getSampleCountText();
        });

        // Refresh dropdown when a site is added programmatically (e.g. from loadProfile)
        document.addEventListener('gaip:site-added', function() {
            log('Site added, refreshing dropdown');
            updateUI();
        });

        // Refresh dropdown when site is switched externally (e.g. from SiteDashboard card click)
        // Must reload the active sample so form fields reflect the new site's data
        document.addEventListener('gaip:site-changed', function() {
            // Skip intermediate site-changes during combined export
            if (global.GAIP_COMBINED_EXPORT_ACTIVE) return;
            updateUI();
            setTimeout(function() {
                reloadActiveSample();
            }, 300);
        });

        // Wire PHP-rendered top bar controls (gaip-site-selector-top)
        var _topBarWired = false;
        function wireTopBar() {
            if (_topBarWired) return;
            var SM = global.GAIP_SampleManager;
            if (!SM) return;
            var selectTop = document.getElementById('gaip-site-select-top');
            if (!selectTop) return;
            _topBarWired = true;

            selectTop.addEventListener('change', function() {
                _lastDispatchedSiteId = null;
                SM.setActiveSite(selectTop.value);
                reloadActiveSample();
                updateUI();
            });

            var addBtnTop = document.getElementById('gaip-site-add-top');
            if (addBtnTop) {
                addBtnTop.addEventListener('click', function() {
                    var name = prompt('Enter site name (e.g. "Royal Melbourne GC"):');
                    if (!name || !name.trim()) return;
                    SM.addSite(name.trim());
                    updateUI();
                });
            }

            var renameBtnTop = document.getElementById('gaip-site-rename-top');
            if (renameBtnTop) {
                renameBtnTop.addEventListener('click', function() {
                    var cur = SM.getActiveSiteLabel();
                    var name = prompt('Rename site:', cur);
                    if (!name || !name.trim() || name.trim() === cur) return;
                    SM.renameSite(SM.getActiveSiteId(), name.trim());
                    updateUI();
                });
            }

            var delBtnTop = document.getElementById('gaip-site-delete-top');
            if (delBtnTop) {
                delBtnTop.addEventListener('click', function() {
                    var id = SM.getActiveSiteId();
                    if (id === 'default') return;
                    if (!confirm('Remove site "' + SM.getActiveSiteLabel() + '"? All samples will be deleted.')) return;
                    SM.removeSite(id);
                    updateUI();
                    reloadActiveSample();
                });
            }

            var saveBtnTop = document.getElementById('gaip-site-save-top');
            if (saveBtnTop) {
                saveBtnTop.addEventListener('click', function() {
                    if (global.GilbaSiteConfig && typeof global.GilbaSiteConfig.saveCurrentSite === 'function') {
                        global.GilbaSiteConfig.saveCurrentSite();
                    }
                    var statusTop = document.getElementById('gaip-site-status-top');
                    if (statusTop) {
                        statusTop.textContent = '✓ Saved';
                        setTimeout(function() { statusTop.textContent = ''; }, 2000);
                    }
                });
            }

            log('Top bar wired');
        }
        wireTopBar();
        setTimeout(wireTopBar, 500);
        setTimeout(wireTopBar, 1500);

        // When a stadium venue is selected in the shade tab, show the venue name
        // in the site bar so the user knows which venue context is active.
        document.addEventListener('gssh:venueSelect', function(e) {
            var venueName = e.detail && e.detail.venue_name;
            if (!venueName) return;
            // Update the injected bar label
            var label = document.querySelector('.gaip-site-bar-label');
            if (label) label.textContent = '\uD83C\uDFDF\uFE0F Venue: ' + venueName;
            // Update PHP-rendered top bar label if present
            var labelTop = document.getElementById('gaip-site-label-top');
            if (labelTop) labelTop.textContent = '\uD83C\uDFDF\uFE0F Venue: ' + venueName;
            log('Site bar updated for venue: ' + venueName);
        });

        // Reset label back to site name when venue is deselected or site changes
        document.addEventListener('gaip:site-changed', function(e) {
            var label = document.querySelector('.gaip-site-bar-label');
            if (label) label.textContent = '\uD83C\uDFCC\uFE0F Site:';
            var labelTop = document.getElementById('gaip-site-label-top');
            if (labelTop) labelTop.textContent = '\uD83C\uDFCC\uFE0F Site:';
        });

        log('Site Selector UI v' + CONFIG.version + ' ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 200);
    }

    global.GilbaSiteSelector = {
        updateUI: updateUI,
        inject: inject,
        reloadActiveSample: reloadActiveSample,
        updateSampleSelectors: updateSampleSelectors,
        clearTissueForm: clearTissueForm,
        version: CONFIG.version
    };

})(window);
