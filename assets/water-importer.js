/**
 * Gilba Water Report Importer v1.0.0
 * Parses Gilba Solutions water quality calculator PDF format
 * and populates hub water input fields.
 *
 * Supports: PDF upload (via pdfjs-dist) or plain text paste
 */

(function(global) {
    'use strict';

    // =========================================================================
    // PARSER — extracts structured water data from Gilba report text
    // =========================================================================

    function parseGilbaWaterReport(text) {
        var result = {
            date:  null,
            pH:    null,
            EC:    null,
            ions:  {},
            meta:  {}
        };

        // Normalise line endings
        var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

        // Helper: find numeric value after a label on the same or next token
        function extractAfter(pattern, src) {
            var m = src.match(pattern);
            return m ? parseFloat(m[1]) : null;
        }

        // Join all text for regex scanning
        var full = lines.join(' ');

        // ── Date ─────────────────────────────────────────────────────────────
        var dateM = full.match(/Date\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (dateM) {
            var parts = dateM[1].split(/[\/\-]/);
            // DD/MM/YYYY → YYYY-MM-DD
            if (parts.length === 3) {
                var d = parts[0].padStart(2,'0');
                var mo = parts[1].padStart(2,'0');
                var yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                result.date = yr + '-' + mo + '-' + d;
            }
        }

        // ── pH ───────────────────────────────────────────────────────────────
        var phM = full.match(/\bpH\s+([\d.]+)/);
        if (phM) result.pH = parseFloat(phM[1]);

        // ── EC ───────────────────────────────────────────────────────────────
        // Format: "EC 1.08mS/cm" or "EC 1.08 mS/cm"
        var ecM = full.match(/\bEC\s+([\d.]+)\s*mS/i);
        if (ecM) result.EC = parseFloat(ecM[1]);

        // ── Ions (mg/L values) ────────────────────────────────────────────────
        // Pattern: "Ca 116mg/L" or "Ca 116 mg/L"
        var ionMap = [
            { key: 'Ca',   patterns: [/\bCa\s+([\d.]+)\s*mg\/L/i] },
            { key: 'Mg',   patterns: [/\bMg\s+([\d.]+)\s*mg\/L/i] },
            { key: 'Na',   patterns: [/\bNa\s+([\d.]+)\s*mg\/L/i] },
            { key: 'K',    patterns: [/\bK\s+([\d.]+)\s*mg\/L/i] },
            { key: 'Cl',   patterns: [/\bCl\s+([\d.]+)\s*mg\/L/i] },
            // SO4-S reported as elemental S — convert to SO4 (*3.0625)
            { key: 'SO4',  patterns: [/S04[\-‐]S\s+([\d.]+)\s*mg\/L/i, /SO4[\-‐]S\s+([\d.]+)\s*mg\/L/i], convert: function(v){ return v * 3.0625; } },
            { key: 'HCO3', patterns: [/HC03\s+([\d.]+)\s*mg\/L/i, /HCO3\s+([\d.]+)\s*mg\/L/i] },
            { key: 'CO3',  patterns: [/\bC03\s+([\d.]+)\s*mg\/L/i, /\bCO3\s+([\d.]+)\s*mg\/L/i] },
            { key: 'NO3',  patterns: [/N03\s+([\d.]+)\s*mg\/L/i, /NO3\s+([\d.]+)\s*mg\/L/i] },
            { key: 'Fe',   patterns: [/\bFe\s+([\d.]+)\s*mg\/L/i] },
            { key: 'PO4',  patterns: [/HP04\s+([\d.]+)\s*mg\/L/i, /HPO4\s+([\d.]+)\s*mg\/L/i, /\bP\s+([\d.]+)\s*mg\/L/i] },
        ];

        ionMap.forEach(function(ion) {
            for (var i = 0; i < ion.patterns.length; i++) {
                var m = full.match(ion.patterns[i]);
                if (m) {
                    var val = parseFloat(m[1]);
                    if (!isNaN(val)) {
                        result.ions[ion.key] = ion.convert ? ion.convert(val) : val;
                        break;
                    }
                }
            }
        });

        // ── Metadata (for display only) ───────────────────────────────────────
        var sarM   = full.match(/\bSAR\s+([\d.]+)/);
        var sarAdjM= full.match(/SARadj[^\d]*([\d.]+)/);
        var rscM   = full.match(/\bRSC\s+[\-‐]?([\d.]+)/);
        var sspM   = full.match(/SSP[^%]+([\d]+)%/i);
        var lsiM   = full.match(/approx LSI\s+([\d.]+)/i);
        var rsiM   = full.match(/Ryznar Stability Index\s+([\d.]+)/i);
        var aggM   = full.match(/Aggressiveness Index\s+([\d.]+)/i);

        if (sarM)    result.meta.SAR   = parseFloat(sarM[1]);
        if (sarAdjM) result.meta.SARadj= parseFloat(sarAdjM[1]);
        if (rscM)    result.meta.RSC   = parseFloat(rscM[1]);
        if (sspM)    result.meta.SSP   = parseFloat(sspM[1]);
        if (lsiM)    result.meta.LSI   = parseFloat(lsiM[1]);
        if (rsiM)    result.meta.RSI   = parseFloat(rsiM[1]);
        if (aggM)    result.meta.AGI   = parseFloat(aggM[1]);

        // Client / site name
        var nameM = full.match(/Client Name\s+(.+?)\s+(?:Spring|Summer|Autumn|Winter|Date)/);
        if (nameM) result.meta.clientName = nameM[1].trim();

        return result;
    }

    // =========================================================================
    // POPULATE — writes parsed values into hub DOM fields
    // =========================================================================

    function populateHubFields(data) {
        var filled = 0;

        function setField(selector, value) {
            if (value === null || value === undefined || isNaN(value)) return;
            var el = document.querySelector(selector);
            if (!el) return;
            el.value = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            filled++;
        }

        if (data.date)  setField('.gaip-water-date', data.date);
        if (data.pH)    setField('.gaip-water-ph', data.pH);
        if (data.EC)    setField('.gaip-ecw', data.EC);

        var ionSelectors = {
            Ca:   '[data-ion="Ca"]',
            Mg:   '[data-ion="Mg"]',
            Na:   '[data-ion="Na"]',
            K:    '[data-ion="K"]',
            Cl:   '[data-ion="Cl"]',
            SO4:  '[data-ion="SO4"]',
            HCO3: '[data-ion="HCO3"]',
            CO3:  '[data-ion="CO3"]',
            NO3:  '[data-ion="NO3"]',
            Fe:   '[data-ion="Fe"]',
            PO4:  '[data-ion="PO4"]',
        };

        Object.keys(ionSelectors).forEach(function(ion) {
            if (data.ions[ion] !== undefined) {
                setField(ionSelectors[ion], data.ions[ion]);
            }
        });

        return filled;
    }

    // =========================================================================
    // PDF EXTRACTION — uses PDF.js (loaded from CDN)
    // =========================================================================

    async function extractTextFromPDF(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    var pdfjsLib = window['pdfjs-dist/build/pdf'];
                    pdfjsLib.GlobalWorkerOptions.workerSrc =
                        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                    var pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
                    var text = '';
                    for (var i = 1; i <= Math.min(pdf.numPages, 3); i++) {
                        var page = await pdf.getPage(i);
                        var content = await page.getTextContent();
                        text += content.items.map(function(item) {
                            return item.str;
                        }).join(' ') + '\n';
                    }
                    resolve(text);
                } catch(err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // =========================================================================
    // UI PANEL — injected into hub
    // =========================================================================

    function buildImporterPanel() {
        var panel = document.createElement('div');
        panel.id = 'gaip-water-importer';
        panel.style.cssText = [
            'background:var(--gaip-surface-muted)',
            'border:1px solid var(--gaip-border)',
            'border-radius:8px',
            'padding:14px 16px',
            'margin-bottom:12px',
            'font-size:13px',
        ].join(';');

        panel.innerHTML = [
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">',
            '  <span style="font-size:16px;">💧</span>',
            '  <strong style="font-size:13px;color:var(--gaip-text);">Import Gilba Water Report</strong>',
            '  <span style="font-size:11px;color:var(--gaip-text-muted);margin-left:auto;">PDF or text paste</span>',
            '</div>',

            // Tab buttons
            '<div style="display:flex;gap:4px;margin-bottom:10px;">',
            '  <button id="gaip-wim-tab-pdf" class="gaip-wim-tab gaip-wim-tab-active"',
            '    style="padding:4px 10px;border:1px solid var(--gaip-border);border-radius:4px;background:var(--gaip-surface);cursor:pointer;font-size:12px;">',
            '    📄 PDF Upload</button>',
            '  <button id="gaip-wim-tab-text" class="gaip-wim-tab"',
            '    style="padding:4px 10px;border:1px solid var(--gaip-border);border-radius:4px;background:var(--gaip-surface-muted);cursor:pointer;font-size:12px;">',
            '    📋 Paste Text</button>',
            '</div>',

            // PDF pane
            '<div id="gaip-wim-pane-pdf">',
            '  <label style="display:block;padding:20px;border:2px dashed var(--gaip-border);border-radius:6px;text-align:center;cursor:pointer;color:var(--gaip-text-secondary);font-size:12px;" id="gaip-wim-drop-zone">',
            '    <span id="gaip-wim-drop-label">Drop PDF here or click to browse</span>',
            '    <input type="file" id="gaip-wim-file" accept=".pdf" style="display:none;">',
            '  </label>',
            '</div>',

            // Text paste pane
            '<div id="gaip-wim-pane-text" style="display:none;">',
            '  <textarea id="gaip-wim-text" rows="5" placeholder="Paste report text here..."',
            '    style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--gaip-border);border-radius:6px;font-size:11px;resize:vertical;"></textarea>',
            '  <button id="gaip-wim-parse-text"',
            '    style="margin-top:6px;padding:5px 12px;background:#3b82f6;color:var(--gaip-surface);border:none;border-radius:4px;cursor:pointer;font-size:12px;">',
            '    Parse & Import</button>',
            '</div>',

            // Preview / status
            '<div id="gaip-wim-preview" style="display:none;margin-top:10px;padding:10px;background:var(--gaip-surface);border:1px solid var(--gaip-border);border-radius:6px;">',
            '  <div id="gaip-wim-preview-content"></div>',
            '  <div style="display:flex;gap:8px;margin-top:10px;">',
            '    <button id="gaip-wim-confirm"',
            '      style="padding:5px 14px;background:#22c55e;color:var(--gaip-surface);border:none;border-radius:4px;cursor:pointer;font-size:12px;">',
            '      ✓ Populate Fields</button>',
            '    <button id="gaip-wim-cancel"',
            '      style="padding:5px 10px;background:var(--gaip-surface-hover);border:1px solid var(--gaip-border);border-radius:4px;cursor:pointer;font-size:12px;">',
            '      Cancel</button>',
            '  </div>',
            '</div>',

            '<div id="gaip-wim-status" style="margin-top:8px;font-size:11px;color:var(--gaip-text-secondary);"></div>',
        ].join('');

        return panel;
    }

    function renderPreview(data) {
        var rows = [];
        if (data.date)     rows.push(['Date', data.date]);
        if (data.pH)       rows.push(['pH', data.pH]);
        if (data.EC)       rows.push(['EC', data.EC + ' mS/cm']);
        var ionOrder = ['Ca','Mg','Na','K','Cl','SO4','HCO3','CO3','NO3','Fe','PO4'];
        ionOrder.forEach(function(ion) {
            if (data.ions[ion] !== undefined) {
                var label = ion === 'SO4' ? 'SO4 (from SO4-S)' : ion;
                rows.push([label, data.ions[ion].toFixed(2) + ' mg/L']);
            }
        });

        var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
        html += '<thead><tr style="background:var(--gaip-surface-hover);">';
        html += '<th style="padding:4px 8px;text-align:left;font-weight:600;">Field</th>';
        html += '<th style="padding:4px 8px;text-align:right;font-weight:600;">Value</th>';
        html += '</tr></thead><tbody>';
        rows.forEach(function(row, i) {
            var bg = i % 2 === 0 ? 'var(--gaip-surface)' : 'var(--gaip-surface-muted)';
            html += '<tr style="background:' + bg + ';">';
            html += '<td style="padding:4px 8px;color:var(--gaip-text-secondary);">' + row[0] + '</td>';
            html += '<td style="padding:4px 8px;text-align:right;font-weight:500;">' + row[1] + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table>';

        if (data.meta.clientName) {
            html = '<div style="font-size:11px;color:var(--gaip-text-secondary);margin-bottom:6px;">Source: <strong>' +
                data.meta.clientName + '</strong></div>' + html;
        }

        return html;
    }

    // =========================================================================
    // INIT — wire up panel events and inject into page
    // =========================================================================

    function init() {
        // Find water section to inject before it
        var target = document.querySelector('.gaip-water-grid');
        if (!target) {
            console.warn('[WaterImporter] Water grid not found');
            return;
        }
        var container = target.closest('.gaip-section, .gaip-card, .gaip-panel, form') || target.parentElement;

        var panel = buildImporterPanel();
        container.insertBefore(panel, container.firstChild);

        var _parsedData = null;

        function setStatus(msg, colour) {
            var el = document.getElementById('gaip-wim-status');
            if (el) { el.textContent = msg; el.style.color = colour || 'var(--gaip-text-secondary)'; }
        }

        function showPreview(data) {
            _parsedData = data;
            var prev = document.getElementById('gaip-wim-preview');
            var cont = document.getElementById('gaip-wim-preview-content');
            if (prev && cont) {
                cont.innerHTML = renderPreview(data);
                prev.style.display = 'block';
            }
        }

        // Tab switching
        ['pdf','text'].forEach(function(tab) {
            var btn = document.getElementById('gaip-wim-tab-' + tab);
            if (!btn) return;
            btn.addEventListener('click', function() {
                document.querySelectorAll('.gaip-wim-tab').forEach(function(b) {
                    b.style.background = 'var(--gaip-surface-muted)';
                    b.style.borderColor = 'var(--gaip-border)';
                });
                btn.style.background = 'var(--gaip-surface)';
                btn.style.borderColor = 'var(--gaip-border)';
                document.getElementById('gaip-wim-pane-pdf').style.display  = tab === 'pdf'  ? '' : 'none';
                document.getElementById('gaip-wim-pane-text').style.display = tab === 'text' ? '' : 'none';
            });
        });

        // PDF file input
        var fileInput = document.getElementById('gaip-wim-file');
        var dropZone  = document.getElementById('gaip-wim-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('click', function() { fileInput && fileInput.click(); });
            dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = '#3b82f6'; });
            dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = 'var(--gaip-border)'; });
            dropZone.addEventListener('drop', function(e) {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--gaip-border)';
                var file = e.dataTransfer.files[0];
                if (file) handleFile(file);
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                if (fileInput.files[0]) handleFile(fileInput.files[0]);
            });
        }

        async function handleFile(file) {
            setStatus('Reading PDF...', '#3b82f6');
            var label = document.getElementById('gaip-wim-drop-label');
            if (label) label.textContent = file.name;
            try {
                var text = await extractTextFromPDF(file);
                var data = parseGilbaWaterReport(text);
                var ionCount = Object.keys(data.ions).length;
                if (ionCount === 0 && !data.pH && !data.EC) {
                    setStatus('Could not parse water data, is this a Gilba water report?', '#ef4444');
                    return;
                }
                showPreview(data);
                setStatus('Found ' + ionCount + ' ions. Review below then click Populate Fields.', '#22c55e');
            } catch(err) {
                setStatus('PDF read failed: ' + err.message, '#ef4444');
                console.error('[WaterImporter]', err);
            }
        }

        // Text paste parse
        var parseBtn = document.getElementById('gaip-wim-parse-text');
        if (parseBtn) {
            parseBtn.addEventListener('click', function() {
                var ta = document.getElementById('gaip-wim-text');
                if (!ta || !ta.value.trim()) { setStatus('Paste report text first', '#ef4444'); return; }
                var data = parseGilbaWaterReport(ta.value);
                var ionCount = Object.keys(data.ions).length;
                if (ionCount === 0) { setStatus('No water data found in pasted text', '#ef4444'); return; }
                showPreview(data);
                setStatus('Found ' + ionCount + ' ions. Review below then click Populate Fields.', '#22c55e');
            });
        }

        // Confirm — populate fields
        var confirmBtn = document.getElementById('gaip-wim-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                if (!_parsedData) return;
                var filled = populateHubFields(_parsedData);
                var importedName = (_parsedData.meta && _parsedData.meta.clientName)
                    ? _parsedData.meta.clientName
                    : 'Imported ' + new Date().toLocaleDateString('en-AU');
                document.getElementById('gaip-wim-preview').style.display = 'none';
                setStatus('Populated ' + filled + ' fields. Run analysis to update results.', '#22c55e');
                // Save as a new water sample if sample manager is available
                var SM = global.GAIP_SampleManager;
                if (SM && typeof SM.saveSample === 'function') {
                    try { SM.saveSample('water', importedName); } catch(e) {}
                }
                _parsedData = null;
            });
        }

        // Cancel
        var cancelBtn = document.getElementById('gaip-wim-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                document.getElementById('gaip-wim-preview').style.display = 'none';
                _parsedData = null;
                setStatus('');
            });
        }

        console.log('[WaterImporter] v1.0.0 ready');
    }

    // Load PDF.js then init
    function loadPdfJs(callback) {
        if (window['pdfjs-dist/build/pdf']) { callback(); return; }
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = callback;
        document.head.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { loadPdfJs(init); });
    } else {
        loadPdfJs(init);
    }

    // Expose parser for testing
    global.GAIP_WaterImporter = { parse: parseGilbaWaterReport, populate: populateHubFields };

})(window);
