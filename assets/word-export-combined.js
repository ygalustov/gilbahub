/**
 * Gilba Word Export - Combined Multi-Site Report
 * Version: 1.0.0
 * 
 * Generates a single Word document containing reports for all soil samples
 * across all sites (or the current site). Instead of exporting 20 separate
 * documents for 20 greens, the superintendent gets one combined report.
 *
 * Architecture:
 *   1. Enumerate sites and their soil samples
 *   2. For each sample: load → trigger analysis → wait for completion → collect data + charts
 *   3. Build one document with section breaks per sample
 *   4. Download as single .docx
 *
 * Dependencies: word-export.js (GAIP_WordExport), sample-manager.js (GAIP_SampleManager)
 */
(function(global) {
    'use strict';

    var SETTLE_MS = 2500;   // ms to wait after analysis-complete for charts to render
    var TIMEOUT_MS = 15000; // max wait per sample before giving up

    // =========================================================================
    // HELPERS
    // =========================================================================

    function log() {
        var args = ['[CombinedExport]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function warn() {
        var args = ['[CombinedExport]'].concat(Array.prototype.slice.call(arguments));
        console.warn.apply(console, args);
    }

    /**
     * Wait for analysis-complete event with timeout
     */
    function waitForAnalysis(timeoutMs) {
        return new Promise(function(resolve) {
            var resolved = false;
            var timer = null;

            function onComplete() {
                if (resolved) return;
                resolved = true;
                clearTimeout(timer);
                document.removeEventListener('gaip:analysis-complete', onComplete);
                // Extra settle time for charts/disease/irrigation to render
                setTimeout(resolve, SETTLE_MS);
            }

            document.addEventListener('gaip:analysis-complete', onComplete);
            timer = setTimeout(function() {
                if (!resolved) {
                    resolved = true;
                    document.removeEventListener('gaip:analysis-complete', onComplete);
                    warn('Analysis timed out after', timeoutMs, 'ms — collecting what we have');
                    resolve();
                }
            }, timeoutMs || TIMEOUT_MS);
        });
    }

    /**
     * Trigger the Run Analysis button programmatically
     */
    function triggerAnalysis() {
        var btn = document.getElementById('gaip-run-analysis') ||
                  document.querySelector('.gaip-run-btn') ||
                  document.querySelector('#gaip-analyze-btn') ||
                  document.querySelector('[data-action="analyze"]');
        if (btn) {
            btn.click();
            return true;
        }
        warn('Could not find Run Analysis button');
        return false;
    }

    /**
     * Build a summary of all sites and their soil samples
     */
    // Humanize a raw generated sample ID into a display label.
    // Generated IDs look like: Soil_1_3cbn, Soil_12_6tf5, Water_2_abc1
    // Strip the trailing hash suffix and replace underscores with spaces.
    function humanizeSampleLabel(label, id) {
        var raw = label || id || '';
        // If it matches the generated pattern (Word_N_HASH or Word_NN_HASH), clean it up
        var m = raw.match(/^([A-Za-z][A-Za-z0-9]*)_(\d+)_[0-9a-z]{4,}$/);
        if (m) {
            // e.g. "Soil 1", "Green 10" — keep the type prefix only if it's not redundant
            var prefix = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
            return prefix + ' ' + m[2];
        }
        // Also handle slugified labels like "green_10" → "Green 10"
        if (/^[a-z][a-z0-9_]+$/.test(raw) && raw.indexOf('_') >= 0) {
            return raw.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
        }
        return raw;
    }

    function enumerateSamples(scope) {
        var sm = global.GAIP_SampleManager;
        if (!sm || !sm.getAllSamples) {
            warn('SampleManager not available');
            return [];
        }

        var allData = sm.getAllSamples();
        var sites = allData.sites || {};
        var stores = allData.allSites || {};
        var result = [];

        // Derive zone identity from a sample object by stripping temporal qualifiers.
        // Mirrors NutrientTrend.deriveZoneKey — keeps this logic in sync.
        function deriveZoneKeyLocal(sampleObj) {
            var key = (sampleObj && (sampleObj.label || sampleObj.id)) || '';
            key = key.replace(/\s*\(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?\)\s*$/, '');
            key = key.replace(/\b[Qq][1-4]\b/g, '');
            key = key.replace(/\b[Hh][12]\b/g, '');
            key = key.replace(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/gi, '');
            key = key.replace(/\b20\d{2}\b/g, '');
            key = key.replace(/\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/g, '');
            key = key.replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g, '');
            key = key.replace(/\b(spring|summer|autumn|fall|winter)\b/gi, '');
            key = key.replace(/\b(pre|post|mid)\s*-?\s*(season|summer|winter|spring|autumn)\b/gi, '');
            key = key.replace(/\b(test|sample|report)\s*#?\d*\b/gi, '');
            key = key.replace(/[\s_-]+/g, ' ').trim().toLowerCase();
            return key || ((sampleObj && (sampleObj.label || sampleObj.id)) || '').toLowerCase().trim();
        }

        var siteIds = Object.keys(sites);
        for (var s = 0; s < siteIds.length; s++) {
            var siteId = siteIds[s];
            // If scope is 'current', only include active site
            if (scope === 'current' && siteId !== allData.currentSite) continue;

            var siteStore = stores[siteId];
            if (!siteStore) continue;

            var soilSamples = siteStore.soil ? Object.keys(siteStore.soil) : [];
            var waterSamples = siteStore.water ? Object.keys(siteStore.water) : [];
            var tissueSamples = siteStore.tissue ? Object.keys(siteStore.tissue) : [];

            var hasSoil    = soilSamples.length > 0;
            var hasWater   = waterSamples.length > 0;
            var hasTissue  = tissueSamples.length > 0;

            // Skip sites with no data at all
            if (!hasSoil && !hasWater && !hasTissue) continue;

            // One entry per zone per site, using the most recent sample for each zone.
            // A zone is the physical location (e.g. "Green 1", "Fairway 3") — multiple
            // samples for the same zone represent different testing dates. We keep only
            // the latest date per zone. Historical data is covered by the trend section.
            if (hasSoil) {
                // Group all soil samples by zone, pick the one with the latest date per zone
                var soilZones = {}; // zoneKey -> { sampleId, sampleObj, date }
                for (var si = 0; si < soilSamples.length; si++) {
                    var sid = soilSamples[si];
                    var sobj = siteStore.soil[sid];
                    var zkey = deriveZoneKeyLocal(sobj);
                    var sdate = (sobj && sobj.date) || '';
                    if (!soilZones[zkey] || sdate > soilZones[zkey].date) {
                        soilZones[zkey] = { sampleId: sid, sampleObj: sobj, date: sdate };
                    }
                }
                var zoneKeys = Object.keys(soilZones);
                for (var zi = 0; zi < zoneKeys.length; zi++) {
                    var zEntry = soilZones[zoneKeys[zi]];
                    var zSoilId = zEntry.sampleId;
                    var zWater   = hasWater  ? ((siteStore.water  && siteStore.water[zSoilId])  ? zSoilId : waterSamples[waterSamples.length - 1])   : null;
                    var zTissue  = hasTissue ? ((siteStore.tissue && siteStore.tissue[zSoilId]) ? zSoilId : tissueSamples[tissueSamples.length - 1]) : null;
                    result.push({
                        siteId:        siteId,
                        siteLabel:     sites[siteId].label || siteId,
                        sampleId:      zSoilId,
                        sampleLabel:   humanizeSampleLabel((zEntry.sampleObj && zEntry.sampleObj.label) || zSoilId, zSoilId),
                        primaryType:   'soil',
                        hasSoil:       true,
                        hasWater:      hasWater,
                        hasTissue:     hasTissue,
                        waterSampleId: zWater,
                        tissueSampleId:zTissue
                    });
                }
            } else if (hasWater) {
                // Water-only site: one entry per zone (most recent date per zone)
                var waterZones = {};
                for (var wi = 0; wi < waterSamples.length; wi++) {
                    var wid = waterSamples[wi];
                    var wobj = siteStore.water[wid];
                    var wzkey = deriveZoneKeyLocal(wobj);
                    var wdate = (wobj && wobj.date) || '';
                    if (!waterZones[wzkey] || wdate > waterZones[wzkey].date) {
                        waterZones[wzkey] = { sampleId: wid, sampleObj: wobj, date: wdate };
                    }
                }
                var wZoneKeys = Object.keys(waterZones);
                for (var wzi = 0; wzi < wZoneKeys.length; wzi++) {
                    var wEntry = waterZones[wZoneKeys[wzi]];
                    result.push({
                        siteId:        siteId,
                        siteLabel:     sites[siteId].label || siteId,
                        sampleId:      wEntry.sampleId,
                        sampleLabel:   humanizeSampleLabel((wEntry.sampleObj && wEntry.sampleObj.label) || wEntry.sampleId, wEntry.sampleId),
                        primaryType:   'water',
                        hasSoil:       false,
                        hasWater:      true,
                        hasTissue:     hasTissue,
                        waterSampleId: wEntry.sampleId,
                        tissueSampleId:hasTissue ? tissueSamples[tissueSamples.length - 1] : null
                    });
                }
            } else if (hasTissue) {
                // Tissue-only site: one entry per zone (most recent date per zone)
                var tissueZones = {};
                for (var ti = 0; ti < tissueSamples.length; ti++) {
                    var tid = tissueSamples[ti];
                    var tobj = siteStore.tissue[tid];
                    var tzkey = deriveZoneKeyLocal(tobj);
                    var tdate = (tobj && tobj.date) || '';
                    if (!tissueZones[tzkey] || tdate > tissueZones[tzkey].date) {
                        tissueZones[tzkey] = { sampleId: tid, sampleObj: tobj, date: tdate };
                    }
                }
                var tZoneKeys = Object.keys(tissueZones);
                for (var tzi = 0; tzi < tZoneKeys.length; tzi++) {
                    var tEntry = tissueZones[tZoneKeys[tzi]];
                    result.push({
                        siteId:        siteId,
                        siteLabel:     sites[siteId].label || siteId,
                        sampleId:      tEntry.sampleId,
                        sampleLabel:   humanizeSampleLabel((tEntry.sampleObj && tEntry.sampleObj.label) || tEntry.sampleId, tEntry.sampleId),
                        primaryType:   'tissue',
                        hasSoil:       false,
                        hasWater:      false,
                        hasTissue:     true,
                        waterSampleId: null,
                        tissueSampleId:tEntry.sampleId
                    });
                }
            }
        }

        log('enumerateSamples(' + scope + '): ' + result.length + ' zones across ' +
            new Set(result.map(function(r) { return r.siteId; })).size + ' sites — ' +
            result.map(function(r) { return r.siteLabel + '/' + (r.sampleLabel || r.sampleId); }).join(', '));
        return result;
    }

    function createProgressUI(totalSamples) {
        var overlay = document.createElement('div');
        overlay.id = 'combined-export-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        var box = document.createElement('div');
        box.style.cssText = 'background:var(--gaip-surface);border-radius:12px;padding:32px 48px;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:Calibri,Arial,sans-serif;min-width:400px;text-align:center;';

        box.innerHTML =
            '<h3 style="margin:0 0 8px;color:#059669;">📋 Combined Report Export</h3>' +
            '<p id="combined-export-status" style="margin:4px 0 16px;color:var(--gaip-text-secondary);font-size:14px;">Preparing...</p>' +
            '<div style="background:var(--gaip-border);border-radius:6px;height:8px;overflow:hidden;margin-bottom:12px;">' +
            '  <div id="combined-export-bar" style="background:#059669;height:100%;width:0%;transition:width 0.3s;border-radius:6px;"></div>' +
            '</div>' +
            '<p id="combined-export-count" style="margin:0;color:var(--gaip-text-muted);font-size:13px;">0 / ' + totalSamples + ' samples</p>' +
            '<button id="combined-export-cancel" style="margin-top:16px;padding:6px 20px;border:1px solid var(--gaip-border);background:var(--gaip-surface);border-radius:6px;cursor:pointer;color:var(--gaip-text-secondary);font-size:13px;">Cancel</button>';

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        var cancelled = false;
        document.getElementById('combined-export-cancel').addEventListener('click', function() {
            cancelled = true;
        });

        return {
            update: function(current, siteLabel, sampleId) {
                var pct = Math.round((current / totalSamples) * 100);
                var bar = document.getElementById('combined-export-bar');
                var status = document.getElementById('combined-export-status');
                var count = document.getElementById('combined-export-count');
                if (bar) bar.style.width = pct + '%';
                if (status) status.textContent = 'Analysing: ' + siteLabel + ' — ' + sampleId;
                if (count) count.textContent = current + ' / ' + totalSamples + ' samples';
            },
            finish: function(msg) {
                var status = document.getElementById('combined-export-status');
                var bar = document.getElementById('combined-export-bar');
                if (bar) bar.style.width = '100%';
                if (status) status.textContent = msg || 'Complete!';
                setTimeout(function() {
                    var el = document.getElementById('combined-export-overlay');
                    if (el) el.remove();
                }, 1500);
            },
            error: function(msg) {
                var status = document.getElementById('combined-export-status');
                if (status) { status.textContent = msg; status.style.color = '#DC2626'; }
                setTimeout(function() {
                    var el = document.getElementById('combined-export-overlay');
                    if (el) el.remove();
                }, 3000);
            },
            isCancelled: function() { return cancelled; },
            remove: function() {
                var el = document.getElementById('combined-export-overlay');
                if (el) el.remove();
            }
        };
    }

    // =========================================================================
    // CORE EXPORT
    // =========================================================================

    /**
     * Export combined report for all sites or current site
     * @param {string} scope - 'all' for all sites, 'current' for current site only
     */
    async function exportCombined(scope) {
        scope = scope || 'all';
        var samples = enumerateSamples(scope);
        return exportCombinedWithSamples(samples);
    }

    /**
     * Export combined report for an explicit list of samples
     * @param {Array} samples - array of {siteId, siteLabel, sampleId, ...}
     */
    async function exportCombinedWithSamples(samples) {
        if (!global.GAIP_WordExport || !global.GAIP_SampleManager) {
            alert('Word Export or Sample Manager not loaded. Please try again.');
            return;
        }

        if (!samples || samples.length === 0) {
            alert('No soil samples found to export.');
            return;
        }

        log('Starting combined export for', samples.length, 'samples across', 
            new Set(samples.map(function(s) { return s.siteId; })).size, 'sites');

        var sm = global.GAIP_SampleManager;
        var we = global.GAIP_WordExport;

        // Remember current state to restore afterwards
        var allData = sm.getAllSamples();
        var originalSite = allData.currentSite;
        var originalActive = JSON.parse(JSON.stringify(allData.allActive));

        var progress = createProgressUI(samples.length);
        var collectedReports = [];

        // b35fix139: capture blend result before loop — blender state gets cleared by sample switches
        var _capturedBlendWater = null;
        try {
            var _preLoopState = window.GAIP_WaterBlenderUI && 
                                window.GAIP_WaterBlenderUI.getState && 
                                window.GAIP_WaterBlenderUI.getState();
            if (_preLoopState && _preLoopState.blendResult && 
                typeof GAIP_WaterBlender !== 'undefined' && GAIP_WaterBlender.toHubWaterState) {
                _capturedBlendWater = GAIP_WaterBlender.toHubWaterState(_preLoopState.blendResult);
                window._GAIP_EXPORT_BLEND_WATER = _capturedBlendWater; // plain prop, immune to defineProperty getter
                log('Captured blend water before export loop: ecw=' + (_capturedBlendWater ? _capturedBlendWater.ecw : 'null'));
            }
        } catch(_e) {}

        // Reset image ID counter
        if (typeof global.GAIP_WordExport_imageIdCounter !== 'undefined') {
            global.GAIP_WordExport_imageIdCounter = 0;
        }

        // Signal to word-export.js to suppress Cross-Module in per-green buildSections.
        // It is injected once at combined doc level — not per green.
        global.GAIP_COMBINED_EXPORT_ACTIVE = true;

        try {
            for (var i = 0; i < samples.length; i++) {
                if (progress.isCancelled()) {
                    log('Export cancelled by user');
                    progress.remove();
                    // Restore original state
                    sm.setActiveSite(originalSite);
                    global.GAIP_COMBINED_EXPORT_ACTIVE = false;
                    return;
                }

                var entry = samples[i];
                progress.update(i + 1, entry.siteLabel, entry.sampleId);

                // Switch to the sample's site
                sm.setActiveSite(entry.siteId);

                // Load samples according to primaryType — soil-only, water-only, or tissue-only
                if (entry.primaryType === 'soil' || (!entry.primaryType && entry.sampleId)) {
                    sm.loadSample('soil', entry.sampleId);
                }
                if (entry.waterSampleId) {
                    sm.loadSample('water', entry.waterSampleId);
                }
                if (entry.tissueSampleId) {
                    sm.loadSample('tissue', entry.tissueSampleId);
                }

                // Small delay for DOM to settle after load
                await new Promise(function(r) { setTimeout(r, 300); });

                // Trigger analysis
                triggerAnalysis();

                // Wait for analysis to complete
                await waitForAnalysis(TIMEOUT_MS);

                // b35fix139: inject pre-captured blend water into hub store before collectData
                // GAIP_STATE is a defineProperty getter — write to GilbaHub store instead
                if (_capturedBlendWater) {
                    try {
                        if (window.GilbaHub && window.GilbaHub.set) {
                            window.GilbaHub.set('inputs.water', _capturedBlendWater);
                        }
                    } catch(_ie) {}
                    log('Injected pre-captured blend water to GilbaHub store: ecw=' + _capturedBlendWater.ecw);
                }

                // Collect data and charts using the standard export pipeline
                var data = we.collectData();

                // Use entry.sampleLabel from enumerateSamples — already humanized and correct per sample.
                // Do NOT read data.soil.sampleLabel (DOM-sourced) here: during a multi-sample loop the
                // DOM label input reflects the last-active sample, not the current iteration's sample.
                var resolvedLabel = entry.sampleLabel || entry.sampleId;

                // Override site label with the site name + sample ID for clarity
                data.site = data.site || {};
                data.site.sampleLabel = resolvedLabel;
                data.site.siteLabel = entry.siteLabel;

                // Override soil.sampleLabel too — buildSections uses this for the section heading
                // (e.g. "Soil Nutrition (SLAN) — Green 2"). collectData reads it from the DOM
                // label input which reflects the last-active sample, not the current iteration.
                if (data.soil) data.soil.sampleLabel = resolvedLabel;

                // Capture charts
                var charts = {};
                if (typeof global.GAIP_WordExport_captureCharts === 'function') {
                    charts = await global.GAIP_WordExport_captureCharts(data);
                } else {
                    // Fallback: try the internal captureCharts via re-export
                    // Charts may not be available if not exposed
                    log('Chart capture not exposed — report will be text-only for:', entry.sampleId);
                }

                collectedReports.push({
                    siteId: entry.siteId,
                    siteLabel: entry.siteLabel,
                    sampleId: entry.sampleId,
                    sampleLabel: resolvedLabel,
                    data: data,
                    charts: charts
                });

                log('Collected report', (i + 1), '/', samples.length, ':', entry.siteLabel, '—', entry.sampleId);
            }

            // Build the combined document — flag stays true since buildSections runs inside here
            progress.update(samples.length, 'Building document', '...');
            await buildCombinedDocument(collectedReports);

            progress.finish('Download ready!');
        } catch (err) {
            console.error('[CombinedExport] Error:', err);
            progress.error('Export failed: ' + err.message);
        } finally {
            global.GAIP_COMBINED_EXPORT_ACTIVE = false;
            window._GAIP_EXPORT_BLEND_WATER = null;
            // Restore original state
            sm.setActiveSite(originalSite);
            // Restore original active samples
            if (originalActive[originalSite]) {
                var types = ['soil', 'water', 'tissue', 'loi'];
                for (var t = 0; t < types.length; t++) {
                    var origId = originalActive[originalSite][types[t]];
                    if (origId) sm.loadSample(types[t], origId);
                }
            }
            // b35fix139: re-inject sample switchers after export loop
            // (rapid site switches during loop can leave switcher UI in bad state)
            setTimeout(function() {
                if (global.GAIP_SampleSwitcherUI && global.GAIP_SampleSwitcherUI.reinit) {
                    global.GAIP_SampleSwitcherUI.reinit();
                    log('Sample switchers re-initialised after export');
                }
            }, 600);
        }
    }

    /**
     * Clean a TOC paragraph by removing References/Metadata/Glossary entries.
     * The TOC is a single Paragraph with a TextRun containing newline-separated items.
     * Returns a new Paragraph with the cleaned text, or null if can't clean.
     */
    function cleanTocParagraph(para) {
        try {
            var Paragraph = global.docx.Paragraph;
            var TextRun = global.docx.TextRun;
            
            // Serialize to find the TOC text
            var str = JSON.stringify(para);
            
            // Find the text content - look for the bullet list pattern
            var textMatch = str.match(/"text":"((?:[^"\\]|\\.)*)"/);
            if (!textMatch) return null;
            
            var tocText = textMatch[1];
            // Unescape JSON string escapes
            tocText = tocText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            
            // Split into lines and filter out References/Metadata/Glossary
            var lines = tocText.split('\n');
            var filtered = lines.filter(function(line) {
                var lower = line.toLowerCase();
                return lower.indexOf('references') < 0 && 
                       lower.indexOf('glossary') < 0 && 
                       lower.indexOf('report metadata') < 0;
            });
            
            if (filtered.length === lines.length) return null; // Nothing to strip
            
            // Rebuild paragraph with cleaned text
            return new Paragraph({
                spacing: { before: 100, after: 200 },
                children: [new TextRun({ text: filtered.join('\n'), size: 22 })]
            });
        } catch (e) {
            log('TOC clean failed:', e);
            return null;
        }
    }

    // =========================================================================
    // DOCX PARAGRAPH INSPECTION HELPERS
    // =========================================================================

    /**
     * Extract text from a docx.js Paragraph to identify section headings.
     * Uses multiple strategies since docx.js internal structure varies.
     */
    function extractHeadingText(para) {
        if (!para) return null;
        try {
            var str = JSON.stringify(para);
            
            // Only check paragraphs that are headings (contain outline level indicator)
            if (str.indexOf('outlineLvl') < 0 && str.indexOf('Heading') < 0) return null;
            
            // Sections to strip from subsequent samples at the same site
            if (str.indexOf('Climate') >= 0 && str.indexOf('Growth Conditions') >= 0) {
                return 'Climate & Growth Conditions';
            }
            if (str.indexOf('Site Information') >= 0) {
                return 'Site Information';
            }
            // Site-level sections — same for all greens at a site, skip after first
            if (str.indexOf('Disease Risk Assessment') >= 0) return 'Disease Risk Assessment';
            if (str.indexOf('Disease Details') >= 0) return 'Disease Details';
            if (str.indexOf('Risk Drivers') >= 0) return 'Risk Drivers';
            if (str.indexOf('7-Day Forecast') >= 0) return '7-Day Forecast';
            if (str.indexOf('Active DMI Fungicide') >= 0) return 'Active DMI Fungicide';
            if (str.indexOf('Treatment Options') >= 0) return 'Treatment Options';
            if (str.indexOf('Moisture Management') >= 0) return 'Moisture Management';
            if (str.indexOf('Soil Moisture Zones') >= 0) return 'Soil Moisture Zones';
            if (str.indexOf('Zone-Specific Recommendations') >= 0) return 'Zone-Specific Recommendations';
            if (str.indexOf('14-Day Stress Trajectory') >= 0) return '14-Day Stress Trajectory';
            if (str.indexOf('Dew Forecast') >= 0) return 'Dew Forecast & Match Conditions';
            if (str.indexOf('Traffic & Wear Analysis') >= 0) return 'Traffic & Wear Analysis';
            if (str.indexOf('Phytotoxicity Risk') >= 0) return 'Phytotoxicity Risk';
            if (str.indexOf('Environmental Stress Factors') >= 0) return 'Environmental Stress Factors Affecting Recovery';
            if (str.indexOf('Evapotranspiration') >= 0) return 'Evapotranspiration & Species Selection';
            if (str.indexOf('Water Balance Chart') >= 0) return 'Water Balance Chart';
            if (str.indexOf('Water Balance Parameters') >= 0) return 'Water Balance Parameters';
            if (str.indexOf('Water Balance') >= 0) return 'Water Balance';
            if (str.indexOf('Leaching Requirement') >= 0) return 'Leaching Requirement';
            if (str.indexOf('Annual Nutrient Requirements') >= 0) return 'Annual Nutrient Requirements';
            if (str.indexOf('PGR Program Status') >= 0) return 'PGR Program Status';
            if (str.indexOf('Shade & Light') >= 0) return 'Shade & Light';
            if (str.indexOf('Cross-Module Pattern') >= 0) return 'Cross-Module Pattern Analysis';
            if (str.indexOf('Runtime Calculation') >= 0) return 'Runtime Calculation';
            if (str.indexOf('Nutrient Trend Analysis') >= 0) return 'Nutrient Trend Analysis';
            if (str.indexOf('Soil Nutrient Trends') >= 0) return 'Soil Nutrient Trends';
            if (str.indexOf('Tissue Analysis Trends') >= 0) return 'Tissue Analysis Trends';
            if (str.indexOf('Water Quality Trends') >= 0) return 'Water Quality Trends';
            if (str.indexOf('Water Quality') >= 0) return 'Water Quality';
            if (str.indexOf('Fairway/Tee') >= 0 && str.indexOf('Disease Assessment') >= 0) return 'Fairway/Tee — Disease Assessment';
            if (str.indexOf('Pre-Emergent Herbicide Timing') >= 0) return 'Pre-Emergent Herbicide Timing';
            if (str.indexOf('Active Alerts') >= 0) return 'Active Alerts';
            if (str.indexOf('Soil Amendment Recommendations') >= 0) return 'Soil Amendment Recommendations';
            if (str.indexOf('Performance Impact Analysis') >= 0) return 'Performance Impact Analysis';
            if (str.indexOf('Cultivar Performance Profile') >= 0) return 'Cultivar Performance Profile';
            // Trailing sections (appended once at end of document)
            if (str.indexOf('References') >= 0 && str.indexOf('Methodology') >= 0) {
                return 'References & Methodology';
            }
            if (str.indexOf('Glossary') >= 0 && str.indexOf('Terms') >= 0) {
                return 'Glossary of Terms';
            }
            if (str.indexOf('Report Metadata') >= 0 || str.indexOf('Report metadata') >= 0) {
                return 'Report Metadata';
            }
            if (str.indexOf('Methodology References') >= 0) {
                return 'Methodology References';
            }
            // Per-green headings — known, should not be treated as site-level
            if (str.indexOf('Soil Nutrition') >= 0) return 'Soil Nutrition';
            if (str.indexOf('pH and CEC') >= 0) return 'pH and CEC Context';
            if (str.indexOf('Trace Element') >= 0) return 'Trace Element Status';
            if (str.indexOf('Dual Interpretation') >= 0) return 'Dual Interpretation';
            if (str.indexOf('Priority Actions') >= 0) return 'Priority Actions';
            if (str.indexOf('Wollongong') >= 0 || str.indexOf('Green') >= 0) return 'Zone Heading';
            // Any other heading — return sentinel so skip-loops stop
            return '__heading__';
        } catch (e) {
            return null;
        }
    }

    /**
     * Check if a Paragraph is a page break or effectively empty.
     */
    function isPageBreak(para) {
        if (!para) return false;
        try {
            var str = JSON.stringify(para);
            // Page breaks are small paragraphs containing break type=page
            if (str.length > 500) return false;
            return str.indexOf('page') >= 0 && (str.indexOf('break') >= 0 || str.indexOf('Break') >= 0);
        } catch (e) {
            return false;
        }
    }

    // =========================================================================
    // DOCUMENT BUILDER
    // =========================================================================

    /**
     * Build cross-zone nutrient comparison table for the combined cover section.
     * TRANSPOSED: Rows = samples, columns = nutrients.
     * Deficit cells highlighted red, adequate green, missing grey.
     */
    function buildZoneComparisonTable(reports, docxRefs) {
        var Paragraph = docxRefs.Paragraph;
        var TextRun = docxRefs.TextRun;
        var Table = docxRefs.Table;
        var TableRow = docxRefs.TableRow;
        var TableCell = docxRefs.TableCell;
        var AlignmentType = docxRefs.AlignmentType;
        var WidthType = docxRefs.WidthType;
        var BorderStyle = docxRefs.BorderStyle;
        var ShadingType = docxRefs.ShadingType;
        var VerticalAlign = docxRefs.VerticalAlign;

        var rows = [];
        var border = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' };
        var borders = { top: border, bottom: border, left: border, right: border };
        var cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

        // Nutrients to compare — label, data.soil key, unit
        var nutrients = [
            { label: 'GP (%)',        key: '_gp',  unit: '%',   isGP: true },
            { label: 'pH',            key: 'pH',   unit: '' },
            { label: 'P (ppm)',       key: 'P',    unit: 'ppm' },
            { label: 'K (ppm)',       key: 'K',    unit: 'ppm' },
            { label: 'Ca (ppm)',      key: 'Ca',   unit: 'ppm' },
            { label: 'Mg (ppm)',      key: 'Mg',   unit: 'ppm' },
            { label: 'S (ppm)',       key: 'S',    unit: 'ppm' },
            { label: 'Na (ppm)',      key: 'Na',   unit: 'ppm' },
            { label: 'CEC',           key: 'CEC',  unit: '' }
        ];

        // TRANSPOSED: rows = samples, columns = nutrients
        // Fixed columns: Zone label + one column per nutrient
        var totalWidth = 9360;
        var zoneColW = 1400;   // zone name column
        var nutCount = nutrients.length;
        var nutColW = Math.floor((totalWidth - zoneColW) / nutCount);
        var columnWidths = [zoneColW];
        for (var ci = 0; ci < nutCount; ci++) columnWidths.push(nutColW);

        function makeHeaderCell(text, w) {
            return new TableCell({
                borders: borders,
                margins: cellMargins,
                width: { size: w, type: WidthType.DXA },
                shading: { fill: '059669', type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(text), bold: true, size: 16, color: 'FFFFFF' })]
                })]
            });
        }

        function makeDataCell(text, bgFill, w) {
            return new TableCell({
                borders: borders,
                margins: cellMargins,
                width: { size: w, type: WidthType.DXA },
                shading: bgFill ? { fill: bgFill, type: ShadingType.CLEAR } : undefined,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(text), size: 16, color: '1F2937' })]
                })]
            });
        }

        function makeZoneLabelCell(text) {
            return new TableCell({
                borders: borders,
                margins: cellMargins,
                width: { size: zoneColW, type: WidthType.DXA },
                shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    children: [new TextRun({ text: String(text), bold: true, size: 16, color: '374151' })]
                })]
            });
        }

        // Header row: "Zone" | nut1 | nut2 | ...
        var headerCells = [makeHeaderCell('Zone', zoneColW)];
        for (var ni = 0; ni < nutrients.length; ni++) {
            headerCells.push(makeHeaderCell(nutrients[ni].label, nutColW));
        }
        rows.push(new TableRow({ children: headerCells, tableHeader: true }));

        // One row per sample
        for (var ri = 0; ri < reports.length; ri++) {
            var rep = reports[ri];
            var d = rep.data;
            var zoneLabel = rep.sampleLabel || rep.sampleId || ('Zone ' + (ri + 1));
            var rowCells = [makeZoneLabelCell(zoneLabel)];

            for (var ni2 = 0; ni2 < nutrients.length; ni2++) {
                var nut = nutrients[ni2];
                var val, fill, displayText;

                if (nut.isGP) {
                    val = d.climate && d.climate.growthPotential !== undefined
                        ? Math.round(d.climate.growthPotential) : null;
                    if (val !== null) {
                        fill = val < 30 ? 'FEE2E2' : val < 60 ? 'FEF3C7' : 'D1FAE5';
                        displayText = val + '%';
                    }
                } else {
                    val = d.soil ? d.soil[nut.key] : null;
                    if (val !== null && val !== undefined) {
                        var thresh = d.soil && d.soil.thresholds && d.soil.thresholds[nut.key];
                        if (nut.key === 'pH' || nut.key === 'CEC' || nut.key === 'Na') {
                            fill = 'F9FAFB';
                        } else if (thresh && thresh.min !== undefined) {
                            fill = (parseFloat(val) < thresh.min) ? 'FEE2E2' : 'D1FAE5';
                        } else {
                            fill = 'F9FAFB';
                        }
                        displayText = typeof val === 'number' ? val.toFixed(val >= 10 ? 0 : 1) : String(val);
                    }
                }

                if (val === null || val === undefined) {
                    rowCells.push(makeDataCell('—', 'F9FAFB', nutColW));
                } else {
                    rowCells.push(makeDataCell(displayText, fill, nutColW));
                }
            }
            rows.push(new TableRow({ children: rowCells }));
        }

        return new Table({
            width: { size: totalWidth, type: WidthType.DXA },
            columnWidths: columnWidths,
            rows: rows
        });
    }

    // Compute ANR from raw soil ppm — avoids stale GAIP_NUTRITION_SOIL_CACHE across samples
    function computeANRFromSoil(soil) {
        if (!soil) return null;

        // Cotula S78 — ANR via N-uptake model is not valid (dicot, no tissue ratios).
        // Return a placeholder that the export table will render as S78 sufficiency status.
        if (soil.methodology === 'cotula_s78' || soil.surfaceType === 'cotula_bowling_green') {
            return { isCotula: true, s78: soil };
        }

        var methodology = (soil.methodology || 'MLSN').toUpperCase().replace(' ', '_');
        var isAA   = methodology === 'AMMONIUM_ACETATE';
        var isSLAN = methodology === 'SLAN';

        // MLSN minimums (Mehlich-3/Colwell calibration)
        var MLSN_MIN = { P: 21, K: 37, S: 6 };
        var MLSN_TARGET_MULT = 1.5;
        // SLAN sufficiency ranges midpoints (approximate)
        var SLAN_TARGET = { P: 37, K: 112, S: 18 }; // midpoints of typical SLAN sufficiency ranges

        var ph = soil.pH || soil.ph || 7;
        // pH-adjusted P threshold (MLSN only — SLAN P is pH-independent at lab level)
        var pMlsnMin = ph <= 5.5 ? 35 : ph <= 6.0 ? 28 : ph <= 7.5 ? 21 : ph <= 8.0 ? 32 : 40;
        MLSN_MIN.P = pMlsnMin;

        var YEARS = { P: 2, K: 2, S: 2 };

        var speciesKey = (soil.speciesKey || soil.species || 'bentgrass').toLowerCase()
            .replace(/\s+/g,'').replace('creepingbentgrass','bentgrass')
            .replace('hybridcouch','couch').replace('bermuda','couch');
        var REMOVAL = {
            bentgrass:         { P: 15, K: 80,  S: 8 },
            perennialryegrass: { P: 18, K: 100, S: 10 },
            kentuckybluegrass: { P: 16, K: 90,  S: 9 },
            finefescue:        { P: 10, K: 60,  S: 6 },
            tallfescue:        { P: 14, K: 80,  S: 8 },
            couch:             { P: 20, K: 120, S: 12 },
            zoysiagrass:       { P: 12, K: 70,  S: 7 },
            kikuyu:            { P: 25, K: 140, S: 14 },
            buffalo:           { P: 8,  K: 50,  S: 5 },
            seashorepaspalum:  { P: 16, K: 90,  S: 9 }
        };
        var removal = REMOVAL[speciesKey] || { P: 15, K: 80, S: 8 };

        function req(nutrient, currentPPM) {
            if (currentPPM == null || isNaN(currentPPM)) return null;
            var annual, status;

            if (isAA) {
                // AA extractant: thresholds calibrated for Mehlich-3/Colwell don't apply
                // Return removal-only — no deficit correction
                annual = removal[nutrient];
                status = 'Adequate'; // can't determine status without AA-calibrated thresholds
            } else if (isSLAN) {
                var target = SLAN_TARGET[nutrient];
                var correction = currentPPM < target ? (target - currentPPM) / YEARS[nutrient] : 0;
                annual = currentPPM > target ? 0 : Math.max(0, removal[nutrient] + correction);
                status = currentPPM < target * 0.5 ? 'Very Low'
                       : currentPPM < target       ? 'Low'
                       : currentPPM > target * 1.5 ? 'High'
                       : 'Adequate';
            } else {
                // MLSN strict three-tier:
                // Above target (min × 1.5): apply 0 — let soil draw down
                // Between min and target: apply removal only — maintain
                // Below min: apply removal + deficit correction
                var threshold = MLSN_MIN[nutrient];
                var mlsnTarget = threshold * MLSN_TARGET_MULT;
                var mlsnCorrection = currentPPM < threshold ? (mlsnTarget - currentPPM) / YEARS[nutrient] : 0;
                annual = currentPPM > mlsnTarget ? 0 : Math.max(0, removal[nutrient] + mlsnCorrection);
                status = currentPPM < threshold * 0.5 ? 'Very Low'
                       : currentPPM < threshold       ? 'Low'
                       : currentPPM > mlsnTarget * 2  ? 'Excessive'
                       : currentPPM > mlsnTarget       ? 'High'
                       : 'Adequate';
            }

            return { val: Math.round(annual * 10) / 10, status: status };
        }

        return { P: req('P', soil.P), K: req('K', soil.K), S: req('S', soil.S) };
    }

    async function buildCombinedDocument(reports) {
        // docx.js globals (same as word-export.js)
        var Document = global.docx.Document;
        var Packer = global.docx.Packer;
        var Paragraph = global.docx.Paragraph;
        var TextRun = global.docx.TextRun;
        var Table = global.docx.Table;
        var TableRow = global.docx.TableRow;
        var TableCell = global.docx.TableCell;
        var WidthType = global.docx.WidthType;
        var BorderStyle = global.docx.BorderStyle;
        var ShadingType = global.docx.ShadingType;
        var VerticalAlign = global.docx.VerticalAlign;
        var AlignmentType = global.docx.AlignmentType;
        var Header = global.docx.Header;
        var Footer = global.docx.Footer;
        var PageNumber = global.docx.PageNumber;
        var PageBreak = global.docx.PageBreak;
        var HeadingLevel = global.docx.HeadingLevel;
        var ImageRun = global.docx.ImageRun;

        var we = global.GAIP_WordExport;

        // Build sections array: one set of content per report, with page breaks between
        var allChildren = [];

        // Cover page
        allChildren.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));

        // Logo (if uploaded) — same logic as word-export.js
        var combinedLogo = typeof global.GAIP_getReportLogo === 'function' ? global.GAIP_getReportLogo() : null;
        if (combinedLogo && combinedLogo.base64) {
            try {
                var clBase64 = combinedLogo.base64.split(',')[1] || combinedLogo.base64;
                var clMaxW = 180, clMaxH = 80;
                var clScale = Math.min(clMaxW / combinedLogo.width, clMaxH / combinedLogo.height, 1);
                var clW = Math.round(combinedLogo.width * clScale);
                var clH = Math.round(combinedLogo.height * clScale);
                allChildren.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 120 },
                    children: [new ImageRun({
                        type: combinedLogo.type.includes('png') ? 'png' : 'jpg',
                        data: Uint8Array.from(atob(clBase64), function(c) { return c.charCodeAt(0); }),
                        transformation: { width: clW, height: clH },
                        altText: { title: 'Organisation Logo', description: 'Custom logo for report header', name: 'logo_combined_cover' }
                    })]
                }));
            } catch (e) {
                console.warn('[CombinedExport] Error adding logo to cover:', e);
            }
        }

        allChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: 'Gilba Agronomic Intelligence Hub', bold: true, size: 48, color: '059669' })]
        }));
        allChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: 'Combined Analysis Report', bold: true, size: 44, color: '374151' })]
        }));

        // Summary of contents
        var siteGroups = {};
        reports.forEach(function(r) {
            if (!siteGroups[r.siteLabel]) siteGroups[r.siteLabel] = [];
            siteGroups[r.siteLabel].push(r.sampleLabel || r.sampleId);
        });

        allChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: reports.length + ' samples across ' + Object.keys(siteGroups).length + ' site(s)', size: 24, color: '6B7280' })]
        }));

        var siteKeys = Object.keys(siteGroups);
        for (var sk = 0; sk < siteKeys.length; sk++) {
            var siteSamples = siteGroups[siteKeys[sk]];
            allChildren.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 40 },
                children: [
                    new TextRun({ text: siteKeys[sk] + ': ', bold: true, size: 22, color: '374151' }),
                    new TextRun({ text: siteSamples.join(', '), size: 22, color: '6B7280' })
                ]
            }));
        }

        allChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
            children: [new TextRun({ text: 'Generated: ' + new Date().toLocaleString(), size: 20, color: '9CA3AF' })]
        }));

        // Cross-Module Pattern Analysis — before Zone Comparison
        // Pulled directly from the same global used by word-export.js
        var combinedSynthesis = window.GAIP_SYNTHESIS_INTERPRETATION;
        if (combinedSynthesis && combinedSynthesis.narrative) {
            allChildren.push(new Paragraph({ children: [new PageBreak()] }));
            allChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                keepNext: true,
                spacing: { before: 0, after: 100 },
                children: [new TextRun({ text: 'Cross-Module Pattern Analysis', bold: true, size: 36, color: '059669' })]
            }));
            allChildren.push(new Paragraph({
                spacing: { after: 150 },
                children: [new TextRun({
                    text: 'AI-assisted analysis identifying interactions and anomalies across soil, water, and tissue data.',
                    size: 20, italics: true, color: '6B7280'
                })]
            }));

            var csSynth = combinedSynthesis.narrative
                .replace(/^##+ /gm, '')
                .replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<</BOLD>>');

            csSynth.split(/\n\n+/).forEach(function(para) {
                if (!para.trim()) return;
                var isHeader = /^(Key Findings|Pattern Analysis|Recommended Actions|Monitoring Priority)/i.test(para.trim());
                if (isHeader) {
                    var hText = para.trim().split('\n')[0].replace(/<<BOLD>>|<<\/BOLD>>/g, '');
                    allChildren.push(new Paragraph({
                        spacing: { before: 200, after: 80 },
                        children: [new TextRun({ text: hText, bold: true, size: 22, color: '6D28D9' })]
                    }));
                    para = para.split('\n').slice(1).join('\n');
                    if (!para.trim()) return;
                }
                if (para.trim().startsWith('-') || para.trim().startsWith('•')) {
                    para.split('\n').filter(function(l) { return l.trim(); }).forEach(function(line) {
                        line = line.replace(/^[-•]\s*/, '');
                        var bChildren = [];
                        var isBold = false;
                        line.split(/<<BOLD>>|<<\/BOLD>>/).forEach(function(part) {
                            if (part) bChildren.push(new TextRun({ text: part, bold: isBold, size: 20, color: isBold ? '6D28D9' : '374151' }));
                            isBold = !isBold;
                        });
                        allChildren.push(new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 300 }, bullet: { level: 0 }, children: bChildren }));
                    });
                    return;
                }
                var pChildren = [];
                var isPBold = false;
                para.split(/<<BOLD>>|<<\/BOLD>>/).forEach(function(part) {
                    if (part) pChildren.push(new TextRun({ text: part, bold: isPBold, size: 20, color: isPBold ? '6D28D9' : '374151' }));
                    isPBold = !isPBold;
                });
                allChildren.push(new Paragraph({ spacing: { after: 100 }, children: pChildren }));
            });

            if (combinedSynthesis.cached) {
                allChildren.push(new Paragraph({
                    spacing: { before: 50, after: 100 },
                    children: [new TextRun({ text: '(Cached analysis)', size: 14, italics: true, color: '9CA3AF' })]
                }));
            }
            allChildren.push(new Paragraph({ children: [] }));
        }

        // Zone Comparison section — only rendered when ≥2 samples present
        if (reports.length >= 2) {
            allChildren.push(new Paragraph({ children: [new PageBreak()] }));
            allChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 0, after: 200 },
                children: [new TextRun({ text: 'Zone Comparison', bold: true, size: 36, color: '059669' })]
            }));
            allChildren.push(new Paragraph({
                spacing: { after: 240 },
                children: [new TextRun({
                    text: 'Soil nutrient status and growth potential across all analysed zones. ' +
                          'Green = adequate (above MLSN minimum). Red = deficit (below MLSN minimum). ' +
                          'Amber = low growth potential.',
                    size: 18, color: '6B7280'
                })]
            }));
            try {
                var compTable = buildZoneComparisonTable(reports, {
                    Paragraph: Paragraph, TextRun: TextRun,
                    Table: Table, TableRow: TableRow, TableCell: TableCell,
                    AlignmentType: AlignmentType, WidthType: WidthType,
                    BorderStyle: BorderStyle, ShadingType: ShadingType, VerticalAlign: VerticalAlign
                });
                allChildren.push(compTable);
            } catch (e) {
                warn('Zone comparison table failed:', e);
            }

            // Zone soil charts — two across the page below the comparison table
            try {
                // Collect reports that have a soil chart
                var chartReports = reports.filter(function(r) { return r.charts && r.charts.soil; });
                if (chartReports.length > 0) {
                    allChildren.push(new Paragraph({
                        spacing: { before: 360, after: 120 },
                        children: [new TextRun({ text: 'Zone Soil Nutrient Charts', bold: true, size: 22, color: '374151' })]
                    }));

                    // Two-column layout: pair up reports
                    var cellW = 4320; // half A4 usable width in DXA (~3")
                    var imgW = 272;   // px — fits in ~3" column with margins
                    var imgH = 109;   // maintain 500:200 aspect ratio

                    var noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
                    var noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

                    for (var ci = 0; ci < chartReports.length; ci += 2) {
                        var cellsInRow = [];
                        for (var cj = ci; cj < Math.min(ci + 2, chartReports.length); cj++) {
                            var cr = chartReports[cj];
                            var soilChart = cr.charts.soil;
                            var scaledW = imgW, scaledH = imgH;
                            if (soilChart.width && soilChart.height) {
                                var scale = Math.min(imgW / soilChart.width, imgH / soilChart.height);
                                scaledW = Math.round(soilChart.width * scale);
                                scaledH = Math.round(soilChart.height * scale);
                            }
                            if (typeof global.GAIP_WordExport_imageIdCounter !== 'undefined') global.GAIP_WordExport_imageIdCounter++;
                            var zoneChartId = typeof global.GAIP_WordExport_imageIdCounter !== 'undefined' ? global.GAIP_WordExport_imageIdCounter : (cj + 1000);
                            cellsInRow.push(new TableCell({
                                borders: noBorders,
                                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                                width: { size: cellW, type: WidthType.DXA },
                                children: [
                                    new Paragraph({
                                        spacing: { after: 60 },
                                        children: [new TextRun({ text: cr.sampleLabel || cr.sampleId, bold: true, size: 18, color: '059669' })]
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: [new ImageRun({
                                            type: 'png',
                                            data: Uint8Array.from(atob(soilChart.base64), function(c) { return c.charCodeAt(0); }),
                                            transformation: { width: scaledW, height: scaledH },
                                            altText: { title: 'Soil Chart', description: cr.sampleId + ' soil nutrients', name: 'soilchart_zone_' + zoneChartId }
                                        })]
                                    })
                                ]
                            }));
                        }
                        // If odd number, pad with empty cell
                        if (cellsInRow.length === 1) {
                            cellsInRow.push(new TableCell({
                                borders: noBorders,
                                width: { size: cellW, type: WidthType.DXA },
                                children: [new Paragraph({ children: [] })]
                            }));
                        }
                        allChildren.push(new Table({
                            rows: [new TableRow({ children: cellsInRow })],
                            width: { size: 100, type: WidthType.PERCENTAGE }
                        }));
                    }
                }
            } catch (e) {
                warn('Zone chart grid failed:', e);
            }
        }

        // Sections to strip from individual reports (only include once at the end)
        var stripHeadings = ['References & Methodology', 'Glossary of Terms', 
                            'Report Metadata', 'Methodology References'];

        // Keep one copy of the trailing sections from the first report
        var trailingSections = null;

        // Track which sites have already had their shared sections (climate, site info) included
        var seenSites = {};

        // Each report gets a page break + sections (minus titles/References/Glossary/Metadata)
        for (var r = 0; r < reports.length; r++) {
            var report = reports[r];
            var isFirstForSite = !seenSites[report.siteId];
            seenSites[report.siteId] = true;

            // Page break before each report
            allChildren.push(new Paragraph({ children: [new PageBreak()] }));

            // Section header showing site + sample
            allChildren.push(new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({ text: report.siteLabel, bold: true, size: 28, color: '059669' }),
                    new TextRun({ text: '  \u2014  ', size: 28, color: '9CA3AF' }),
                    new TextRun({ text: report.sampleLabel || report.sampleId, bold: true, size: 28, color: '374151' })
                ]
            }));

            allChildren.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: 'Report ' + (r + 1) + ' of ' + reports.length, size: 18, color: '9CA3AF' })]
            }));

            // Build report sections using standard pipeline
            try {
                var sections = we.buildSections(report.data, report.charts);
                console.log('[CombinedExport] Report', report.sampleId, 'has', sections.length, 'sections');

                // Identify cut points for stripping
                var startIndex = 0;   // skip leading titles
                var endIndex = sections.length;  // cut trailing refs/glossary

                // Strip leading title paragraphs ("Gilba Agronomic..." and "Comprehensive Analysis Report")
                for (var si = 0; si < Math.min(sections.length, 5); si++) {
                    var str = JSON.stringify(sections[si]);
                    if (str.indexOf('Gilba Agronomic Intelligence Hub') >= 0 ||
                        str.indexOf('Comprehensive Analysis Report') >= 0) {
                        startIndex = si + 1;
                    }
                }
                if (startIndex > 0) {
                    log('  Stripping', startIndex, 'leading title paragraphs');
                }

                // Find where trailing sections start (References, Metadata, Glossary)
                for (var si2 = startIndex; si2 < sections.length; si2++) {
                    var heading = extractHeadingText(sections[si2]);
                    if (heading) {
                        log('  [' + si2 + '] heading:', heading);
                    }
                    if (heading && stripHeadings.indexOf(heading) >= 0) {
                        endIndex = si2;
                        log('  Cut point found at index', endIndex, ':', heading);
                        // Walk back to skip preceding page break
                        if (endIndex > startIndex && isPageBreak(sections[endIndex - 1])) {
                            endIndex--;
                        }
                        break;
                    }
                }

                // Save trailing sections from first report only
                if (endIndex < sections.length && !trailingSections) {
                    trailingSections = sections.slice(endIndex);
                    // Also strip the trailing "Generated by..." line from trailingSections
                    // It'll be at the very end
                }

                log('  Using sections [' + startIndex + ',' + endIndex + ') of', sections.length);

                // Add only the content sections
                for (var si3 = startIndex; si3 < endIndex; si3++) {
                    // Skip trailing page breaks to avoid blank pages
                    if (si3 === endIndex - 1 && isPageBreak(sections[si3])) continue;
                    // Skip "Generated by Gilba..." footer line
                    var secStr = JSON.stringify(sections[si3]);
                    if (secStr.indexOf('Generated by Gilba') >= 0) continue;
                    // Log trace chart position
                    if (secStr.indexOf('trace Chart') >= 0) {
                        log('  Trace chart at section index', si3, '(range [' + startIndex + ',' + endIndex + '))');
                    }
                    
                    // Clean TOC: strip References/Metadata/Glossary entries from Contents paragraph
                    if (secStr.indexOf('References') >= 0 && secStr.indexOf('Glossary') >= 0 && secStr.indexOf('Site Information') >= 0) {
                        var cleaned = cleanTocParagraph(sections[si3]);
                        if (cleaned) {
                            allChildren.push(cleaned);
                            continue;
                        }
                    }

                    // Cross-Module is injected once at combined doc level — strip from every individual report
                    var alwaysStripHeading = extractHeadingText(sections[si3]);
                    if (alwaysStripHeading === 'Cross-Module Pattern Analysis') {
                        var skipCM = true;
                        while (skipCM && si3 + 1 < endIndex) {
                            si3++;
                            if (extractHeadingText(sections[si3])) { si3--; skipCM = false; }
                        }
                        continue;
                    }

                    // For subsequent samples at the same site, skip Site Information and Climate
                    // (both are site-level, not per-green — Climate now appears after Soil Nutrition)
                    if (!isFirstForSite) {
                        var sectionHeading = extractHeadingText(sections[si3]);
                        var siteLevelHeadings = [
                            'Site Information',
                            'Climate & Growth Conditions',
                            'Disease Risk Assessment',
                            'Disease Details',
                            'Risk Drivers',
                            '7-Day Forecast',
                            'Active DMI Fungicide',
                            'Treatment Options',
                            'Moisture Management',
                            'Soil Moisture Zones',
                            'Zone-Specific Recommendations',
                            '14-Day Stress Trajectory',
                            'Dew Forecast & Match Conditions',
                            'Traffic & Wear Analysis',
                            'Phytotoxicity Risk',
                            'Salinity Stress Impact',
                            'Salinity & Stress Interactions',
                            'Environmental Stress Factors Affecting Recovery',
                            'Evapotranspiration & Species Selection',
                            'Water Balance',
                            'Water Balance Parameters',
                            'Water Balance Chart',
                            'Leaching Requirement',
                            'Annual Nutrient Requirements',
                            'PGR Program Status',
                            'Shade & Light',
                            'Cross-Module Pattern Analysis',
                            'Runtime Calculation',
                            'Nutrient Trend Analysis',
                            'Soil Nutrient Trends',
                            'Tissue Analysis Trends',
                            'Water Quality Trends',
                            'Water Quality',
                            'Fairway/Tee — Disease Assessment',
                            'Pre-Emergent Herbicide Timing',
                            'Active Alerts',
                            'Soil Amendment Recommendations',
                            'Performance Impact Analysis',
                            'Cultivar Performance Profile'
                        ];
                        if (siteLevelHeadings.indexOf(sectionHeading) >= 0) {
                            // Skip this heading and the content until the next heading
                            var skipUntilNextHeading = true;
                            while (skipUntilNextHeading && si3 + 1 < endIndex) {
                                si3++;
                                var nextHeading = extractHeadingText(sections[si3]);
                                if (nextHeading) {
                                    // Hit the next heading — back up so the outer loop processes it
                                    si3--;
                                    skipUntilNextHeading = false;
                                }
                            }
                            continue;
                        }
                    }

                    allChildren.push(sections[si3]);
                }
            } catch (err) {
                console.error('[CombinedExport] Failed to build sections for', report.sampleId, ':', err && err.stack ? err.stack : err);
                warn('Failed to build sections for', report.sampleId, ':', err && err.message ? err.message : String(err));
                allChildren.push(new Paragraph({
                    children: [new TextRun({ text: 'Error generating report for ' + report.sampleId + ': ' + (err && err.message ? err.message : String(err)), color: 'DC2626' })]
                }));
            }
        }

        // Consolidated Annual Nutrient Requirements table (all greens side by side)
        // Use computeANRFromSoil() per report — GAIP_NUTRITION_SOIL_CACHE is stale across samples
        var anrReports = reports.filter(function(r) {
            return r.data && r.data.soil && r.data.soil.hasData && (r.data.soil.P != null || r.data.soil.K != null);
        });
        // Pre-compute ANR for each report from its own soil data
        anrReports.forEach(function(r) { r._anr = computeANRFromSoil(r.data.soil); });
        if (anrReports.length > 0) {
            var BorderStyle = docx.BorderStyle;
            var WidthType = docx.WidthType;
            var AlignmentType = docx.AlignmentType;
            var ShadingType = docx.ShadingType;

            allChildren.push(new Paragraph({ children: [new PageBreak()] }));
            allChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_1, keepNext: true,
                children: [new TextRun('Annual Nutrient Requirements')]
            }));
            // Subtitle: reflect actual methodology — may differ per green if mixed
            var methodLabels = anrReports.map(function(r) {
                var m = r.data.soil && r.data.soil.methodology ? r.data.soil.methodology.toUpperCase() : 'MLSN';
                if (m === 'COTULA_S78') return 'S78';
                if (m === 'AMMONIUM_ACETATE' || m === 'AMMONIUM ACETATE') return 'AA';
                if (m === 'SLAN') return 'SLAN';
                return 'MLSN';
            });
            var uniqueMethods = methodLabels.filter(function(v, i, a) { return a.indexOf(v) === i; });
            var methodStr = uniqueMethods.join('/');
            var subtitleText = methodStr === 'MLSN' ? 'MLSN removal + deficit correction. All rates kg/ha/yr.'
                             : methodStr === 'SLAN'  ? 'SLAN sufficiency-based requirements. All rates kg/ha/yr.'
                             : methodStr === 'AA'    ? 'Ammonium acetate extraction — removal-only estimate (MLSN/SLAN thresholds not applicable). All rates kg/ha/yr.'
                             : methodStr === 'S78'   ? 'Hill Labs S78 — Turf Cotula. Sufficiency-based interpretation. MLSN does not apply to cotula.'
                             : 'Requirements based on ' + methodStr + ' methodology. All rates kg/ha/yr.';
            allChildren.push(new Paragraph({
                spacing: { before: 50, after: 160 },
                children: [new TextRun({ text: subtitleText, size: 20, italics: true, color: '6B7280' })]
            }));

            // Build comparison table: nutrient rows with ppm context sub-rows for P/K/S
            var noBorder = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' };
            var noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
            var colW = Math.floor(8800 / (anrReports.length + 1));

            // Header row
            var hdrCells = [new TableCell({
                borders: noBorders, shading: { fill: '1F2937', type: ShadingType.CLEAR },
                width: { size: colW, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: 'Nutrient', bold: true, size: 18, color: 'FFFFFF' })] })]
            })];
            anrReports.forEach(function(r) {
                hdrCells.push(new TableCell({
                    borders: noBorders, shading: { fill: '1F2937', type: ShadingType.CLEAR },
                    width: { size: colW, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.sampleLabel || r.sampleId, bold: true, size: 18, color: 'FFFFFF' })] })]
                }));
            });

            var tableRows = [new TableRow({ children: hdrCells })];

            // ── Detect if any reports are cotula S78 ─────────────────────────
            var hasCotula = anrReports.some(function(r) {
                return r._anr && r._anr.isCotula;
            });
            var hasStandard = anrReports.some(function(r) {
                return !r._anr || !r._anr.isCotula;
            });

            if (hasCotula && !hasStandard) {
                // ── All-cotula report: S78 sufficiency table ──────────────
                var S78_ROWS = [
                    { key: 'pH',         label: 'pH',        unit: '',        range: '5.8–6.5' },
                    { key: 'P_olsen',    label: 'Olsen P',   unit: 'mg/L',    range: '20–30' },
                    { key: 'K_pct_bs',   label: 'K %BS',     unit: '%',       range: '3.0–6.0' },
                    { key: 'Ca_pct_bs',  label: 'Ca %BS',    unit: '%',       range: '45–75' },
                    { key: 'Mg_pct_bs',  label: 'Mg %BS',    unit: '%',       range: '5.0–15.0' },
                    { key: 'Na_pct_bs',  label: 'Na %BS',    unit: '%',       range: '0–5.0' },
                    { key: 'CEC',        label: 'CEC',        unit: 'me/100g', range: '12–25' },
                    { key: 'TBS',        label: 'Total BS',   unit: '%',       range: '40–80' },
                    { key: 'VW',         label: 'Vol. Wt',   unit: 'g/mL',    range: '0.60–1.00' },
                    { key: 'K_Mg_ratio', label: 'K/Mg',       unit: '',        range: '0.3–1.0' }
                ];

                S78_ROWS.forEach(function(rowDef, ri) {
                    var rowFill = ri % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
                    var cells = [new TableCell({
                        borders: noBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                        width: { size: colW, type: WidthType.DXA },
                        children: [
                            new Paragraph({ children: [new TextRun({ text: rowDef.label, bold: true, size: 18 })] }),
                            new Paragraph({ children: [new TextRun({ text: (rowDef.unit ? rowDef.unit + '  ' : '') + 'Range: ' + rowDef.range, size: 15, color: '9CA3AF', italics: true })] })
                        ]
                    })];
                    anrReports.forEach(function(r) {
                        var soil = r._anr && r._anr.s78 ? r._anr.s78 : (r.data && r.data.soil ? r.data.soil : null);
                        var raw = soil ? soil[rowDef.key] : null;
                        var interp = null;
                        if (window.GAIP_CotulaBowling && soil) {
                            try { interp = window.GAIP_CotulaBowling.interpretS78Value(rowDef.key, parseFloat(raw)); } catch(e) {}
                        }
                        var color = !interp ? '6B7280'
                                  : interp.status === 'LOW'  ? 'DC2626'
                                  : interp.status === 'HIGH' ? 'F59E0B'
                                  : '16A34A';
                        var displayVal = raw != null ? (parseFloat(raw).toFixed(2).replace(/\.?0+$/, '') + (rowDef.unit ? ' ' + rowDef.unit : '')) : '—';
                        var statusLabel = interp ? (' (' + interp.status + ')') : '';
                        cells.push(new TableCell({
                            borders: noBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                            width: { size: colW, type: WidthType.DXA },
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
                                new TextRun({ text: displayVal, bold: true, size: 18, color: color }),
                                new TextRun({ text: statusLabel, size: 15, color: color, italics: true })
                            ]})]
                        }));
                    });
                    tableRows.push(new TableRow({ children: cells }));
                });

                // N rate row for cotula — empirical range, not MLSN-derived
                var nFill = 'EFF6FF';
                var nCells = [new TableCell({
                    borders: noBorders, shading: { fill: nFill, type: ShadingType.CLEAR },
                    width: { size: colW, type: WidthType.DXA },
                    children: [
                        new Paragraph({ children: [new TextRun({ text: 'N program', bold: true, size: 19 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'kg N/ha/yr (empirical — no GP model)', size: 15, italics: true, color: '9CA3AF' })] })
                    ]
                })];
                anrReports.forEach(function() {
                    nCells.push(new TableCell({
                        borders: noBorders, shading: { fill: nFill, type: ShadingType.CLEAR },
                        width: { size: colW, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '50–120', bold: true, size: 19, color: '1D4ED8' })] })]
                    }));
                });
                tableRows.push(new TableRow({ children: nCells }));

            } else {
                // ── Standard MLSN/SLAN/AA nutrient rows ───────────────────
                // N — single row, no soil ppm equivalent
                var nFill = 'F9FAFB';
                var nCells = [new TableCell({
                    borders: noBorders, shading: { fill: nFill, type: ShadingType.CLEAR },
                    width: { size: colW, type: WidthType.DXA },
                    children: [
                        new Paragraph({ children: [new TextRun({ text: 'N (Total)', bold: true, size: 19 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'kg/ha/yr', size: 16, color: '9CA3AF' })] })
                    ]
                })];
                anrReports.forEach(function(r) {
                    var ns = r.data.nutritionSummary;
                    var val = ns && ns.totalN ? parseFloat(ns.totalN).toFixed(0) : '—';
                    nCells.push(new TableCell({
                        borders: noBorders, shading: { fill: nFill, type: ShadingType.CLEAR },
                        width: { size: colW, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: val, bold: true, size: 19, color: '111827' })] })]
                    }));
                });
                tableRows.push(new TableRow({ children: nCells }));

            // P, K, S — each gets a ppm context row (grey/italic) then a kg/ha/yr requirement row
            var pksDefs = [
                { label: 'P', ppmKey: 'P', anrKey: 'P' },
                { label: 'K', ppmKey: 'K', anrKey: 'K' },
                { label: 'S', ppmKey: 'S', anrKey: 'S' }
            ];
            pksDefs.forEach(function(nut, ni) {
                var rowFill = ni % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
                var ppmFill = ni % 2 === 0 ? 'F3F4F6' : 'ECECEC';

                // ppm row — current soil level, coloured by status
                var ppmCells = [new TableCell({
                    borders: noBorders, shading: { fill: ppmFill, type: ShadingType.CLEAR },
                    width: { size: colW, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: nut.label + ' (soil ppm)', italics: true, size: 17, color: '6B7280' })] })]
                })];
                anrReports.forEach(function(r) {
                    var ppm = r.data.soil && r.data.soil[nut.ppmKey] != null ? r.data.soil[nut.ppmKey] : null;
                    var anrResult = r._anr && r._anr[nut.anrKey];
                    var ppmColor = anrResult
                        ? (anrResult.status === 'Very Low' ? 'DC2626'
                         : anrResult.status === 'Low'     ? 'F59E0B'
                         : anrResult.status === 'Excessive'? 'F59E0B'
                         : '16A34A')
                        : '6B7280';
                    ppmCells.push(new TableCell({
                        borders: noBorders, shading: { fill: ppmFill, type: ShadingType.CLEAR },
                        width: { size: colW, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ppm != null ? ppm.toFixed(0) + ' ppm' : '—', size: 17, color: ppmColor, italics: true })] })]
                    }));
                });
                tableRows.push(new TableRow({ children: ppmCells }));

                // kg/ha/yr row
                var reqCells = [new TableCell({
                    borders: noBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                    width: { size: colW, type: WidthType.DXA },
                    children: [
                        new Paragraph({ children: [new TextRun({ text: nut.label + ' requirement', bold: true, size: 19 })] }),
                        new Paragraph({ children: [new TextRun({ text: 'kg/ha/yr', size: 16, color: '9CA3AF' })] })
                    ]
                })];
                anrReports.forEach(function(r) {
                    var result = r._anr && r._anr[nut.anrKey];
                    var color = result && (result.status === 'Low' || result.status === 'Very Low') ? 'DC2626'
                              : result && result.status === 'Excessive' ? 'F59E0B'
                              : '16A34A';
                    var text = result && result.val != null ? parseFloat(result.val).toFixed(1) : '—';
                    reqCells.push(new TableCell({
                        borders: noBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                        width: { size: colW, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text, bold: true, size: 19, color: color })] })]
                    }));
                });
                tableRows.push(new TableRow({ children: reqCells }));
            }); // end pksDefs.forEach

            } // end if hasCotula / else standard

            allChildren.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));

            // Monthly N distribution — one row per green
            var hasMonthlyN = anrReports.some(function(r) { return r.data.nutritionSummary.monthlyN && r.data.nutritionSummary.monthlyN.length > 0; });
            if (hasMonthlyN) {
                allChildren.push(new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: 'Monthly N Distribution (kg N/ha) — GP-Weighted', bold: true, size: 22 })] }));

                var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                // Header
                var mHdrCells = [new TableCell({
                    borders: noBorders, shading: { fill: '1F2937', type: ShadingType.CLEAR },
                    width: { size: 1400, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Green', bold: true, size: 17, color: 'FFFFFF' })] })]
                })];
                monthNames.forEach(function(m) {
                    mHdrCells.push(new TableCell({
                        borders: noBorders, shading: { fill: '1F2937', type: ShadingType.CLEAR },
                        width: { size: 620, type: WidthType.DXA },
                        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m, bold: true, size: 15, color: 'FFFFFF' })] })]
                    }));
                });
                var mTableRows = [new TableRow({ children: mHdrCells })];

                anrReports.forEach(function(r, ri) {
                    var mFill = ri % 2 === 0 ? 'F9FAFB' : 'FFFFFF';
                    var mData = r.data.nutritionSummary.monthlyN || [];
                    var mCells = [new TableCell({
                        borders: noBorders, shading: { fill: mFill, type: ShadingType.CLEAR },
                        width: { size: 1400, type: WidthType.DXA },
                        children: [new Paragraph({ children: [new TextRun({ text: r.sampleLabel || r.sampleId, bold: true, size: 17 })] })]
                    })];
                    monthNames.forEach(function(m, mi) {
                        var monthData = mData[mi] || {};
                        var n = monthData.n || 0;
                        var nColor = n > 15 ? '16A34A' : n > 10 ? '65A30D' : n > 5 ? 'F59E0B' : '9CA3AF';
                        mCells.push(new TableCell({
                            borders: noBorders, shading: { fill: mFill, type: ShadingType.CLEAR },
                            width: { size: 620, type: WidthType.DXA },
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: n > 0 ? n.toFixed(0) : '—', bold: n > 0, size: 17, color: nColor })] })]
                        }));
                    });
                    mTableRows.push(new TableRow({ children: mCells }));
                });
                allChildren.push(new Table({ rows: mTableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
            }
            allChildren.push(new Paragraph({ children: [] }));
        }

        // Append ONE copy of References, Metadata, Glossary at the end
        if (trailingSections) {
            for (var ti = 0; ti < trailingSections.length; ti++) {
                allChildren.push(trailingSections[ti]);
            }
        }

        // Create document
        var doc = new Document({
            features: { updateFields: true },
            styles: {
                default: { document: { run: { font: 'Calibri', size: 22 } } },
                paragraphStyles: [
                    { id: 'Title', name: 'Title', basedOn: 'Normal',
                      run: { size: 48, bold: true, color: '1F2937', font: 'Calibri' },
                      paragraph: { spacing: { before: 0, after: 60 }, alignment: AlignmentType.CENTER } },
                    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                      run: { size: 28, bold: true, color: '059669', font: 'Calibri' },
                      paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
                    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                      run: { size: 24, bold: true, color: '374151', font: 'Calibri' },
                      paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } }
                ]
            },
            sections: [{
                properties: {
                    page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } }
                },
                headers: {
                    default: new Header({ children: [new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: 'GAIP Combined Report', size: 18, color: '9CA3AF' })]
                    })] })
                },
                footers: {
                    default: new Footer({ children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: 'Page ', size: 18, color: '9CA3AF' }),
                            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9CA3AF' }),
                            new TextRun({ text: ' of ', size: 18, color: '9CA3AF' }),
                            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '9CA3AF' })
                        ]
                    })] })
                },
                children: allChildren
            }]
        });

        // Generate and download
        var blob = await Packer.toBlob(doc);
        
        // Fix duplicate image IDs if the function is available
        if (typeof global.GAIP_WordExport_fixDuplicateImageIds === 'function') {
            try {
                blob = await global.GAIP_WordExport_fixDuplicateImageIds(blob);
            } catch (e) {
                warn('Could not fix duplicate image IDs:', e);
            }
        }

        var dateStr = new Date().toISOString().split('T')[0];
        var filename = 'GAIP_Combined_Report_' + dateStr + '.docx';

        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log('Combined document downloaded:', filename, '(' + reports.length + ' reports)');
    }

    // =========================================================================
    // SAMPLE PICKER DIALOG
    // =========================================================================

    function showSamplePicker(samples, scope) {
        return new Promise(function(resolve) {
            // Group by site
            var groups = {};
            samples.forEach(function(s) {
                if (!groups[s.siteLabel]) groups[s.siteLabel] = [];
                groups[s.siteLabel].push(s);
            });

            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

            var box = document.createElement('div');
            box.style.cssText = 'background:var(--gaip-surface);border-radius:12px;padding:24px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.3);font-family:Calibri,Arial,sans-serif;min-width:360px;max-width:500px;max-height:80vh;overflow-y:auto;';

            var html = '<h3 style="margin:0 0 4px;color:#059669;font-size:16px;">📋 Combined Report</h3>';
            html += '<p style="margin:0 0 16px;color:var(--gaip-text-secondary);font-size:13px;">Select the samples to include:</p>';

            var siteKeys = Object.keys(groups);
            for (var g = 0; g < siteKeys.length; g++) {
                var siteSamples = groups[siteKeys[g]];
                if (siteKeys.length > 1) {
                    html += '<div style="font-weight:600;color:var(--gaip-text);font-size:13px;margin:12px 0 6px;border-bottom:1px solid var(--gaip-border);padding-bottom:4px;">' + siteKeys[g] + '</div>';
                }
                for (var s = 0; s < siteSamples.length; s++) {
                    var entry = siteSamples[s];
                    var uid = entry.siteId + '::' + entry.sampleId;
                    html += '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:14px;color:var(--gaip-text);">';
                    html += '<input type="checkbox" checked data-sample-uid="' + uid + '" style="width:16px;height:16px;accent-color:#059669;"> ';
                    html += entry.sampleId;
                    html += '</label>';
                }
            }

            html += '<div style="display:flex;gap:8px;margin-top:16px;justify-content:space-between;align-items:center;">';
            html += '<div>';
            html += '<button id="combined-pick-all" style="padding:4px 10px;border:1px solid var(--gaip-border);background:var(--gaip-surface);border-radius:4px;cursor:pointer;font-size:12px;color:var(--gaip-text-secondary);margin-right:4px;">Select All</button>';
            html += '<button id="combined-pick-none" style="padding:4px 10px;border:1px solid var(--gaip-border);background:var(--gaip-surface);border-radius:4px;cursor:pointer;font-size:12px;color:var(--gaip-text-secondary);">Deselect All</button>';
            html += '</div>';
            html += '<div>';
            html += '<button id="combined-pick-cancel" style="padding:6px 16px;border:1px solid var(--gaip-border);background:var(--gaip-surface);border-radius:6px;cursor:pointer;font-size:13px;color:var(--gaip-text-secondary);margin-right:6px;">Cancel</button>';
            html += '<button id="combined-pick-export" style="padding:6px 16px;border:none;background:#059669;color:white;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;">Export</button>';
            html += '</div>';
            html += '</div>';

            box.innerHTML = html;
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            // Wire up buttons
            document.getElementById('combined-pick-all').addEventListener('click', function() {
                overlay.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = true; });
            });
            document.getElementById('combined-pick-none').addEventListener('click', function() {
                overlay.querySelectorAll('input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
            });
            document.getElementById('combined-pick-cancel').addEventListener('click', function() {
                overlay.remove();
                resolve(null);
            });
            document.getElementById('combined-pick-export').addEventListener('click', function() {
                var selected = [];
                overlay.querySelectorAll('input[data-sample-uid]:checked').forEach(function(cb) {
                    var uid = cb.dataset.sampleUid;
                    var parts = uid.split('::');
                    for (var i = 0; i < samples.length; i++) {
                        if (samples[i].siteId === parts[0] && samples[i].sampleId === parts[1]) {
                            selected.push(samples[i]);
                            break;
                        }
                    }
                });
                overlay.remove();
                resolve(selected.length > 0 ? selected : null);
            });

            // Close on overlay click
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) { overlay.remove(); resolve(null); }
            });
        });
    }

    // =========================================================================
    // UI INJECTION
    // =========================================================================

    function createCombinedButton() {
        var btn = document.createElement('button');
        btn.id = 'gaip-export-combined';
        btn.type = 'button';
        btn.innerHTML = '📋 Export All Samples';
        btn.title = 'Export soil samples for this site into one Word document (Shift+click for all sites)';

        // Explicit styling matching the existing Export to Word button
        btn.style.cssText = 'background:#059669;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:500;display:flex;align-items:center;gap:8px;font-size:inherit;font-family:inherit;';

        btn.addEventListener('mouseenter', function() { btn.style.background = '#047857'; });
        btn.addEventListener('mouseleave', function() { btn.style.background = '#059669'; });

        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Shift+click = all sites, normal click = current site only
            var scope = e.shiftKey ? 'all' : 'current';
            var samples = enumerateSamples(scope);

            if (samples.length === 0) {
                alert('No soil samples found to export.');
                return;
            }

            if (samples.length === 1) {
                if (global.GAIP_WordExport) global.GAIP_WordExport.export();
                return;
            }

            // Show sample picker
            var selected = await showSamplePicker(samples, scope);
            if (!selected) return;  // cancelled

            if (selected.length === 1) {
                // Just one selected — use standard export (already loaded)
                if (global.GAIP_WordExport) global.GAIP_WordExport.export();
                return;
            }

            exportCombinedWithSamples(selected);
        });

        return btn;
    }

    function injectExportButton() {
        // Already injected and visible? Done.
        var existing = document.getElementById('gaip-export-combined');
        if (existing && existing.offsetParent !== null) return;

        // Remove any orphaned hidden instance
        if (existing) existing.remove();

        var wordBtn = document.getElementById('gaip-export-word');
        if (!wordBtn) return;

        var btn = createCombinedButton();

        // Insert after the Export to Word button in whatever container it's currently in
        wordBtn.parentNode.insertBefore(btn, wordBtn.nextSibling);
        if (!window._gaipExportBtnInjected) {
            log('Export All button injected into', wordBtn.parentNode.className || wordBtn.parentNode.id);
            window._gaipExportBtnInjected = true;
        }
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        // The tab navigation system moves #gaip-export-word into a reports container
        // after DOMContentLoaded. We need to inject AFTER that move happens.
        // Retry at multiple intervals to catch it.
        var attempts = [500, 1000, 2000, 3000, 5000];
        
        function tryInject() {
            injectExportButton();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                attempts.forEach(function(delay) { setTimeout(tryInject, delay); });
            });
        } else {
            attempts.forEach(function(delay) { setTimeout(tryInject, delay); });
        }
    }

    init();

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_CombinedExport = {
        version: '1.0.0',
        exportAll: function() { return exportCombined('all'); },
        exportCurrentSite: function() { return exportCombined('current'); },
        enumerate: enumerateSamples
    };


})(window);
