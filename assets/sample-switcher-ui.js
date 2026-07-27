/**
 * =============================================================================
 * GILBA HUB SAMPLE SWITCHER UI v1.0.0
 * =============================================================================
 * 
 * User interface for switching between imported samples.
 * Provides dropdown selection, quick-switch buttons, and sample info display.
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const CONFIG = {
        version: '1.1.1',
        debug: false
    };

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    // =========================================================================
    // ZONE TYPE LABELS & ICONS
    // =========================================================================

    const ZONE_LABELS = {
        green: { label: 'Green', icon: '🟢', color: '#16a34a' },
        fairway: { label: 'Fairway', icon: '🌿', color: '#65a30d' },
        tee: { label: 'Tee', icon: '⛳', color: '#0891b2' },
        rough: { label: 'Rough', icon: '🌾', color: '#ca8a04' },
        approach: { label: 'Approach', icon: '🎯', color: '#7c3aed' },
        collar: { label: 'Collar', icon: '⭕', color: '#059669' },
        bunker: { label: 'Bunker', icon: '🏖️', color: '#d97706' },
        sports_pitch: { label: 'Pitch', icon: '⚽', color: '#2563eb' },
        goal_area: { label: 'Goal Area', icon: '🥅', color: '#dc2626' },
        centre: { label: 'Centre', icon: '◉', color: '#4f46e5' },
        bore: { label: 'Bore', icon: '💧', color: '#0284c7' },
        recycled: { label: 'Recycled', icon: '♻️', color: '#16a34a' },
        potable: { label: 'Town Supply', icon: '🚰', color: '#0ea5e9' },
        surface: { label: 'Surface Water', icon: '🌊', color: '#06b6d4' },
        other: { label: 'Other', icon: '📍', color: 'var(--gaip-text-secondary)' }
    };

    // =========================================================================
    // UI COMPONENTS
    // =========================================================================

    /**
     * Create sample switcher for a specific data type
     */
    function createSampleSwitcher(dataType, options = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gaip-sample-switcher';
        wrapper.dataset.type = dataType;
        wrapper.innerHTML = `
            <div class="gaip-sample-switcher-header">
                <div class="gaip-sample-import-zone">
                    <input type="file" accept=".csv,.xlsx,.xls" 
                           class="gaip-sample-file-input" 
                           id="gaip-sample-file-${dataType}" 
                           style="display: none;">
                    <button type="button" class="gaip-sample-import-btn">
                        <span class="gaip-btn-icon">📁</span>
                        <span>Import ${capitalize(dataType)} Samples</span>
                    </button>
                    <button type="button" class="gaip-sample-save-btn" title="Save current form values as a new sample">
                        <span class="gaip-btn-icon">💾</span>
                        <span>Save as Sample</span>
                    </button>
                    <span class="gaip-sample-import-status"></span>
                </div>
            </div>
            <div class="gaip-sample-selector-area" style="display: none;">
                <div class="gaip-sample-selector-row">
                    <label class="gaip-sample-label">Active Sample:</label>
                    <select class="gaip-sample-select">
                        <option value="">Select a sample...</option>
                    </select>
                    <button class="gaip-sample-rename-btn" title="Rename this sample" style="background:none;border:1px solid var(--gaip-border);border-radius:4px;padding:2px 6px;cursor:pointer;font-size:13px;color:var(--gaip-text-secondary);margin-left:4px;" type="button">✏️</button>
                    ${dataType === 'soil' ? `<button class="gaip-sample-bulk-area-btn" title="Set area (ha) for multiple samples at once" style="background:none;border:1px solid var(--gaip-border);border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;color:var(--gaip-text-secondary);margin-left:4px;" type="button">📐 Set area…</button>` : ''}
                    ${dataType === 'soil' ? `<button class="gaip-sample-bulk-turf-btn" title="Set turf profile (species + companion) for multiple samples at once. Only visible when Multi-site turf is enabled." style="background:none;border:1px solid #10b981;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;color:#10b981;margin-left:4px;display:none;" type="button">🌱 Set turf profile…</button>` : ''}
                    <span class="gaip-sample-count"></span>
                </div>
                <div class="gaip-sample-quick-btns"></div>
                <div class="gaip-sample-info"></div>
            </div>
        `;

        // Attach event handlers
        const fileInput = wrapper.querySelector('.gaip-sample-file-input');
        const importBtn = wrapper.querySelector('.gaip-sample-import-btn');
        const saveBtn = wrapper.querySelector('.gaip-sample-save-btn');
        const importStatus = wrapper.querySelector('.gaip-sample-import-status');
        const selectorArea = wrapper.querySelector('.gaip-sample-selector-area');
        const select = wrapper.querySelector('.gaip-sample-select');
        const countSpan = wrapper.querySelector('.gaip-sample-count');
        const quickBtns = wrapper.querySelector('.gaip-sample-quick-btns');
        const infoDiv = wrapper.querySelector('.gaip-sample-info');

        // Import button click
        importBtn.onclick = () => fileInput.click();

        // Save as Sample button click (manual entry)
        saveBtn.onclick = () => {
            const sampleName = prompt(
                `Enter a name for this ${dataType} sample:\n(e.g., "Green 1", "Bore Water", "Fairway 5")`,
                `${capitalize(dataType)}_${global.GAIP_SampleManager.getSampleCount(dataType) + 1}`
            );
            
            if (!sampleName) return;

            try {
                const sample = global.GAIP_SampleManager.captureFromForm(dataType, sampleName);
                importStatus.textContent = `✓ Saved "${sampleName}"`;
                importStatus.className = 'gaip-sample-import-status gaip-status-success';
                
                // Update UI
                updateSampleSelector(wrapper, dataType);
                selectorArea.style.display = 'block';
                
                // Clear status after 3 seconds
                setTimeout(() => {
                    importStatus.textContent = '';
                    importStatus.className = 'gaip-sample-import-status';
                }, 3000);

            } catch (err) {
                importStatus.textContent = `✗ ${err.message}`;
                importStatus.className = 'gaip-sample-import-status gaip-status-error';
            }
        };

        // File selected
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            importStatus.textContent = 'Importing...';
            importStatus.className = 'gaip-sample-import-status gaip-status-loading';

            try {
                const result = await global.GAIP_SampleManager.importFile(file, { dataType });
                importStatus.textContent = `✓ Imported ${result.sampleCount} samples`;
                importStatus.className = 'gaip-sample-import-status gaip-status-success';
                
                // Update UI
                updateSampleSelector(wrapper, dataType);
                selectorArea.style.display = 'block';

            } catch (err) {
                importStatus.textContent = `✗ ${err.message}`;
                importStatus.className = 'gaip-sample-import-status gaip-status-error';
            }

            fileInput.value = '';
        };

        // Sample selection change
        select.onchange = () => {
            const sampleId = select.value;
            if (sampleId) {
                global.GAIP_SampleManager.loadSample(dataType, sampleId);
                updateSampleInfo(wrapper, dataType);
                updateQuickButtons(wrapper, dataType);
            }
        };

        // b35fix311: bulk area entry button for soil samples.
        // Opens a modal letting the user assign area (ha) to multiple samples
        // in one operation. Primary use case: council/multi-site operators
        // with 100+ zones who would otherwise edit each sample individually.
        if (dataType === 'soil') {
            const bulkAreaBtn = wrapper.querySelector('.gaip-sample-bulk-area-btn');
            if (bulkAreaBtn) {
                bulkAreaBtn.onclick = () => {
                    if (typeof global.GaipBulkAreaModal !== 'undefined' &&
                        typeof global.GaipBulkAreaModal.open === 'function') {
                        global.GaipBulkAreaModal.open(dataType, wrapper);
                    } else {
                        console.warn('[SampleSwitcher] GaipBulkAreaModal not loaded');
                    }
                };
            }

            // b35fix368: bulk turf profile button. Same pattern as bulk-area but
            // visibility-gated on multi-site turf toggle for the active site —
            // only relevant for council/multi-cohort workflows. Hidden by
            // default in the template, shown via _refreshBulkTurfBtnVisibility
            // on init and on gaip:multi-site-turf-change / gaip:site-changed.
            const bulkTurfBtn = wrapper.querySelector('.gaip-sample-bulk-turf-btn');
            const _refreshBulkTurfBtnVisibility = () => {
                if (!bulkTurfBtn) return;
                let on = false;
                try {
                    const SC = global.GAIP_SiteConfig;
                    if (SC && typeof SC.isMultiSiteTurfEnabled === 'function') {
                        on = !!SC.isMultiSiteTurfEnabled();
                    }
                } catch (e) { /* defensive */ }
                bulkTurfBtn.style.display = on ? '' : 'none';
            };
            if (bulkTurfBtn) {
                bulkTurfBtn.onclick = () => {
                    if (typeof global.GaipBulkTurfProfileModal !== 'undefined' &&
                        typeof global.GaipBulkTurfProfileModal.open === 'function') {
                        global.GaipBulkTurfProfileModal.open(dataType, wrapper);
                    } else {
                        console.warn('[SampleSwitcher] GaipBulkTurfProfileModal not loaded');
                    }
                };
                _refreshBulkTurfBtnVisibility();
                document.addEventListener('gaip:multi-site-turf-change', _refreshBulkTurfBtnVisibility);
                document.addEventListener('gaip:site-changed', _refreshBulkTurfBtnVisibility);
            }
        }

        // Rebuild selector when site switches — SM now holds a different set of samples
        document.addEventListener('gaip:site-changed', () => {
            updateSampleSelector(wrapper, dataType);
        });

        // Listen for sample events
        document.addEventListener('gaip:samples-imported', (e) => {
            if (e.detail.dataType === dataType) {
                updateSampleSelector(wrapper, dataType);
                selectorArea.style.display = 'block';
            }
        });

        document.addEventListener('gaip:sample-loaded', (e) => {
            if (e.detail.dataType === dataType) {
                updateSampleInfo(wrapper, dataType);
                select.value = e.detail.sampleId;
            }
        });

        // Listen for manual sample additions
        document.addEventListener('gaip:sample-added', (e) => {
            if (e.detail.dataType === dataType) {
                updateSampleSelector(wrapper, dataType);
                selectorArea.style.display = 'block';
            }
        });

        // b35fix311: refresh after bulk area assignment so the new areaHa values
        // show up in the select options and quick-button tooltips immediately.
        document.addEventListener('gaip:bulk-area-applied', (e) => {
            if (e.detail.dataType === dataType) {
                updateSampleSelector(wrapper, dataType);
            }
        });
        // Also cover single-sample updates (areaHa edit from elsewhere, rename, zone-type change)
        document.addEventListener('gaip:sample-updated', (e) => {
            if (e.detail.dataType === dataType) {
                updateSampleSelector(wrapper, dataType);
            }
        });

        // Rename button click
        const renameBtn = wrapper.querySelector('.gaip-sample-rename-btn');
        if (renameBtn) {
            renameBtn.onclick = () => {
                const currentId = select.value;
                if (!currentId) {
                    alert('Select a sample first.');
                    return;
                }
                const sm = global.GAIP_SampleManager;
                const sample = sm.getActiveSample ? sm.getActiveSample(dataType) : null;
                const currentLabel = (sample && sample.label) || currentId;
                const newName = prompt('Rename sample "' + currentLabel + '" to:', currentLabel);
                if (!newName || !newName.trim() || newName.trim() === currentLabel) return;
                const result = sm.renameSample(dataType, currentId, newName.trim());
                if (result) {
                    updateSampleSelector(wrapper, dataType);
                    importStatus.textContent = '✓ Renamed to "' + newName.trim() + '"';
                    importStatus.className = 'gaip-sample-import-status gaip-status-success';
                    setTimeout(() => { importStatus.textContent = ''; importStatus.className = 'gaip-sample-import-status'; }, 3000);
                }
            };
        }

        // Listen for sample renames
        document.addEventListener('gaip:sample-renamed', (e) => {
            if (e.detail.dataType === dataType) {
                updateSampleSelector(wrapper, dataType);
            }
        });

        // b35fix367 — re-render card on multi-site-turf toggle change so the
        // "Set turf profile…" button appears/disappears immediately, and on
        // sample-turf-profile change so the override chip refreshes.
        document.addEventListener('gaip:multi-site-turf-change', () => {
            updateSampleInfo(wrapper, dataType);
        });
        document.addEventListener('gaip:sample-turf-profile-changed', (e) => {
            if (e.detail && e.detail.dataType === dataType) {
                updateSampleInfo(wrapper, dataType);
            }
        });

        // Initial update if samples exist
        if (global.GAIP_SampleManager?.getSampleCount(dataType) > 0) {
            updateSampleSelector(wrapper, dataType);
            selectorArea.style.display = 'block';
        }

        return wrapper;
    }

    /**
     * Update the sample selector dropdown
     */
    function updateSampleSelector(wrapper, dataType) {
        const select = wrapper.querySelector('.gaip-sample-select');
        const countSpan = wrapper.querySelector('.gaip-sample-count');
        const samples = global.GAIP_SampleManager.getSamples(dataType);
        const activeId = global.GAIP_SampleManager.getActiveSampleId(dataType);

        // Clear and rebuild options
        select.innerHTML = '<option value="">Select a sample...</option>';

        // Group samples by zone type
        const grouped = {};
        samples.forEach(s => {
            const type = s.zoneType || 'other';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(s);
        });

        // Add grouped options
        Object.keys(grouped).sort().forEach(zoneType => {
            const zoneInfo = ZONE_LABELS[zoneType] || ZONE_LABELS.other;
            const optGroup = document.createElement('optgroup');
            optGroup.label = `${zoneInfo.icon} ${zoneInfo.label}`;

            grouped[zoneType].forEach(sample => {
                const option = document.createElement('option');
                option.value = sample.id;
                // b35fix311: for soil samples, append area info to the label so
                // the operator sees areaHa status at a glance (essential at
                // council scale where they'll have 100+ samples to audit).
                let displayText = sample.label || sample.id;
                if (dataType === 'soil') {
                    const ha = sample.rawData && sample.rawData.areaHa;
                    if (ha != null && isFinite(ha) && ha > 0) {
                        displayText += '  \u00b7  ' + parseFloat(ha).toFixed(2) + ' ha';
                    } else {
                        displayText += '  \u00b7  \u26a0 area missing';
                    }
                }
                option.textContent = displayText;
                if (sample.id === activeId) option.selected = true;
                optGroup.appendChild(option);
            });

            select.appendChild(optGroup);
        });

        // Update count
        countSpan.textContent = `${samples.length} sample${samples.length !== 1 ? 's' : ''} loaded`;

        // Update quick buttons
        updateQuickButtons(wrapper, dataType);

        // Update info if active
        if (activeId) {
            updateSampleInfo(wrapper, dataType);
        }

        // b35fix311a: selector-area visibility is managed here, not by callers.
        // Previously, gaip:site-changed and other events called updateSampleSelector
        // but did NOT set `selectorArea.style.display = 'block'`, so if the switcher
        // was mounted before samples existed (common for sites restored from
        // localStorage on page load), the selector stayed hidden permanently.
        // Single source of truth: samples.length > 0 → show, otherwise hide.
        var selectorArea = wrapper.querySelector('.gaip-sample-selector-area');
        if (selectorArea) {
            selectorArea.style.display = samples.length > 0 ? 'block' : 'none';
        }
    }

    /**
     * Update quick-access buttons for samples
     */
    function updateQuickButtons(wrapper, dataType) {
        const quickBtns = wrapper.querySelector('.gaip-sample-quick-btns');
        const samples = global.GAIP_SampleManager.getSamples(dataType);
        const activeId = global.GAIP_SampleManager.getActiveSampleId(dataType);

        // Limit to first 8 samples for quick access (expandable via +N more)
        const MAX_CHIPS = 8;
        const isExpanded = quickBtns._expanded || false;
        const displaySamples = isExpanded ? samples : samples.slice(0, MAX_CHIPS);

        quickBtns.innerHTML = '';

        displaySamples.forEach(sample => {
            const zoneInfo = ZONE_LABELS[sample.zoneType] || ZONE_LABELS.other;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gaip-sample-quick-btn' + (sample.id === activeId ? ' active' : '');
            // b35fix311: tooltip includes area for soil samples — instant audit
            // signal for missing/incorrect area data in large sample sets.
            let tooltipText = (sample.label || sample.id) + ' (double-click to rename)';
            if (dataType === 'soil') {
                const ha = sample.rawData && sample.rawData.areaHa;
                tooltipText = (sample.label || sample.id) +
                    ((ha != null && isFinite(ha) && ha > 0)
                        ? '  \u2022  ' + parseFloat(ha).toFixed(2) + ' ha'
                        : '  \u2022  \u26a0 area missing') +
                    '  (double-click to rename)';
            }
            btn.title = tooltipText;
            btn.innerHTML = `<span class="zone-icon">${zoneInfo.icon}</span><span class="sample-name">${truncate(sample.label || sample.id, 12)}</span>`;
            btn.style.borderColor = zoneInfo.color;
            // Inline styles can't reliably use CSS custom properties —
            // read the computed token value at runtime instead
            var hubEl = document.getElementById('gaip-hub');
            var isDark = hubEl && hubEl.classList.contains('gaip-dark');
            btn.style.color = isDark ? '#ecf2ed' : '#1a2b23';
            if (sample.id === activeId) {
                btn.style.backgroundColor = zoneInfo.color;
                btn.style.color = '#ffffff';
            }

            // Single click: load sample
            btn.onclick = () => {
                global.GAIP_SampleManager.loadSample(dataType, sample.id);
                wrapper.querySelector('.gaip-sample-select').value = sample.id;
                updateQuickButtons(wrapper, dataType);
            };

            // Double-click: rename sample
            btn.ondblclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const newName = prompt('Rename sample "' + (sample.label || sample.id) + '" to:', sample.label || sample.id);
                if (newName && newName.trim() && newName.trim() !== sample.id) {
                    const result = global.GAIP_SampleManager.renameSample(dataType, sample.id, newName.trim());
                    if (result) {
                        updateSampleSelector(wrapper, dataType);
                    } else {
                        alert('Rename failed. A sample with that name may already exist.');
                    }
                }
            };

            // ⚙ edit button — visible on the quick button, works on touch/mobile
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'gaip-sample-edit-btn';
            editBtn.title = 'Edit sample (rename, change zone, delete)';
            editBtn.textContent = '⚙';
            editBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;width:16px;height:16px;font-size:9px;line-height:16px;text-align:center;padding:0;border:1px solid var(--gaip-border);border-radius:50%;background:var(--gaip-surface);cursor:pointer;color:var(--gaip-text-secondary);display:none;z-index:2;';
            editBtn.onclick = (ev) => {
                ev.stopPropagation();
                openSampleEditMenu(sample, dataType, wrapper, editBtn);
            };
            btn.style.position = 'relative';
            btn.addEventListener('mouseenter', () => { editBtn.style.display = 'block'; });
            btn.addEventListener('mouseleave', () => { editBtn.style.display = 'none'; });
            // Touch: tap the ⚙ button itself
            editBtn.addEventListener('touchstart', (ev) => { ev.preventDefault(); ev.stopPropagation(); openSampleEditMenu(sample, dataType, wrapper, editBtn); }, { passive: false });
            btn.appendChild(editBtn);

            // Right-click: context menu with rename/delete (desktop fallback)
            btn.oncontextmenu = (e) => {
                e.preventDefault();
                // Remove any existing context menu
                const existing = document.querySelector('.gaip-sample-context-menu');
                if (existing) existing.remove();

                const menu = document.createElement('div');
                menu.className = 'gaip-sample-context-menu';
                menu.style.cssText = 'position:fixed; z-index:10000; background:var(--gaip-surface); border:1px solid var(--gaip-border); border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); padding:4px 0; min-width:140px; font-size:13px;';
                menu.style.left = e.clientX + 'px';
                menu.style.top = e.clientY + 'px';

                const renameItem = document.createElement('div');
                renameItem.textContent = '\u270F\uFE0F Rename';
                renameItem.style.cssText = 'padding:6px 14px; cursor:pointer; color:var(--gaip-text);';
                renameItem.onmouseenter = () => { renameItem.style.background = 'var(--gaip-surface-hover)'; };
                renameItem.onmouseleave = () => { renameItem.style.background = ''; };
                renameItem.onclick = () => {
                    menu.remove();
                    const newName = prompt('Rename sample "' + (sample.label || sample.id) + '" to:', sample.label || sample.id);
                    if (newName && newName.trim() && newName.trim() !== sample.id) {
                        const result = global.GAIP_SampleManager.renameSample(dataType, sample.id, newName.trim());
                        if (result) {
                            updateSampleSelector(wrapper, dataType);
                        } else {
                            alert('Rename failed. A sample with that name may already exist.');
                        }
                    }
                };

                const deleteItem = document.createElement('div');
                deleteItem.textContent = '\u2716 Delete';
                deleteItem.style.cssText = 'padding:6px 14px; cursor:pointer; color:#dc2626;';
                deleteItem.onmouseenter = () => { deleteItem.style.background = 'var(--gaip-critical-bg)'; };
                deleteItem.onmouseleave = () => { deleteItem.style.background = ''; };
                deleteItem.onclick = () => {
                    menu.remove();
                    if (confirm('Delete sample "' + (sample.label || sample.id) + '"? This cannot be undone.')) {
                        global.GAIP_SampleManager.deleteSample(dataType, sample.id);
                        updateSampleSelector(wrapper, dataType);
                    }
                };

                // Zone change submenu item
                const zoneItem = document.createElement('div');
                zoneItem.textContent = '\uD83D\uDCCC Change Zone';
                zoneItem.style.cssText = 'padding:6px 14px; cursor:pointer; color:var(--gaip-text);';
                zoneItem.onmouseenter = () => { zoneItem.style.background = 'var(--gaip-surface-hover)'; };
                zoneItem.onmouseleave = () => { zoneItem.style.background = ''; };
                zoneItem.onclick = () => {
                    menu.remove();
                    // Build zone picker dialog
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10001;display:flex;align-items:center;justify-content:center;';
                    const dialog = document.createElement('div');
                    dialog.style.cssText = 'background:var(--gaip-surface);border-radius:8px;padding:20px;min-width:240px;box-shadow:0 8px 24px rgba(0,0,0,0.2);';
                    dialog.innerHTML = '<div style="font-weight:600;margin-bottom:12px;font-size:14px;">Change Zone Type</div>' +
                        '<div style="font-size:12px;color:var(--gaip-text-secondary);margin-bottom:10px;">Sample: ' + (sample.label || sample.id) + '</div>';
                    const select = document.createElement('select');
                    select.style.cssText = 'width:100%;padding:6px 8px;border:1px solid var(--gaip-border);border-radius:4px;font-size:13px;margin-bottom:14px;';
                    Object.keys(ZONE_LABELS).forEach(zk => {
                        const opt = document.createElement('option');
                        opt.value = zk;
                        opt.textContent = ZONE_LABELS[zk].icon + ' ' + ZONE_LABELS[zk].label;
                        if (zk === (sample.zoneType || 'other')) opt.selected = true;
                        select.appendChild(opt);
                    });
                    dialog.appendChild(select);
                    const btns = document.createElement('div');
                    btns.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = 'padding:5px 12px;border:1px solid var(--gaip-border);border-radius:4px;background:var(--gaip-surface-muted);cursor:pointer;font-size:12px;';
                    cancelBtn.onclick = () => overlay.remove();
                    const applyBtn = document.createElement('button');
                    applyBtn.textContent = 'Apply';
                    applyBtn.style.cssText = 'padding:5px 12px;border:1px solid #86efac;border-radius:4px;background:var(--gaip-good-bg);cursor:pointer;font-size:12px;font-weight:600;color:#16a34a;';
                    applyBtn.onclick = () => {
                        global.GAIP_SampleManager.setZoneType(dataType, sample.id, select.value);
                        overlay.remove();
                        updateSampleSelector(wrapper, dataType);
                        updateQuickButtons(wrapper, dataType);
                    };
                    btns.appendChild(cancelBtn);
                    btns.appendChild(applyBtn);
                    dialog.appendChild(btns);
                    overlay.appendChild(dialog);
                    overlay.onclick = (ev) => { if (ev.target === overlay) overlay.remove(); };
                    document.body.appendChild(overlay);
                };

                menu.appendChild(renameItem);
                menu.appendChild(zoneItem);
                menu.appendChild(deleteItem);
                document.body.appendChild(menu);

                // Close on any click outside
                const closeMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu, true);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
            };

            quickBtns.appendChild(btn);
        });

        // Add "more" indicator if there are more samples
        if (samples.length > MAX_CHIPS && !isExpanded) {
            const more = document.createElement('button');
            more.type = 'button';
            more.className = 'gaip-sample-more-indicator';
            more.textContent = `+${samples.length - MAX_CHIPS} more`;
            more.title = 'Click to show all samples';
            more.style.cssText = 'cursor:pointer;border:1px dashed var(--gaip-text-muted);border-radius:20px;padding:4px 10px;background:transparent;font-size:12px;color:var(--gaip-text-secondary);';
            more.onclick = () => {
                quickBtns._expanded = true;
                updateQuickButtons(wrapper, dataType);
            };
            quickBtns.appendChild(more);
        } else if (isExpanded && samples.length > MAX_CHIPS) {
            const less = document.createElement('button');
            less.type = 'button';
            less.className = 'gaip-sample-more-indicator';
            less.textContent = '▲ less';
            less.title = 'Click to collapse';
            less.style.cssText = 'cursor:pointer;border:1px dashed var(--gaip-text-muted);border-radius:20px;padding:4px 10px;background:transparent;font-size:12px;color:var(--gaip-text-secondary);';
            less.onclick = () => {
                quickBtns._expanded = false;
                updateQuickButtons(wrapper, dataType);
            };
            quickBtns.appendChild(less);
        }
    }

    /**
     * Open a touch-friendly edit menu for a sample (rename, zone, delete).
     * Called from the ⚙ gear button on quick buttons.
     */
    function openSampleEditMenu(sample, dataType, wrapper, anchorEl) {
        // Remove any existing menu
        const existing = document.querySelector('.gaip-sample-edit-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'gaip-sample-edit-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10002;display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:var(--gaip-surface);border-radius:10px;padding:0;min-width:260px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.25);overflow:hidden;';

        const zoneInfo = ZONE_LABELS[sample.zoneType] || ZONE_LABELS.other;
        dialog.innerHTML =
            '<div style="background:var(--gaip-surface-muted);padding:12px 16px;border-bottom:1px solid var(--gaip-border);">' +
                '<div style="font-weight:600;font-size:13px;color:var(--gaip-text);">' + (sample.label || sample.id) + '</div>' +
                '<div style="font-size:11px;color:var(--gaip-text-secondary);margin-top:2px;">' + zoneInfo.icon + ' ' + zoneInfo.label + '</div>' +
            '</div>' +
            '<div class="gaip-edit-menu-items" style="padding:6px 0;">' +
                '<div class="gaip-edit-item" data-action="zone" style="padding:10px 16px;cursor:pointer;font-size:13px;color:var(--gaip-text);display:flex;align-items:center;gap:10px;">' +
                    '<span style="font-size:16px;">📌</span><span>Change Zone</span>' +
                '</div>' +
                '<div class="gaip-edit-item" data-action="rename" style="padding:10px 16px;cursor:pointer;font-size:13px;color:var(--gaip-text);display:flex;align-items:center;gap:10px;">' +
                    '<span style="font-size:16px;">✏️</span><span>Rename</span>' +
                '</div>' +
                '<div style="height:1px;background:var(--gaip-border);margin:4px 0;"></div>' +
                '<div class="gaip-edit-item" data-action="delete" style="padding:10px 16px;cursor:pointer;font-size:13px;color:#dc2626;display:flex;align-items:center;gap:10px;">' +
                    '<span style="font-size:16px;">🗑️</span><span>Delete</span>' +
                '</div>' +
            '</div>' +
            '<div style="padding:8px 16px;border-top:1px solid var(--gaip-border);">' +
                '<button class="gaip-edit-cancel" style="width:100%;padding:8px;border:1px solid var(--gaip-border);border-radius:6px;background:var(--gaip-surface-muted);cursor:pointer;font-size:13px;color:var(--gaip-text-secondary);">Cancel</button>' +
            '</div>';

        // Hover styles for items
        dialog.querySelectorAll('.gaip-edit-item').forEach(item => {
            item.addEventListener('mouseenter', () => { item.style.background = 'var(--gaip-surface-hover)'; });
            item.addEventListener('mouseleave', () => { item.style.background = ''; });
        });

        // Actions
        dialog.querySelector('[data-action="zone"]').addEventListener('click', () => {
            overlay.remove();
            openZonePicker(sample, dataType, wrapper);
        });
        dialog.querySelector('[data-action="rename"]').addEventListener('click', () => {
            overlay.remove();
            const newName = prompt('Rename "' + (sample.label || sample.id) + '" to:', sample.label || sample.id);
            if (newName && newName.trim() && newName.trim() !== sample.id) {
                const result = global.GAIP_SampleManager.renameSample(dataType, sample.id, newName.trim());
                if (result) { updateSampleSelector(wrapper, dataType); }
                else { alert('Rename failed. A sample with that name may already exist.'); }
            }
        });
        dialog.querySelector('[data-action="delete"]').addEventListener('click', () => {
            overlay.remove();
            if (confirm('Delete "' + (sample.label || sample.id) + '"? This cannot be undone.')) {
                global.GAIP_SampleManager.deleteSample(dataType, sample.id);
                updateSampleSelector(wrapper, dataType);
                updateSampleInfo(wrapper, dataType);
            }
        });
        dialog.querySelector('.gaip-edit-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    /**
     * Open zone picker dialog for a sample.
     */
    function openZonePicker(sample, dataType, wrapper) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10002;display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:var(--gaip-surface);border-radius:10px;padding:20px;min-width:260px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.25);';
        dialog.innerHTML = '<div style="font-weight:600;margin-bottom:4px;font-size:14px;">Change Zone Type</div>' +
            '<div style="font-size:12px;color:var(--gaip-text-secondary);margin-bottom:12px;">' + (sample.label || sample.id) + '</div>';

        const select = document.createElement('select');
        select.style.cssText = 'width:100%;padding:8px;border:1px solid var(--gaip-border);border-radius:6px;font-size:14px;margin-bottom:16px;';
        Object.keys(ZONE_LABELS).forEach(zk => {
            const opt = document.createElement('option');
            opt.value = zk;
            opt.textContent = ZONE_LABELS[zk].icon + '  ' + ZONE_LABELS[zk].label;
            if (zk === (sample.zoneType || 'other')) opt.selected = true;
            select.appendChild(opt);
        });
        dialog.appendChild(select);

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex;gap:8px;';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'flex:1;padding:9px;border:1px solid var(--gaip-border);border-radius:6px;background:var(--gaip-surface-muted);cursor:pointer;font-size:13px;';
        cancelBtn.onclick = () => overlay.remove();
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = 'flex:1;padding:9px;border:1px solid #86efac;border-radius:6px;background:var(--gaip-good-bg);cursor:pointer;font-size:13px;font-weight:600;color:#16a34a;';
        applyBtn.onclick = () => {
            global.GAIP_SampleManager.setZoneType(dataType, sample.id, select.value);
            overlay.remove();
            updateSampleSelector(wrapper, dataType);
            updateQuickButtons(wrapper, dataType);
            updateSampleInfo(wrapper, dataType);
        };
        btns.appendChild(cancelBtn);
        btns.appendChild(applyBtn);
        dialog.appendChild(btns);
        overlay.appendChild(dialog);
        overlay.onclick = (ev) => { if (ev.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }

    /**
     * Update sample info display
     */
    function updateSampleInfo(wrapper, dataType) {
        const infoDiv = wrapper.querySelector('.gaip-sample-info');
        const sample = global.GAIP_SampleManager.getActiveSample(dataType);

        if (!sample) {
            infoDiv.innerHTML = '';
            return;
        }

        const zoneInfo = ZONE_LABELS[sample.zoneType] || ZONE_LABELS.other;

        // b35fix367 — multi-site turf state for the active site governs whether
        // the "Set turf profile…" button renders and whether the override chip
        // shows. Only soil samples carry per-sample turf overrides — water and
        // tissue samples don't independently re-key turf identity.
        var _b367_multiOn = false;
        try {
            var _SC367 = global.GAIP_SiteConfig;
            if (_SC367 && typeof _SC367.isMultiSiteTurfEnabled === 'function') {
                _b367_multiOn = !!_SC367.isMultiSiteTurfEnabled();
            }
        } catch (e) { /* defensive */ }
        var _b367_sampleProfile = null;
        if (_b367_multiOn && dataType === 'soil') {
            try {
                _b367_sampleProfile = global.GAIP_SampleManager.getSampleTurfProfile
                    ? global.GAIP_SampleManager.getSampleTurfProfile(dataType, sample.id)
                    : null;
            } catch (e) { /* defensive */ }
        }
        var _b367_chipHtml = '';
        if (_b367_sampleProfile) {
            var chipParts = [];
            if (_b367_sampleProfile.species) chipParts.push(_b367_sampleProfile.species);
            if (_b367_sampleProfile.variety) chipParts.push(_b367_sampleProfile.variety);
            if (_b367_sampleProfile.companionSpecies) chipParts.push('+ ' + _b367_sampleProfile.companionSpecies);
            _b367_chipHtml = '<div class="gaip-sample-info-row" style="margin-top:4px;">' +
                '<span class="gaip-sample-info-label">Turf override:</span>' +
                '<span class="gaip-sample-info-value">' +
                '<span class="zone-badge" style="background-color:#10b981;color:white;">🌱 ' +
                (chipParts.length ? chipParts.join(' · ') : 'set') + '</span>' +
                '</span>' +
                '</div>';
        }
        var _b367_buttonHtml = (_b367_multiOn && dataType === 'soil')
            ? '<button type="button" class="gaip-sample-turfprofile-btn" title="Override turf type / species / variety for this sample" style="font-size: 11px; padding: 3px 8px; border: 1px solid #10b981; border-radius: 3px; background: var(--gaip-good-bg, rgba(16,185,129,0.1)); cursor: pointer; color: #10b981; font-weight: 600;">🌱 Set turf profile…</button>'
            : '';

        infoDiv.innerHTML = `
            <div class="gaip-sample-info-row">
                <span class="gaip-sample-info-label">Zone Type:</span>
                <span class="gaip-sample-info-value">
                    <span class="zone-badge" style="background-color: ${zoneInfo.color}">
                        ${zoneInfo.icon} ${zoneInfo.label}
                    </span>
                </span>
            </div>
            <div class="gaip-sample-info-row">
                <span class="gaip-sample-info-label">Sample Date:</span>
                <span class="gaip-sample-info-value">${sample.date}</span>
            </div>
            ${sample.notes ? `
            <div class="gaip-sample-info-row">
                <span class="gaip-sample-info-label">Notes:</span>
                <span class="gaip-sample-info-value">${sample.notes}</span>
            </div>
            ` : ''}
            ${_b367_chipHtml}
            <div class="gaip-sample-info-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--gaip-surface-hover); display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="gaip-sample-update-btn" title="Overwrite this sample with current form values" style="font-size: 11px; padding: 3px 8px; border: 1px solid #86efac; border-radius: 3px; background: var(--gaip-good-bg); cursor: pointer; color: #16a34a; font-weight: 600;">&#128190; Update</button>
                <button type="button" class="gaip-sample-zone-btn" title="Change zone type" style="font-size: 11px; padding: 3px 8px; border: 1px solid var(--gaip-info-bg); border-radius: 3px; background: var(--gaip-info-bg); cursor: pointer; color: #2563eb;">&#128204; Zone</button>
                ${_b367_buttonHtml}
                <button type="button" class="gaip-sample-rename-btn" title="Rename this sample" style="font-size: 11px; padding: 3px 8px; border: 1px solid var(--gaip-border); border-radius: 3px; background: var(--gaip-surface-muted); cursor: pointer; color: var(--gaip-text-secondary);">\u270F\uFE0F Rename</button>
                <button type="button" class="gaip-sample-delete-btn" title="Delete this sample" style="font-size: 11px; padding: 3px 8px; border: 1px solid #fca5a5; border-radius: 3px; background: var(--gaip-critical-bg); cursor: pointer; color: #dc2626;">\u2716 Delete</button>
            </div>
        `;

        // Wire update button — overwrites THIS sample's values with current form values.
        // Captures a snapshot of the active sample ID at render time so we always
        // write to the correct sample even if the user switches after the panel renders.
        const updateBtn = infoDiv.querySelector('.gaip-sample-update-btn');
        const updateTargetId = sample.id;  // freeze the target at render time
        if (updateBtn) {
            updateBtn.addEventListener('click', function() {
                try {
                    const SM = global.GAIP_SampleManager;
                    const newValues = SM.captureRawForm ? SM.captureRawForm(dataType) : null;
                    if (!newValues || Object.keys(newValues).length === 0) {
                        alert('No values found in form. Load the sample first, then edit and Update.');
                        return;
                    }
                    SM.updateSample(dataType, updateTargetId, newValues);
                    // Flash feedback
                    const orig = updateBtn.textContent;
                    updateBtn.textContent = '\u2713 Saved';
                    updateBtn.style.background = 'var(--gaip-good-bg)';
                    setTimeout(function() {
                        updateBtn.textContent = orig;
                        updateBtn.style.background = 'var(--gaip-good-bg)';
                    }, 2000);
                } catch (err) {
                    alert('Update failed: ' + err.message);
                }
            });
        }

        // Wire zone button in info panel
        const zoneBtn = infoDiv.querySelector('.gaip-sample-zone-btn');
        if (zoneBtn) {
            zoneBtn.addEventListener('click', function() {
                openZonePicker(sample, dataType, wrapper);
            });
        }

        // Wire rename button
        const renameBtn = infoDiv.querySelector('.gaip-sample-rename-btn');
        if (renameBtn) {
            renameBtn.addEventListener('click', function() {
                const newName = prompt('Rename sample "' + (sample.label || sample.id) + '" to:', sample.label || sample.id);
                if (newName && newName.trim() && newName.trim() !== sample.id) {
                    const result = global.GAIP_SampleManager.renameSample(dataType, sample.id, newName.trim());
                    if (result) {
                        updateSampleSelector(wrapper, dataType);
                        updateSampleInfo(wrapper, dataType);
                    } else {
                        alert('Rename failed. A sample with that name may already exist.');
                    }
                }
            });
        }

        // Wire delete button
        const deleteBtn = infoDiv.querySelector('.gaip-sample-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                if (confirm('Delete sample "' + (sample.label || sample.id) + '"? This cannot be undone.')) {
                    global.GAIP_SampleManager.deleteSample(dataType, sample.id);
                    updateSampleSelector(wrapper, dataType);
                    updateSampleInfo(wrapper, dataType);
                }
            });
        }

        // b35fix367 — wire Set turf profile button (renders only when multi-site
        // turf is on for the active site and dataType === 'soil').
        const turfProfileBtn = infoDiv.querySelector('.gaip-sample-turfprofile-btn');
        if (turfProfileBtn) {
            turfProfileBtn.addEventListener('click', function () {
                if (!global.GaipSampleTurfProfileModal ||
                    typeof global.GaipSampleTurfProfileModal.open !== 'function') {
                    console.warn('[SampleSwitcher] GaipSampleTurfProfileModal not loaded');
                    return;
                }
                global.GaipSampleTurfProfileModal.open(dataType, sample.id, function (newProfile) {
                    // Re-render the card to reflect the new override chip state
                    updateSampleInfo(wrapper, dataType);
                    // If sample is currently active and multi-site turf is on,
                    // re-load to apply the override into GaipTurfProfile.state
                    // and fire the species-change cascade.
                    try {
                        global.GAIP_SampleManager.loadSample(dataType, sample.id);
                    } catch (e) { /* defensive */ }
                });
            });
        }
    }

    // =========================================================================
    // COMPARISON MODAL
    // =========================================================================

    /**
     * Create comparison view modal
     */
    function createComparisonModal(dataType) {
        const samples = global.GAIP_SampleManager.getSamples(dataType);
        if (samples.length < 2) {
            alert('Need at least 2 samples to compare');
            return;
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'gaip-modal-overlay';
        overlay.innerHTML = `
            <div class="gaip-modal gaip-comparison-modal">
                <div class="gaip-modal-header">
                    <h3>Compare ${capitalize(dataType)} Samples</h3>
                    <button class="gaip-modal-close">×</button>
                </div>
                <div class="gaip-modal-body">
                    <div class="gaip-comparison-sample-select">
                        <p>Select samples to compare (2-6):</p>
                        <div class="gaip-comparison-checkboxes"></div>
                        <button class="gaip-compare-btn">Compare Selected</button>
                    </div>
                    <div class="gaip-comparison-results"></div>
                </div>
            </div>
        `;

        // Populate checkboxes
        const checkboxContainer = overlay.querySelector('.gaip-comparison-checkboxes');
        samples.forEach(sample => {
            const zoneInfo = ZONE_LABELS[sample.zoneType] || ZONE_LABELS.other;
            const label = document.createElement('label');
            label.className = 'gaip-comparison-checkbox-label';
            label.innerHTML = `
                <input type="checkbox" value="${sample.id}">
                <span class="zone-icon">${zoneInfo.icon}</span>
                <span>${sample.id}</span>
            `;
            checkboxContainer.appendChild(label);
        });

        // Close button
        overlay.querySelector('.gaip-modal-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        // Compare button
        overlay.querySelector('.gaip-compare-btn').onclick = () => {
            const selected = Array.from(overlay.querySelectorAll('input:checked'))
                .map(cb => cb.value);

            if (selected.length < 2) {
                alert('Select at least 2 samples');
                return;
            }
            if (selected.length > 6) {
                alert('Select at most 6 samples');
                return;
            }

            const comparison = global.GAIP_SampleManager.compareSamples(dataType, selected);
            renderComparisonResults(overlay.querySelector('.gaip-comparison-results'), comparison, dataType);
        };

        document.body.appendChild(overlay);
    }

    /**
     * Render comparison results table
     */
    function renderComparisonResults(container, comparison, dataType) {
        if (comparison.error) {
            container.innerHTML = `<p class="error">${comparison.error}</p>`;
            return;
        }

        // Build table header with sample names
        let headerHtml = '<th>Parameter</th>';
        comparison.samples.forEach(s => {
            const zoneInfo = ZONE_LABELS[s.zoneType] || ZONE_LABELS.other;
            headerHtml += `<th><span class="zone-icon">${zoneInfo.icon}</span> ${s.id}</th>`;
        });
        headerHtml += '<th>Min</th><th>Max</th><th>Avg</th><th>CV%</th>';

        // Build table rows
        let rowsHtml = '';
        const paramOrder = getParamOrder(dataType);

        paramOrder.forEach(param => {
            const data = comparison.parameters[param];
            if (!data) return;

            rowsHtml += `<tr>`;
            rowsHtml += `<td class="param-name">${getParamLabel(param, dataType)}</td>`;

            // Sample values with min/max highlighting
            data.values.forEach(v => {
                let cellClass = '';
                if (v.value !== null) {
                    if (v.value === data.min) cellClass = 'cell-min';
                    if (v.value === data.max) cellClass = 'cell-max';
                }
                rowsHtml += `<td class="${cellClass}">${formatValue(v.value, param)}</td>`;
            });

            // Statistics
            rowsHtml += `<td class="stat-cell">${formatValue(data.min, param)}</td>`;
            rowsHtml += `<td class="stat-cell">${formatValue(data.max, param)}</td>`;
            rowsHtml += `<td class="stat-cell">${formatValue(data.avg, param)}</td>`;
            rowsHtml += `<td class="stat-cell cv-cell ${getCVClass(data.cv)}">${data.cv !== null ? data.cv.toFixed(1) + '%' : '-'}</td>`;
            rowsHtml += `</tr>`;
        });

        container.innerHTML = `
            <table class="gaip-comparison-table">
                <thead><tr>${headerHtml}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            <div class="gaip-comparison-legend">
                <span class="legend-item"><span class="cell-min-sample"></span> Lowest</span>
                <span class="legend-item"><span class="cell-max-sample"></span> Highest</span>
                <span class="legend-item">CV = Coefficient of Variation (variability between samples)</span>
            </div>
        `;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    function capitalize(s) {
        // Special case for LOI - display as "LOI/Stratified OM"
        if (s === 'loi') return 'LOI';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function truncate(s, len) {
        return s.length > len ? s.slice(0, len - 1) + '…' : s;
    }

    function formatValue(val, param) {
        if (val === null || val === undefined) return '-';
        if (typeof val !== 'number') return val;

        // Format based on typical value ranges
        if (val >= 100) return val.toFixed(0);
        if (val >= 10) return val.toFixed(1);
        return val.toFixed(2);
    }

    function getCVClass(cv) {
        if (cv === null) return '';
        if (cv < 10) return 'cv-low';
        if (cv < 25) return 'cv-medium';
        return 'cv-high';
    }

    function getParamOrder(dataType) {
        switch (dataType) {
            case 'soil':
                return ['soil_ph', 'soil_ec', 'cec', 'loi', 'loi_0_2', 'loi_2_4', 'loi_4_6', 'K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Cu', 'Zn', 'B', 'Na'];
            case 'water':
                return ['water_ph', 'ecw', 'Ca', 'Mg', 'Na', 'K', 'Cl', 'SO4', 'HCO3', 'CO3', 'B', 'Fe', 'Mn', 'NO3', 'PO4'];
            case 'tissue':
                return ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B', 'Mo', 'Na', 'Cl'];
            case 'loi':
                return ['loi', 'loi_0_2', 'loi_2_4', 'loi_4_6'];
            default:
                return [];
        }
    }

    function getParamLabel(param, dataType) {
        const labels = {
            soil_ph: 'pH', soil_ec: 'EC (dS/m)', cec: 'CEC (meq/100g)', loi: 'OM (%)',
            // Stratified OM labels
            loi_0_2: 'OM 0-2cm (%)', loi_2_4: 'OM 2-4cm (%)', loi_4_6: 'OM 4-6cm (%)',
            water_ph: 'pH', ecw: 'EC (dS/m)',
            N: 'Nitrogen (%)', P: 'Phosphorus', K: 'Potassium', Ca: 'Calcium', Mg: 'Magnesium',
            S: 'Sulphur', Fe: 'Iron', Mn: 'Manganese', Cu: 'Copper', Zn: 'Zinc', B: 'Boron',
            Na: 'Sodium', Mo: 'Molybdenum', Cl: 'Chloride', HCO3: 'Bicarbonate', CO3: 'Carbonate',
            SO4: 'Sulphate', NO3: 'Nitrate', PO4: 'Phosphate'
        };
        return labels[param] || param;
    }

    // =========================================================================
    // SITE SELECTOR
    // =========================================================================

    /**
     * Create the site selector bar.
     * Sits above all sample switchers.
     */
    function createSiteSelector() {
        var sm = global.GAIP_SampleManager;
        if (!sm || typeof sm.getSiteList !== 'function') return null;

        var container = document.createElement('div');
        container.className = 'gaip-site-selector';

        function render() {
            var sites = sm.getSiteList();
            var activeSiteId = sm.getActiveSiteId();

            var optionsHtml = '';
            for (var i = 0; i < sites.length; i++) {
                var sel = sites[i].id === activeSiteId ? ' selected' : '';
                optionsHtml += '<option value="' + sites[i].id + '"' + sel + '>' +
                    escapeHtml(sites[i].label) + '</option>';
            }

            container.innerHTML =
                '<div class="gaip-site-selector-row">' +
                    '<label class="gaip-site-selector-label">' +
                        '<span class="gaip-site-icon">\uD83C\uDFCC\uFE0F</span> Site:' +
                    '</label>' +
                    '<select class="gaip-site-select">' + optionsHtml + '</select>' +
                    '<button class="gaip-site-add-btn" title="Add new site">+</button>' +
                    '<button class="gaip-site-rename-btn" title="Rename current site">\u270F</button>' +
                    '<button class="gaip-site-delete-btn" title="Delete current site">\u2716</button>' +
                '</div>';

            // Wire events
            var select = container.querySelector('.gaip-site-select');
            select.addEventListener('change', function() {
                sm.setActiveSite(this.value);
            });

            container.querySelector('.gaip-site-add-btn').addEventListener('click', function() {
                var name = prompt('Enter site name (e.g. "Royal Melbourne GC"):');
                if (name && name.trim()) {
                    var newId = sm.addSite(name.trim());
                    sm.setActiveSite(newId);
                }
            });

            container.querySelector('.gaip-site-rename-btn').addEventListener('click', function() {
                var current = sm.getActiveSiteLabel();
                var name = prompt('Rename site:', current);
                if (name && name.trim() && name.trim() !== current) {
                    sm.renameSite(sm.getActiveSiteId(), name.trim());
                    render();
                }
            });

            container.querySelector('.gaip-site-delete-btn').addEventListener('click', function() {
                var id = sm.getActiveSiteId();
                if (id === 'default') {
                    alert('Cannot delete the default site.');
                    return;
                }
                var label = sm.getActiveSiteLabel();
                if (confirm('Delete site "' + label + '" and all its samples?')) {
                    sm.removeSite(id);
                }
            });
        }

        render();

        // Re-render on site events
        document.addEventListener('gaip:site-changed', function() { render(); });
        document.addEventListener('gaip:site-added', function() { render(); });
        document.addEventListener('gaip:site-removed', function() { render(); });

        return container;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // =========================================================================
    // AUTO-INJECT INTO HUB
    // =========================================================================

    function init() {
        log('Sample Switcher UI v' + CONFIG.version + ' initializing...');

        // Wait for DOM and SampleManager
        if (!global.GAIP_SampleManager) {
            warn('SampleManager not loaded, retrying in 500ms');
            setTimeout(init, 500);
            return;
        }

        // Per-mount injection — each mount point checked independently (b35fix139)
        // Previously a single global guard caused water/tissue/LOI to be skipped on retries

        // Inject site selector + soil switcher into soil card mount point
        const soilMount = document.querySelector('.gaip-soil-switcher-mount');
        if (soilMount && !soilMount.querySelector('.gaip-sample-switchers-container')) {
            const soilContainer = document.createElement('div');
            soilContainer.className = 'gaip-sample-switchers-container';
            const siteSelector = createSiteSelector();
            if (siteSelector) soilContainer.appendChild(siteSelector);
            soilContainer.appendChild(createSampleSwitcher('soil'));
            soilMount.appendChild(soilContainer);
            log('Injected soil switcher');
        }

        // Inject water switcher into water card mount point
        const waterMount = document.querySelector('.gaip-water-switcher-mount');
        if (waterMount && !waterMount.querySelector('.gaip-sample-switcher')) {
            const waterSwitcher = createSampleSwitcher('water');
            waterMount.appendChild(waterSwitcher);
            log('Injected water switcher');
        }

        // Inject LOI switcher near stratified OM section (soil card)
        const stratifiedSection = document.querySelector('.gaip-stratified-om-section');
        if (stratifiedSection && !stratifiedSection.querySelector('.gaip-sample-switcher[data-type="loi"]')) {
            const loiSwitcher = createSampleSwitcher('loi');
            loiSwitcher.style.marginTop = '8px';
            const loiBody = stratifiedSection.querySelector('.gaip-collapsible-body');
            if (loiBody) {
                loiBody.insertBefore(loiSwitcher, loiBody.firstChild);
            } else {
                stratifiedSection.insertBefore(loiSwitcher, stratifiedSection.firstChild);
            }
            log('Injected LOI switcher');
        }

        // Inject switcher into Tissue section
        const tissueModule = document.querySelector('#gaipTissueModule');
        if (tissueModule && !tissueModule.querySelector('.gaip-sample-switcher[data-type="tissue"]')) {
            setTimeout(() => {
                const tissueCard = tissueModule.querySelector('.gaip-card-head');
                if (tissueCard && !tissueCard.querySelector('.gaip-sample-switcher')) {
                    tissueCard.appendChild(createSampleSwitcher('tissue'));
                    log('Injected tissue switcher');
                }
            }, 500);
        }

        // v1.1.0: Reset switcher UI when samples are cleared
        function resetSwitcherUI(dataType) {
            const wrapper = document.querySelector(`.gaip-sample-switcher[data-type="${dataType}"]`);
            if (wrapper) {
                updateSampleSelector(wrapper, dataType);
                updateSampleInfo(wrapper, dataType);
                // Clear import status badge
                const importStatus = wrapper.querySelector('.gaip-sample-import-status');
                if (importStatus) {
                    importStatus.textContent = '';
                    importStatus.className = 'gaip-sample-import-status';
                }
                log('Switcher UI reset for: ' + dataType);
            }
        }

        document.addEventListener('gaip:samples-cleared', function(e) {
            const dt = e.detail?.dataType;
            if (dt) {
                resetSwitcherUI(dt);
            }
        });

        document.addEventListener('gaip:all-samples-cleared', function() {
            ['soil', 'water', 'tissue', 'loi'].forEach(resetSwitcherUI);
        });

        document.addEventListener('gaip:soil-data-cleared', function() {
            resetSwitcherUI('soil');
        });

        document.addEventListener('gaip:waterDataCleared', function() {
            resetSwitcherUI('water');
        });

        // Site change: refresh all switcher dropdowns
        // Skip during combined export to prevent 8x rapid rebuilds destroying switcher state
        document.addEventListener('gaip:site-changed', function() {
            if (global.GAIP_COMBINED_EXPORT_ACTIVE) return;
            log('Site changed, refreshing all switcher UIs');
            ['soil', 'water', 'tissue', 'loi'].forEach(function(dt) {
                var wrapper = document.querySelector('.gaip-sample-switcher[data-type="' + dt + '"]');
                if (wrapper) {
                    updateSampleSelector(wrapper, dt);
                    updateSampleInfo(wrapper, dt);
                }
            });
        });

        log('Sample Switcher UI initialized');
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 200);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_SampleSwitcherUI = {
        createSwitcher: createSampleSwitcher,
        createComparisonModal,
        version: CONFIG.version,
        // b35fix139: exposed for post-export re-injection
        reinit: function() {
            // Force re-injection of any missing switchers
            var soilMount = document.querySelector('.gaip-soil-switcher-mount');
            if (soilMount && !soilMount.querySelector('.gaip-sample-switchers-container')) {
                init();
                return;
            }
            // Switchers exist — just refresh their content
            ['soil', 'water', 'tissue', 'loi'].forEach(function(dt) {
                var wrapper = document.querySelector('.gaip-sample-switcher[data-type="' + dt + '"]');
                if (wrapper) {
                    updateSampleSelector(wrapper, dt);
                    updateSampleInfo(wrapper, dt);
                }
            });
        }
    };

})(window);
