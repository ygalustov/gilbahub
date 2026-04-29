/**
 * =============================================================================
 * GAIP Lab Report Parser v1.0.0
 * Upload lab reports (PDF/DOCX) → AI extraction → confirmation → populate hub
 * =============================================================================
 * 
 * Workflow:
 *   1. User clicks "Import Lab Report" → file picker (PDF/DOCX)
 *   2. File sent to server → Claude extracts structured data
 *   3. Confirmation table shown with confidence indicators
 *   4. User confirms → SampleManager.addSample() + loadSample()
 * 
 * Dependencies: sample-manager.js, hub-tissue-v3.js
 * @version 1.0.0
 * @since 10.6.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        ajaxUrl: (typeof ajaxurl !== 'undefined') ? ajaxurl : '/wp-admin/admin-ajax.php',
        nonce: null,  // Set from wp_localize_script
        maxFileSize: 10 * 1024 * 1024,  // 10MB
        allowedExtensions: ['pdf', 'docx', 'txt', 'csv'],
        confidenceThresholds: {
            high: 85,
            medium: 60
        }
    };

    // Try to get nonce from localized data
    if (global.gaipLabParser) {
        CONFIG.nonce = global.gaipLabParser.nonce;
        CONFIG.ajaxUrl = global.gaipLabParser.ajaxUrl || CONFIG.ajaxUrl;
    }
    // Fallback: get from existing hub nonce
    if (!CONFIG.nonce && global.gaipAjax) {
        CONFIG.nonce = global.gaipAjax.nonce;
    }

    // =========================================================================
    // STATE
    // =========================================================================

    let _state = {
        parsing: false,
        lastResult: null,
        selectedSamples: { soil: [], water: [], tissue: [] }
    };

    // =========================================================================
    // FILE UPLOAD & PARSING
    // =========================================================================

    /**
     * Open file picker and start parsing
     * @param {string} [contextDataType] - 'soil' | 'water' | 'tissue', set by the
     *   click handler so CSVs can be routed straight to SampleManager.importFile()
     *   without the AI roundtrip. Falls back to 'auto' detection (server-side AI)
     *   when not supplied — preserves the legacy generic-button behaviour.
     */
    function openFilePicker(contextDataType) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.docx,.doc,.txt,.csv';
        input.style.display = 'none';
        
        input.addEventListener('change', function() {
            if (input.files.length > 0) {
                parseFile(input.files[0], contextDataType || null);
            }
            input.remove();
        });
        
        document.body.appendChild(input);
        input.click();
    }

    /**
     * Parse an uploaded file
     * @param {File}   file
     * @param {string} [contextDataType] - 'soil' | 'water' | 'tissue' from the
     *   originating button. b35fix376: when supplied AND the file is a CSV,
     *   we route through SampleManager.importFile() instead of the AI path.
     *   The local importer handles extraction-method-suffixed nutrient column
     *   names (K_Mehlich3, P_Olsen, Ca_Colwell etc), per-sample turf_species,
     *   and per-sample area_ha — none of which the AI prompt was hardened
     *   for, and all of which CSVs frequently carry. PDF/DOCX continue to
     *   use the AI path.
     */
    async function parseFile(file, contextDataType) {
        // Validate
        const ext = file.name.split('.').pop().toLowerCase();
        if (!CONFIG.allowedExtensions.includes(ext)) {
            showError('Unsupported file type: .' + ext + '. Use PDF, DOCX, TXT, or CSV.');
            return;
        }
        
        if (file.size > CONFIG.maxFileSize) {
            showError('File too large. Maximum size is 10MB.');
            return;
        }

        // ── b35fix376 LOCAL CSV BRANCH ──────────────────────────────────────
        // CSVs from a context-tagged button (#gaip-soil-pdf-import-btn etc)
        // bypass the AI roundtrip entirely. SampleManager.importFile() does
        // its own header detection, multi-row import, turf_species cascade,
        // and area_ha capture — and now (b35fix376) recognises the
        // extraction-method-suffixed nutrient headers via the extended
        // SOIL_FIELD_MAP. Falling through to the AI path on validation
        // failure is intentional only for files without dataType context;
        // a known-soil CSV that the local importer rejects should error,
        // not silently retry against the AI validator that already failed.
        if (ext === 'csv' && contextDataType) {
            const SM = global.GAIP_SampleManager || global.SampleManager || global.GilbaSampleManager;
            if (SM && typeof SM.importFile === 'function') {
                console.log('[LabParser b35fix376] Routing CSV to local importer (dataType=' +
                    contextDataType + ', file=' + file.name + ')');
                _state.parsing = true;
                showParsingUI(file.name);
                try {
                    const result = await SM.importFile(file, { dataType: contextDataType });
                    _state.parsing = false;
                    showLocalImportResult(result, file.name);
                    return;
                } catch (err) {
                    _state.parsing = false;
                    console.error('[LabParser b35fix376] Local CSV import failed:', err);
                    showError('CSV import failed: ' + (err && err.message ? err.message : err) +
                              ' — check column headers match the template.');
                    return;
                }
            }
            // SampleManager not available — fall through to AI path with a warning
            console.warn('[LabParser b35fix376] SampleManager.importFile unavailable; ' +
                'falling back to AI path for CSV');
        }

        console.log('[LabParser] Uploading:', file.name, '(' + (file.size / 1024).toFixed(1) + ' KB)');
        
        _state.parsing = true;
        showParsingUI(file.name);
        
        // Resolve nonce: try multiple sources
        const nonce = CONFIG.nonce || 
                     (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.nonce) || 
                     (global.gaipAjax && global.gaipAjax.nonce) || '';
        
        console.log('[LabParser] Nonce source:', 
            CONFIG.nonce ? 'gaipLabParser' : 
            (global.GAIP_HUB_CONFIG?.nonce ? 'GAIP_HUB_CONFIG' : 
            (global.gaipAjax?.nonce ? 'gaipAjax' : 'NONE')),
            'value:', nonce ? nonce.substring(0, 6) + '...' : 'EMPTY');
        
        const ajaxUrl = CONFIG.ajaxUrl || 
                       (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.ajaxUrl) ||
                       '/wp-admin/admin-ajax.php';
        
        try {
            const formData = new FormData();
            formData.append('action', 'gilba_parse_lab_report');
            formData.append('nonce', nonce);
            formData.append('lab_report', file);
            
            console.log('[LabParser] Sending to:', ajaxUrl);
            
            const response = await fetch(ajaxUrl, {
                method: 'POST',
                body: formData
            });
            
            console.log('[LabParser] Response status:', response.status);
            
            const result = await response.json();
            
            console.log('[LabParser] Result:', result.success ? 'SUCCESS' : 'FAIL', 
                result.success ? result.data : (result.data?.message || JSON.stringify(result.data)));
            
            _state.parsing = false;
            
            if (result.success) {
                _state.lastResult = result.data;
                showConfirmationUI(result.data);
            } else {
                showError(result.data?.message || 'Parsing failed');
            }
        } catch (err) {
            _state.parsing = false;
            console.error('[LabParser] Error:', err);
            showError('Network error: ' + err.message);
        }
    }

    // =========================================================================
    // UI RENDERING
    // =========================================================================

    function getOrCreateContainer() {
        let container = document.getElementById('gaip-lab-parser-panel');
        if (!container) {
            container = document.createElement('div');
            container.id = 'gaip-lab-parser-panel';
            container.className = 'gaip-lab-parser-panel';
            
            // Insert after site dashboard or at top of hub
            const dashboard = document.querySelector('.gaip-site-dashboard');
            const hub = document.querySelector('.gaip-hub-container');
            if (dashboard && dashboard.parentNode) {
                dashboard.parentNode.insertBefore(container, dashboard.nextSibling);
            } else if (hub) {
                hub.insertBefore(container, hub.firstChild);
            } else {
                document.body.appendChild(container);
            }
        }
        return container;
    }

    function showParsingUI(filename) {
        const container = getOrCreateContainer();
        container.innerHTML = `
            <div class="gaip-lab-parser-content">
                <div class="gaip-lab-parsing-status">
                    <div class="gaip-lab-spinner"></div>
                    <div>
                        <strong>Extracting data from ${escapeHtml(filename)}</strong>
                        <p>AI is reading and extracting soil, water, and tissue results...</p>
                    </div>
                </div>
            </div>
        `;
        container.style.display = 'block';
    }

    function showError(message) {
        const container = getOrCreateContainer();
        container.innerHTML = `
            <div class="gaip-lab-parser-content">
                <div class="gaip-lab-error">
                    <strong>Import Error</strong>
                    <p>${escapeHtml(message)}</p>
                    <button class="gaip-btn gaip-btn-sm" onclick="GAIP_LabParser.openFilePicker()">Try Again</button>
                    <button class="gaip-btn gaip-btn-sm gaip-btn-ghost" onclick="GAIP_LabParser.close()">Close</button>
                </div>
            </div>
        `;
        container.style.display = 'block';
    }

    function showConfirmationUI(data) {
        const container = getOrCreateContainer();
        
        const soilCount = (data.soil || []).length;
        const waterCount = (data.water || []).length;
        const tissueCount = (data.tissue || []).length;
        const totalCount = soilCount + waterCount + tissueCount;
        
        if (totalCount === 0) {
            container.innerHTML = `
                <div class="gaip-lab-parser-content">
                    <div class="gaip-lab-error">
                        <strong>No Results Found</strong>
                        <p>The AI could not find any soil, water, or tissue test results in this document.</p>
                        ${data.extraction_notes ? `<p class="gaip-lab-notes">${escapeHtml(data.extraction_notes)}</p>` : ''}
                        <button class="gaip-btn gaip-btn-sm" onclick="GAIP_LabParser.openFilePicker()">Try Another File</button>
                        <button class="gaip-btn gaip-btn-sm gaip-btn-ghost" onclick="GAIP_LabParser.close()">Close</button>
                    </div>
                </div>
            `;
            container.style.display = 'block';
            return;
        }
        
        // Select all by default
        // Split soil into standard and cotula S78 for separate selection tracking
        const _cotulaSoil = (data.soil || []).filter(s => s.is_cotula_s78 || s.zone === 'cotula_bowling_green');
        const _standardSoil = (data.soil || []).filter(s => !s.is_cotula_s78 && s.zone !== 'cotula_bowling_green');
        _state.selectedSamples = {
            soil:        _standardSoil.map((_, i) => i),
            soil_cotula: _cotulaSoil.map((_, i) => i),
            water:       (data.water || []).map((_, i) => i),
            tissue:      (data.tissue || []).map((_, i) => i)
        };
        
        let html = `
            <div class="gaip-lab-parser-content">
                <div class="gaip-lab-header">
                    <div>
                        <strong>Lab Report Extracted</strong>
                        <span class="gaip-lab-filename">${escapeHtml(data.filename || '')}</span>
                    </div>
                    <div class="gaip-lab-summary">
                        ${soilCount ? `<span class="gaip-lab-badge soil">${soilCount} soil</span>` : ''}
                        ${waterCount ? `<span class="gaip-lab-badge water">${waterCount} water</span>` : ''}
                        ${tissueCount ? `<span class="gaip-lab-badge tissue">${tissueCount} tissue</span>` : ''}
                    </div>
                </div>
        `;
        
        if (data.document_info?.lab_name || data.document_info?.site_name) {
            html += `<div class="gaip-lab-doc-info">`;
            if (data.document_info.lab_name) html += `<span>Lab: ${escapeHtml(data.document_info.lab_name)}</span>`;
            if (data.document_info.site_name) html += `<span>Site: ${escapeHtml(data.document_info.site_name)}</span>`;
            if (data.document_info.report_date) html += `<span>Date: ${escapeHtml(data.document_info.report_date)}</span>`;
            html += `</div>`;
        }
        
        // Render each category
        // Soil: split standard vs cotula S78 samples into separate tables
        if (soilCount > 0) {
            const cotulaSamples = data.soil.filter(s => s.is_cotula_s78 || s.zone === 'cotula_bowling_green');
            const standardSamples = data.soil.filter(s => !s.is_cotula_s78 && s.zone !== 'cotula_bowling_green');
            if (standardSamples.length > 0) {
                html += renderSampleCategory('soil', standardSamples, SOIL_DISPLAY_CONFIG);
            }
            if (cotulaSamples.length > 0) {
                // Remap values to top-level for table rendering
                const remapped = cotulaSamples.map(s => ({
                    ...s,
                    values: _extractS78Values(s)
                }));
                html += renderSampleCategory('soil_cotula', remapped, COTULA_S78_DISPLAY_CONFIG);
            }
        }
        if (waterCount > 0) html += renderSampleCategory('water', data.water, WATER_DISPLAY_CONFIG);
        if (tissueCount > 0) html += renderSampleCategory('tissue', data.tissue, TISSUE_DISPLAY_CONFIG);
        
        if (data.extraction_notes) {
            html += `<div class="gaip-lab-notes"><em>AI notes: ${escapeHtml(data.extraction_notes)}</em></div>`;
        }
        
        html += `
                <div class="gaip-lab-actions">
                    <button class="gaip-btn gaip-btn-primary" onclick="GAIP_LabParser.importSelected()">
                        Import Selected (${totalCount})
                    </button>
                    <button class="gaip-btn gaip-btn-ghost" onclick="GAIP_LabParser.close()">Cancel</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        container.style.display = 'block';
    }

    // =========================================================================
    // DISPLAY CONFIGS (column labels for confirmation tables)
    // =========================================================================

    const SOIL_DISPLAY_CONFIG = {
        title: 'Soil Results',
        icon: '🪨',
        columns: {
            'pH_Water': { label: 'pH(w)', unit: '' },
            'pH_CaCl2': { label: 'pH(Ca)', unit: '' },
            'EC1_5': { label: 'EC 1:5', unit: 'dS/m' },
            'CEC_meq100g': { label: 'CEC', unit: 'meq' },
            'OM_Percent': { label: 'OM', unit: '%' },
            'P': { label: 'P', unit: 'ppm' },
            'K': { label: 'K', unit: 'ppm' },
            'Ca': { label: 'Ca', unit: 'ppm' },
            'Mg': { label: 'Mg', unit: 'ppm' },
            'S': { label: 'S', unit: 'ppm' },
            'Fe': { label: 'Fe', unit: 'ppm' },
            'Mn': { label: 'Mn', unit: 'ppm' },
            'Cu': { label: 'Cu', unit: 'ppm' },
            'Zn': { label: 'Zn', unit: 'ppm' },
            'B': { label: 'B', unit: 'ppm' },
            'Na': { label: 'Na', unit: 'ppm' }
        }
    };

    const WATER_DISPLAY_CONFIG = {
        title: 'Water Results',
        icon: '💧',
        columns: {
            'pH': { label: 'pH', unit: '' },
            'EC': { label: 'EC', unit: 'dS/m' },
            'Ca': { label: 'Ca', unit: 'mg/L' },
            'Mg': { label: 'Mg', unit: 'mg/L' },
            'Na': { label: 'Na', unit: 'mg/L' },
            'K': { label: 'K', unit: 'mg/L' },
            'Cl': { label: 'Cl', unit: 'mg/L' },
            'SO4': { label: 'SO₄', unit: 'mg/L' },
            'HCO3': { label: 'HCO₃', unit: 'mg/L' },
            'B': { label: 'B', unit: 'mg/L' }
        }
    };

    const TISSUE_DISPLAY_CONFIG = {
        title: 'Tissue Results',
        icon: '🌱',
        columns: {
            'N': { label: 'N', unit: '%' },
            'P': { label: 'P', unit: '%' },
            'K': { label: 'K', unit: '%' },
            'Ca': { label: 'Ca', unit: '%' },
            'Mg': { label: 'Mg', unit: '%' },
            'S': { label: 'S', unit: '%' },
            'Fe': { label: 'Fe', unit: 'ppm' },
            'Mn': { label: 'Mn', unit: 'ppm' },
            'Zn': { label: 'Zn', unit: 'ppm' },
            'Cu': { label: 'Cu', unit: 'ppm' },
            'B': { label: 'B', unit: 'ppm' }
        }
    };

    // =========================================================================
    // COTULA S78 DISPLAY CONFIG
    // Used for confirmation table when Hill Labs S78 (Turf Cotula) is detected.
    // Fields map directly to COTULA_S78_RANGES keys.
    // =========================================================================

    const COTULA_S78_DISPLAY_CONFIG = {
        title: 'Cotula Bowling Green — Hill Labs S78',
        icon: '🌿',
        columns: {
            'pH':         { label: 'pH',        unit: '' },
            'P_olsen':    { label: 'Olsen P',   unit: 'mg/L' },
            'K_pct_bs':   { label: 'K %BS',     unit: '%' },
            'K_me':       { label: 'K me/100g', unit: '' },
            'Ca_pct_bs':  { label: 'Ca %BS',    unit: '%' },
            'Mg_pct_bs':  { label: 'Mg %BS',    unit: '%' },
            'Na_pct_bs':  { label: 'Na %BS',    unit: '%' },
            'CEC':        { label: 'CEC',        unit: 'me/100g' },
            'TBS':        { label: 'Total BS',   unit: '%' },
            'VW':         { label: 'Vol Wt',     unit: 'g/mL' },
            'K_Mg_ratio': { label: 'K/Mg',       unit: '' }
        }
    };

    function renderSampleCategory(type, samples, config) {
        let html = `
            <div class="gaip-lab-category">
                <h4>${config.icon} ${config.title}</h4>
                <div class="gaip-lab-table-wrapper">
                    <table class="gaip-lab-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" checked onchange="GAIP_LabParser.toggleAll('${type}', this.checked)"></th>
                                <th>Sample</th>
                                <th>Date</th>
        `;
        
        const colKeys = Object.keys(config.columns);
        for (const key of colKeys) {
            html += `<th title="${key}">${config.columns[key].label}</th>`;
        }
        html += `<th>Conf.</th></tr></thead><tbody>`;
        
        samples.forEach((sample, idx) => {
            const conf = sample.confidence || 50;
            const confClass = conf >= CONFIG.confidenceThresholds.high ? 'high' : 
                             conf >= CONFIG.confidenceThresholds.medium ? 'medium' : 'low';
            
            html += `
                <tr>
                    <td><input type="checkbox" checked 
                        data-type="${type}" data-index="${idx}"
                        onchange="GAIP_LabParser.toggleSample('${type}', ${idx}, this.checked)"></td>
                    <td class="gaip-lab-label">${escapeHtml(sample.label || 'Sample ' + (idx + 1))}</td>
                    <td>${escapeHtml(sample.date || '-')}</td>
            `;
            
            for (const key of colKeys) {
                const val = sample.values?.[key];
                if (val !== undefined && val !== null) {
                    html += `<td class="gaip-lab-val">${val}</td>`;
                } else {
                    html += `<td class="gaip-lab-empty">-</td>`;
                }
            }
            
            html += `<td><span class="gaip-lab-conf ${confClass}">${conf}%</span></td>`;
            
            if (sample.notes) {
                html += `</tr><tr><td></td><td colspan="${colKeys.length + 3}" class="gaip-lab-note-row">${escapeHtml(sample.notes)}</td>`;
            }
            
            html += `</tr>`;
        });
        
        html += `</tbody></table></div></div>`;
        return html;
    }

    // =========================================================================
    // SELECTION MANAGEMENT
    // =========================================================================

    function toggleSample(type, index, checked) {
        if (checked) {
            if (!_state.selectedSamples[type].includes(index)) {
                _state.selectedSamples[type].push(index);
            }
        } else {
            _state.selectedSamples[type] = _state.selectedSamples[type].filter(i => i !== index);
        }
        updateImportCount();
    }

    function toggleAll(type, checked) {
        const data = _state.lastResult?.[type] || [];
        if (checked) {
            _state.selectedSamples[type] = data.map((_, i) => i);
        } else {
            _state.selectedSamples[type] = [];
        }
        // Update checkboxes
        document.querySelectorAll(`input[data-type="${type}"]`).forEach(cb => {
            cb.checked = checked;
        });
        updateImportCount();
    }

    function updateImportCount() {
        const total = _state.selectedSamples.soil.length + 
                     _state.selectedSamples.water.length + 
                     _state.selectedSamples.tissue.length;
        const btn = document.querySelector('.gaip-lab-actions .gaip-btn-primary');
        if (btn) {
            btn.textContent = `Import Selected (${total})`;
            btn.disabled = total === 0;
        }
    }

    // =========================================================================
    // IMPORT INTO HUB
    // =========================================================================

    function importSelected() {
        const data = _state.lastResult;
        if (!data) return;
        
        const SampleManager = global.GAIP_SampleManager || global.SampleManager || global.GilbaSampleManager;
        if (!SampleManager) {
            showError('SampleManager not available. Ensure the hub is fully loaded.');
            return;
        }
        
        const imported = { soil: 0, water: 0, tissue: 0 };
        const errors = [];
        
        // Import soil samples — route S78 cotula samples through S78 interpreter
        const allSoil = data.soil || [];
        const soilCotula = allSoil.filter(s => s.is_cotula_s78 || s.zone === 'cotula_bowling_green');
        const soilStandard = allSoil.filter(s => !s.is_cotula_s78 && s.zone !== 'cotula_bowling_green');
        const selectedSoilIndices = _state.selectedSamples.soil || [];
        const selectedS78Indices  = _state.selectedSamples.soil_cotula || [];

        for (const idx of selectedSoilIndices) {
            const sample = soilStandard[idx];
            if (!sample) continue;
            try {
                SampleManager.addSample('soil', {
                    label: sample.label,
                    date: sample.date,
                    zoneType: sample.zone || null,
                    notes: 'Imported from: ' + (data.filename || 'lab report'),
                    values: sample.values
                });
                imported.soil++;
            } catch (err) {
                errors.push('Soil "' + sample.label + '": ' + err.message);
            }
        }

        for (const idx of selectedS78Indices) {
            const sample = soilCotula[idx];
            if (!sample) continue;
            try {
                // Normalise S78 fields into the sample values shape the hub expects
                const s78values = _extractS78Values(sample);

                // Run S78 interpretation immediately if module is available
                let s78interpretation = null;
                if (window.GAIP_CotulaBowling?.interpretCotulaSoilTest) {
                    s78interpretation = window.GAIP_CotulaBowling.interpretCotulaSoilTest(s78values);
                }

                SampleManager.addSample('soil', {
                    label: sample.label,
                    date: sample.date,
                    zoneType: 'cotula_bowling_green',
                    methodology: 'cotula_s78',
                    notes: 'Hill Labs S78 — Turf Cotula. Imported from: ' + (data.filename || 'lab report'),
                    values: s78values,
                    s78interpretation: s78interpretation
                });
                imported.soil++;

                // Force turf profile to cotula if module present
                if (window.GAIP_CotulaBowling?.handleBowlsSelection) {
                    window.GAIP_CotulaBowling.handleBowlsSelection();
                }
            } catch (err) {
                errors.push('Cotula S78 "' + sample.label + '": ' + err.message);
            }
        }
        
        // Import water samples
        for (const idx of _state.selectedSamples.water) {
            const sample = data.water[idx];
            if (!sample) continue;
            try {
                SampleManager.addSample('water', {
                    label: sample.label,
                    date: sample.date,
                    notes: (sample.source ? 'Source: ' + sample.source + '. ' : '') +
                           'Imported from: ' + (data.filename || 'lab report'),
                    values: sample.values
                });
                imported.water++;
            } catch (err) {
                errors.push('Water "' + sample.label + '": ' + err.message);
            }
        }
        
        // Import tissue samples
        for (const idx of _state.selectedSamples.tissue) {
            const sample = data.tissue[idx];
            if (!sample) continue;
            try {
                SampleManager.addSample('tissue', {
                    label: sample.label,
                    date: sample.date,
                    notes: (sample.species ? 'Species: ' + sample.species + '. ' : '') +
                           'Imported from: ' + (data.filename || 'lab report'),
                    values: sample.values
                });
                imported.tissue++;
            } catch (err) {
                errors.push('Tissue "' + sample.label + '": ' + err.message);
            }
        }
        
        // Load the most recent sample of each type into the form
        if (imported.soil > 0) loadMostRecent('soil', data.soil);
        if (imported.water > 0) loadMostRecent('water', data.water);
        if (imported.tissue > 0) loadMostRecent('tissue', data.tissue);
        
        // Show result
        showImportResult(imported, errors);
    }

    function loadMostRecent(type, samples) {
        const SampleManager = global.GAIP_SampleManager || global.SampleManager || global.GilbaSampleManager;
        if (!SampleManager || typeof SampleManager.loadSample !== 'function') return;
        
        // Get the most recently added sample ID for this type.
        // getSamples() returns an array of sample objects, each with an .id property.
        // getActiveSampleId() returns the ID that was just set by addSample().
        try {
            // Prefer getActiveSampleId — addSample sets this immediately after insert
            if (typeof SampleManager.getActiveSampleId === 'function') {
                const activeId = SampleManager.getActiveSampleId(type);
                if (activeId) {
                    SampleManager.loadSample(type, activeId);
                    return;
                }
            }
            // Fallback: getSamples returns array of objects with .id
            const allSamples = SampleManager.getSamples ? SampleManager.getSamples(type) : null;
            if (Array.isArray(allSamples) && allSamples.length > 0) {
                const last = allSamples[allSamples.length - 1];
                if (last && last.id) {
                    SampleManager.loadSample(type, last.id);
                }
            }
        } catch (err) {
            console.warn('[LabParser] Could not auto-load sample:', err);
        }
    }

    function showImportResult(imported, errors) {
        const container = getOrCreateContainer();
        const total = imported.soil + imported.water + imported.tissue;
        
        let html = `
            <div class="gaip-lab-parser-content">
                <div class="gaip-lab-success">
                    <strong>Imported ${total} sample${total !== 1 ? 's' : ''}</strong>
                    <div class="gaip-lab-import-summary">
        `;
        
        if (imported.soil > 0) html += `<span class="gaip-lab-badge soil">${imported.soil} soil</span>`;
        if (imported.water > 0) html += `<span class="gaip-lab-badge water">${imported.water} water</span>`;
        if (imported.tissue > 0) html += `<span class="gaip-lab-badge tissue">${imported.tissue} tissue</span>`;
        
        html += `</div>`;
        
        if (errors.length > 0) {
            html += `<div class="gaip-lab-import-errors"><strong>Errors:</strong>`;
            errors.forEach(e => { html += `<p>${escapeHtml(e)}</p>`; });
            html += `</div>`;
        }
        
        html += `
                    <p>Samples are now available in the sample switcher. The most recent sample of each type has been loaded into the form.</p>
                    <div class="gaip-lab-actions">
                        <button class="gaip-btn gaip-btn-sm" onclick="GAIP_LabParser.openFilePicker()">Import Another</button>
                        <button class="gaip-btn gaip-btn-sm gaip-btn-ghost" onclick="GAIP_LabParser.close()">Done</button>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    /**
     * b35fix376: Result panel for local-CSV import path. Shape of `result`
     * comes from SampleManager.processImportData(): { dataType, sampleCount,
     * sampleIds, samples, meta }. No per-sample confirmation step like the
     * AI path — the local importer commits everything by definition; if a
     * row was malformed it would have thrown.
     */
    function showLocalImportResult(result, filename) {
        const container = getOrCreateContainer();
        const count = (result && result.sampleCount) || 0;
        const dataType = (result && result.dataType) || 'sample';
        const dtLabel = dataType.charAt(0).toUpperCase() + dataType.slice(1);

        const html = `
            <div class="gaip-lab-parser-content">
                <div class="gaip-lab-success">
                    <strong>Imported ${count} ${dtLabel.toLowerCase()} sample${count !== 1 ? 's' : ''} from ${escapeHtml(filename)}</strong>
                    <div class="gaip-lab-import-summary">
                        <span class="gaip-lab-badge ${dataType}">${count} ${dataType}</span>
                    </div>
                    <p>Samples are now in the ${dtLabel} sample switcher. The first sample has been loaded into the form. Switch between samples using the dropdown.</p>
                    <div class="gaip-lab-actions">
                        <button class="gaip-btn gaip-btn-sm gaip-btn-ghost" onclick="GAIP_LabParser.close()">Done</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
        container.style.display = 'block';
    }

    function close() {
        const container = document.getElementById('gaip-lab-parser-panel');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    /**
     * Extract S78 field values from a raw parsed sample.
     * The AI puts them at the top level when is_cotula_s78=true.
     * This normalises them into the shape COTULA_S78_DISPLAY_CONFIG expects.
     *
     * @param {object} sample - Raw parsed sample from AI extraction
     * @returns {object}      - Flat key:value map for S78 fields
     */
    function _extractS78Values(sample) {
        const S78_FIELDS = [
            'pH', 'P_olsen', 'K_pct_bs', 'K_me', 'Ca_pct_bs', 'Ca_me',
            'Mg_pct_bs', 'Mg_me', 'Na_pct_bs', 'Na_me',
            'CEC', 'TBS', 'VW', 'K_Mg_ratio', 'sample_depth_mm', 'soil_type'
        ];
        const out = {};
        // Pull from top-level (direct AI output for S78)
        S78_FIELDS.forEach(f => {
            if (sample[f] !== undefined && sample[f] !== null) {
                out[f] = sample[f];
            }
        });
        // Also check sample.values if it was nested
        if (sample.values && typeof sample.values === 'object') {
            S78_FIELDS.forEach(f => {
                if (out[f] === undefined && sample.values[f] !== undefined && sample.values[f] !== null) {
                    out[f] = sample.values[f];
                }
            });
        }
        return out;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // =========================================================================
    // STYLES
    // =========================================================================

    function injectStyles() {
        if (document.getElementById('gaip-lab-parser-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'gaip-lab-parser-styles';
        style.textContent = `
            .gaip-lab-parser-panel {
                display: none;
                margin: 16px 0;
                border-radius: var(--gaip-radius, 10px);
                border: 1px solid var(--gaip-border, var(--gaip-border));
                background: var(--gaip-surface, var(--gaip-surface));
                box-shadow: var(--gaip-shadow, 0 1px 4px rgba(0,0,0,0.04));
                overflow: hidden;
            }
            .gaip-lab-parser-content {
                padding: 20px;
            }
            .gaip-lab-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid #e8ebe8;
            }
            .gaip-lab-header strong {
                font-size: 16px;
                color: #1a2e1a;
            }
            .gaip-lab-filename {
                display: block;
                font-size: 12px;
                color: #6b7b6b;
                margin-top: 2px;
            }
            .gaip-lab-summary {
                display: flex;
                gap: 8px;
            }
            .gaip-lab-badge {
                font-size: 12px;
                padding: 3px 10px;
                border-radius: 12px;
                font-weight: 600;
            }
            .gaip-lab-badge.soil { background: var(--gaip-warning-bg); color: #92400e; }
            .gaip-lab-badge.water { background: var(--gaip-info-bg); color: #1e40af; }
            .gaip-lab-badge.tissue { background: var(--gaip-good-bg); color: #065f46; }
            
            .gaip-lab-doc-info {
                display: flex;
                gap: 20px;
                font-size: 13px;
                color: #6b7b6b;
                margin-bottom: 16px;
            }
            
            .gaip-lab-category {
                margin-bottom: 20px;
            }
            .gaip-lab-category h4 {
                margin: 0 0 8px;
                font-size: 14px;
                color: var(--gaip-text);
            }
            .gaip-lab-table-wrapper {
                overflow-x: auto;
                border: 1px solid var(--gaip-border);
                border-radius: 8px;
            }
            .gaip-lab-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                white-space: nowrap;
            }
            .gaip-lab-table thead {
                background: var(--gaip-surface-muted);
            }
            .gaip-lab-table th {
                padding: 6px 8px;
                text-align: center;
                font-weight: 600;
                color: var(--gaip-text-secondary);
                border-bottom: 1px solid var(--gaip-border);
                font-size: 11px;
            }
            .gaip-lab-table th:first-child,
            .gaip-lab-table th:nth-child(2),
            .gaip-lab-table th:nth-child(3) {
                text-align: left;
            }
            .gaip-lab-table td {
                padding: 5px 8px;
                text-align: center;
                border-bottom: 1px solid var(--gaip-surface-hover);
            }
            .gaip-lab-table td:first-child { text-align: center; width: 30px; }
            .gaip-lab-label { text-align: left !important; font-weight: 500; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
            .gaip-lab-val { color: var(--gaip-text); font-variant-numeric: tabular-nums; }
            .gaip-lab-empty { color: var(--gaip-border); }
            .gaip-lab-note-row { font-size: 11px; color: var(--gaip-text-muted); font-style: italic; text-align: left !important; }
            
            .gaip-lab-conf {
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 8px;
                font-weight: 600;
            }
            .gaip-lab-conf.high { background: var(--gaip-good-bg); color: #065f46; }
            .gaip-lab-conf.medium { background: var(--gaip-warning-bg); color: #92400e; }
            .gaip-lab-conf.low { background: var(--gaip-critical-bg); color: #991b1b; }
            
            .gaip-lab-notes {
                font-size: 12px;
                color: var(--gaip-text-secondary);
                margin: 12px 0;
                padding: 8px 12px;
                background: var(--gaip-surface-muted);
                border-radius: 6px;
            }
            
            .gaip-lab-actions {
                display: flex;
                gap: 10px;
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #e8ebe8;
            }
            
            .gaip-lab-parsing-status {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 12px 0;
            }
            .gaip-lab-parsing-status p {
                margin: 4px 0 0;
                font-size: 13px;
                color: #6b7b6b;
            }
            .gaip-lab-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid var(--gaip-border);
                border-top-color: var(--gaip-accent, #2d7a4f);
                border-radius: 50%;
                animation: gaip-lab-spin 0.8s linear infinite;
            }
            @keyframes gaip-lab-spin { to { transform: rotate(360deg); } }
            
            .gaip-lab-error {
                padding: 4px 0;
            }
            .gaip-lab-error strong {
                color: #991b1b;
            }
            .gaip-lab-error p {
                margin: 8px 0;
                color: var(--gaip-text-secondary);
                font-size: 13px;
            }
            
            .gaip-lab-success strong {
                color: #065f46;
                font-size: 16px;
            }
            .gaip-lab-import-summary {
                display: flex;
                gap: 8px;
                margin: 10px 0;
            }
            .gaip-lab-import-errors {
                margin-top: 12px;
                padding: 10px;
                background: var(--gaip-critical-bg);
                border-radius: 6px;
                font-size: 12px;
                color: #991b1b;
            }
            .gaip-lab-success p {
                font-size: 13px;
                color: var(--gaip-text-secondary);
                margin: 12px 0 0;
            }
            
            /* Button styles (reuse GAIP design tokens where possible) */
            .gaip-lab-parser-panel .gaip-btn {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.15s ease;
            }
            .gaip-lab-parser-panel .gaip-btn-primary {
                background: var(--gaip-accent, #2d7a4f);
                color: var(--gaip-surface);
                border-color: var(--gaip-accent, #2d7a4f);
            }
            .gaip-lab-parser-panel .gaip-btn-primary:hover {
                opacity: 0.9;
            }
            .gaip-lab-parser-panel .gaip-btn-primary:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .gaip-lab-parser-panel .gaip-btn-ghost {
                background: transparent;
                color: var(--gaip-text-secondary);
                border-color: var(--gaip-border);
            }
            .gaip-lab-parser-panel .gaip-btn-ghost:hover {
                background: var(--gaip-surface-muted);
            }
            .gaip-lab-parser-panel .gaip-btn-sm {
                padding: 6px 12px;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // INITIALISATION
    // =========================================================================

    function init() {
        injectStyles();
        
        // Add "Import Lab Report" button to sample switcher UI if it exists
        addImportButton();
        
        console.log('[LabParser] v1.0.0 ready');
    }

    function addImportButton() {
        // Static targets (exist in PHP-rendered markup)
        const staticTargets = [
            '.gaip-header-controls',            // Soil & Water card header
            '.gaip-run-btn'                      // Run button (inject before)
        ];
        
        // Dynamic targets (created by JS modules after load)
        const dynamicTargets = [
            '.gaip-sample-switcher-header',      // sample-switcher-ui.js
            '.gaip-sample-toolbar',
            '#gaip-dashboard-actions-slot'        // daily-dashboard.js
        ];
        
        const allTargets = [...staticTargets, ...dynamicTargets];
        
        for (const selector of allTargets) {
            const target = document.querySelector(selector);
            if (target && !document.querySelector('.gaip-lab-import-btn')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'gaip-lab-import-btn';
                btn.innerHTML = '📄 Import Lab Report';
                btn.title = 'Upload a PDF or Word document with lab results';
                btn.onclick = openFilePicker;
                btn.style.cssText = 'margin-left: 8px; padding: 4px 10px; font-size: 12px; border-radius: 6px; cursor: pointer; background: var(--gaip-accent-light, var(--gaip-accent-light)); color: var(--gaip-accent, #2d7a4f); border: 1px solid var(--gaip-accent, #2d7a4f); font-weight: 500; white-space: nowrap;';
                
                if (selector === '.gaip-run-btn') {
                    // Insert before the run button, not inside it
                    target.parentNode.insertBefore(btn, target);
                } else {
                    target.appendChild(btn);
                }
                console.log('[LabParser] Import button injected near:', selector);
                return;
            }
        }
        
        // If nothing found yet, retry after dynamic modules load
        if (!document.querySelector('.gaip-lab-import-btn')) {
            setTimeout(addImportButton, 1500);
        }
    }

    // Wire import strip buttons (new redesigned soil/water cards).
    // b35fix376: pass the card's dataType down so CSVs route through the
    // local SampleManager.importFile() path instead of the AI roundtrip.
    document.addEventListener('click', function(e) {
        if (e.target.closest('#gaip-soil-pdf-import-btn')) {
            openFilePicker('soil');
        } else if (e.target.closest('#gaip-water-pdf-import-btn')) {
            openFilePicker('water');
        } else if (e.target.closest('#gaip-tissue-pdf-import-btn')) {
            openFilePicker('tissue');
        }
    });

    // Init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    const LabParser = {
        openFilePicker,
        parseFile,
        importSelected,
        toggleSample,
        toggleAll,
        close,
        getState: function() { return _state; },
        VERSION: '1.0.0'
    };

    global.GAIP_LabParser = LabParser;

})(typeof window !== 'undefined' ? window : this);
