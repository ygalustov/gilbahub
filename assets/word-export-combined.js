/**
 * Gilba Word Export - Combined Multi-Site Report
 * Version: 1.3.0 (b35fix313)
 *
 * v1.3.0 (b35fix313): Per-sample engine context baked during loop, not globals.
 *   Structural fix for handoff-doc Item 7. Combined multi-site exports were
 *   reading window.GAIP_STATE / GAIP_OVERSEED_STATE / GilbaClimateEngine at
 *   render time (post-loop), which reflected only the last sample's site.
 *   The ANR engine call also hardcoded hemisphere='south', isOverseed=false,
 *   and a species fallback of 'bentgrass' — silently wrong for any Vietnam
 *   couch, Sydney overseed, UK temperate-north, or non-bentgrass site.
 *   Now reads r.data.engineInputs which is assembled by _buildEngineInputs()
 *   in word-export.js collectData() during each loop iteration with the
 *   correct site active. Hard-fail on missing species (no silent bentgrass).
 *
 * v1.2.0 (b35fix302b): Per-sample ANR via NutritionRequirementEngine_Pure
 *   - Each sample now drives its OWN engine.compute() from its OWN soil chemistry.
 *     Fixes Jerry's reported bug where every green/sportsground showed identical
 *     fert recs (root cause: stale GAIP_NUTRITION_SOIL_CACHE + lossy stand-alone
 *     computeANRFromSoil with hardcoded species table).
 *   - Engine now handles MLSN, AMMONIUM_ACETATE, and SLAN methodologies natively
 *     (per-sample soil.methodology field). NZ Hill Labs AA sites and SLAN sites
 *     get correct treatment without methodology-specific code in this file.
 *   - computeANRFromSoil() DELETED — superseded by engine. See engine
 *     SPECIES_ALIASES (browntopBent/colonialBent/hardFescue/sheepFescue/
 *     slenderRedFescue/strongRedFescue/tetraploidRyegrass/zoysiaJaponica/
 *     zoysiaMatrella/hybridcouch all alias correctly now).
 *   - Cotula S78 stays inline (engine doesn't model dicot sufficiency).
 *
 * v1.1.0:
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
                    warn('Analysis timed out after', timeoutMs, 'ms, collecting what we have');
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

        // b35fix311_1: zone-key derivation moved to assets/zone-key.js — single
        // source of truth shared with nutrient-trend.js. See zone-key.js for
        // stripping logic. This wrapper exists only because the rest of this
        // file uses the short name in many places.
        function deriveZoneKeyLocal(sampleObj) {
            if (typeof global.GaipZoneKey === 'undefined' ||
                typeof global.GaipZoneKey.derive !== 'function') {
                // Defensive fallback — should never happen in production if
                // enqueue order is correct, but keeps the build tolerant.
                console.warn('[CombinedExport] GaipZoneKey not loaded; zone collapse may drift');
                return ((sampleObj && (sampleObj.label || sampleObj.id)) || '').toLowerCase().trim();
            }
            return global.GaipZoneKey.derive(sampleObj);
        }

        // b35fix_greentissue: build zoneKey -> latest sample map for a data type,
        // so a soil zone (green) only ever picks up the water/tissue sample that
        // shares its physical zone, not merely whichever sample was inserted last.
        function buildZoneMap(store, sampleIds) {
            var map = {}; // zoneKey -> { sampleId, sampleObj, date }
            for (var i = 0; i < sampleIds.length; i++) {
                var id = sampleIds[i];
                var obj = store[id];
                var zkey = deriveZoneKeyLocal(obj);
                var date = (obj && obj.date) || '';
                if (!map[zkey] || date > map[zkey].date) {
                    map[zkey] = { sampleId: id, sampleObj: obj, date: date };
                }
            }
            return map;
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
                // Group all soil samples by zone, pick the one with the latest date per zone.
                // Historical (non-winner) samples still drive the Nutrient Trend section; the
                // winner alone drives recommendation sections. See b35fix310a design note.
                var soilZones = {}; // zoneKey -> { sampleId, sampleObj, date }
                var _zoneCandidates = {}; // zoneKey -> [{sampleId, date, label}, ...]
                for (var si = 0; si < soilSamples.length; si++) {
                    var sid = soilSamples[si];
                    var sobj = siteStore.soil[sid];
                    var zkey = deriveZoneKeyLocal(sobj);
                    var sdate = (sobj && sobj.date) || '';
                    if (!_zoneCandidates[zkey]) _zoneCandidates[zkey] = [];
                    _zoneCandidates[zkey].push({
                        sampleId: sid,
                        date: sdate,
                        label: (sobj && sobj.label) || sid
                    });
                    if (!soilZones[zkey] || sdate > soilZones[zkey].date) {
                        soilZones[zkey] = { sampleId: sid, sampleObj: sobj, date: sdate };
                    }
                }

                // b35fix310a: zone collapse is correct behaviour (recommendations must use the
                // latest sample per zone; historical samples drive the Trend section only).
                // Log this at INFO level for traceability, not as a warning.
                Object.keys(_zoneCandidates).forEach(function(zk) {
                    var cands = _zoneCandidates[zk];
                    if (cands.length > 1) {
                        var winner = soilZones[zk];
                        console.info(
                            '[CombinedExport] Zone "' + zk + '" on site "' + siteId +
                            '" has ' + cands.length + ' soil samples, latest drives recommendations, ' +
                            'all samples feed trend analysis.',
                            { winner: { sampleId: winner.sampleId, date: winner.date }, candidates: cands }
                        );
                    }
                });

                // b35fix_greentissue: match tissue to a soil zone by physical zone (green),
                // not by ID equality (soil/tissue IDs never match — that comparison always
                // fell through to "last tissue sample on the site", attaching e.g. Green 13's
                // tissue result to every green's soil section). Soil and tissue sample labels
                // share the same "Green N" naming convention, so zone-key matching between
                // them is reliable. A zone with no tissue sample of its own correctly gets none.
                //
                // Water is intentionally NOT zone-matched here: water sample labels follow a
                // different convention (source type, e.g. "Bore", "Dam" — see gaip-water-source-label)
                // rather than a green name, so comparing water zone keys against soil zone keys
                // is unreliable and was not part of the reported issue. Water keeps the original
                // "single site-wide source" fallback below.
                var tissueZoneMap = hasTissue ? buildZoneMap(siteStore.tissue, tissueSamples) : {};

                var zoneKeys = Object.keys(soilZones);
                for (var zi = 0; zi < zoneKeys.length; zi++) {
                    var zKey = zoneKeys[zi];
                    var zEntry = soilZones[zKey];
                    var zSoilId = zEntry.sampleId;
                    var zWater  = hasWater ? ((siteStore.water && siteStore.water[zSoilId]) ? zSoilId : waterSamples[waterSamples.length - 1]) : null;
                    var zTissue = tissueZoneMap[zKey] ? tissueZoneMap[zKey].sampleId : null;

                    // b35fix310a Fix A1: persist provenance so the render layer can print a
                    // per-section footer disclosing which sample is driving recommendations
                    // and how many prior samples feed the trend section.
                    var _candidatesForZone = _zoneCandidates[zKey] || [];
                    var _priorSamples = _candidatesForZone
                        .filter(function(c) { return c.sampleId !== zSoilId; })
                        .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

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
                        tissueSampleId:zTissue,
                        // b35fix310a Fix A1: zone provenance for the per-section footer
                        zoneProvenance: {
                            zoneKey:       zKey,
                            winnerDate:    zEntry.date || null,
                            winnerLabel:   (zEntry.sampleObj && zEntry.sampleObj.label) || zSoilId,
                            candidateCount: _candidatesForZone.length,
                            priorSamples:   _priorSamples  // [{sampleId, date, label}, ...] most recent first
                        }
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
                // Note: not zone-matching tissue here (water labels use a source-type
                // convention, not "Green N" — see comment in the soil-primary branch above).
                // This water-only path is unrelated to the reported soil-report bug; left
                // as the original site-wide fallback.
                var wZoneKeys = Object.keys(waterZones);
                for (var wzi = 0; wzi < wZoneKeys.length; wzi++) {
                    var wKey = wZoneKeys[wzi];
                    var wEntry = waterZones[wKey];
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
            new Set(result.map(function(r) { return r.siteId; })).size + ' sites, ' +
            result.map(function(r) { return r.siteLabel + '/' + (r.sampleLabel || r.sampleId); }).join(', '));
        return result;
    }

    function createProgressUI(totalSamples) {
        var overlay = document.createElement('div');
        overlay.id = 'combined-export-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

        var box = document.createElement('div');
        box.style.cssText = [
            'background:var(--gaip-bg-raised,#ffffff)',
            'color:var(--gaip-text,#1a2b23)',
            'border:1px solid var(--gaip-border,#d0d7d4)',
            'border-radius:12px',
            'box-shadow:0 20px 60px rgba(0,0,0,0.4)',
            'font-family:var(--gaip-font,\'Barlow\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif)',
            'font-size:14px',
            'line-height:1.4',
            'min-width:400px',
            'max-width:520px',
            'width:100%'
        ].join(';');

        var head = document.createElement('div');
        head.style.cssText = 'padding:16px 24px;border-bottom:1px solid var(--gaip-border,#d0d7d4);';

        var title = document.createElement('h3');
        title.style.cssText = 'margin:0;font-family:var(--gaip-font-display,\'Fraunces\',Georgia,serif);font-size:18px;font-weight:600;color:var(--gaip-text,#1a2b23);';
        title.textContent = 'Combined Report Export';
        head.appendChild(title);

        var body = document.createElement('div');
        body.style.cssText = 'padding:20px 24px 24px;';

        var statusEl = document.createElement('p');
        statusEl.id = 'combined-export-status';
        statusEl.style.cssText = 'margin:0 0 16px;color:var(--gaip-text-secondary,#5a6b65);font-size:14px;';
        statusEl.textContent = 'Preparing...';

        var barTrack = document.createElement('div');
        barTrack.style.cssText = 'background:var(--gaip-border,#d0d7d4);border-radius:4px;height:6px;overflow:hidden;margin-bottom:12px;';

        var barFill = document.createElement('div');
        barFill.id = 'combined-export-bar';
        barFill.style.cssText = 'background:var(--gaip-primary,#059669);height:100%;width:0%;transition:width 0.3s ease;border-radius:4px;';
        barTrack.appendChild(barFill);

        var countEl = document.createElement('p');
        countEl.id = 'combined-export-count';
        countEl.style.cssText = 'margin:0 0 20px;color:var(--gaip-text-muted,#8a9e97);font-size:13px;';
        countEl.textContent = '0 / ' + totalSamples + ' samples';

        var cancelBtn = document.createElement('button');
        cancelBtn.id = 'combined-export-cancel';
        cancelBtn.style.cssText = [
            'padding:7px 18px',
            'border:1px solid var(--gaip-border,#d0d7d4)',
            'background:transparent',
            'border-radius:6px',
            'cursor:pointer',
            'color:var(--gaip-text-secondary,#5a6b65)',
            'font-size:13px',
            'font-family:var(--gaip-font,\'Barlow\',-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif)',
            'line-height:1.4'
        ].join(';');
        cancelBtn.textContent = 'Cancel';

        body.appendChild(statusEl);
        body.appendChild(barTrack);
        body.appendChild(countEl);
        body.appendChild(cancelBtn);

        box.appendChild(head);
        box.appendChild(body);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        var cancelled = false;
        cancelBtn.addEventListener('click', function() {
            cancelled = true;
        });

        return {
            update: function(current, siteLabel, sampleLabel) {
                var pct = Math.round((current / totalSamples) * 100);
                var bar = document.getElementById('combined-export-bar');
                var st = document.getElementById('combined-export-status');
                var cnt = document.getElementById('combined-export-count');
                if (bar) bar.style.width = pct + '%';
                if (st) st.textContent = siteLabel + ' — ' + sampleLabel;
                if (cnt) cnt.textContent = current + ' / ' + totalSamples + ' samples';
            },
            finish: function(msg) {
                var st = document.getElementById('combined-export-status');
                var bar = document.getElementById('combined-export-bar');
                if (bar) bar.style.width = '100%';
                if (st) st.textContent = msg || 'Export complete';
                setTimeout(function() {
                    var el = document.getElementById('combined-export-overlay');
                    if (el) el.remove();
                }, 1500);
            },
            error: function(msg) {
                var st = document.getElementById('combined-export-status');
                if (st) { st.textContent = msg; st.style.color = '#DC2626'; }
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

        // GH-245 follow-up 3: per-site reason the climate pre-pass below
        // couldn't resolve real normals — 'no-coordinates' (site config has
        // no lat/lon) or 'service-unavailable' (GilbaClimateNormalsService /
        // GAIP_SiteConfig not loaded, or the pre-pass itself threw). Read
        // back per sample right after collectData() to replace the generic
        // "climate data unavailable" reason with the precise one, instead of
        // it looking identical to a genuine NASA POWER + Open-Meteo outage.
        var _climateUnavailableReasons = {};

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

        // GH-245 follow-up 2: resolve real climate normals for every distinct
        // site in this export BEFORE the main loop, not just the one site
        // that happens to be active when the export button is clicked.
        // window.climateMetrics only ever holds one site's answer, but this
        // export can span genuinely different sites (a Vietnam couch course
        // + a Bowral bentgrass green + a Sydney fairway, per the b35fix313
        // rationale above) — each needs its own coordinates queried.
        // GilbaClimateNormalsService.resolveFor() caches per-coordinate and
        // is safe to call for every sample even when several share a site
        // (duplicate calls just hit the cache). _buildEngineInputs() then
        // reads the result back synchronously per sample via
        // getResolvedSync(), keyed on that sample's own .gaip-lat/.gaip-lon
        // once setActiveSite() below has switched to it.
        var _siteIds = Array.from(new Set(samples.map(function(s) { return s.siteId; })));
        try {
            var _svc = window.GilbaClimateNormalsService;
            var _sc = window.GAIP_SiteConfig;
            if (_svc && typeof _svc.resolveFor === 'function' && _sc && typeof _sc.getConfig === 'function') {
                var _coordPromises = _siteIds.map(function(siteId) {
                    var cfg = _sc.getConfig(siteId);
                    var loc = cfg && cfg.location;
                    var lat = loc && parseFloat(loc.lat);
                    var lon = loc && parseFloat(loc.lon);
                    if (!isFinite(lat) || !isFinite(lon) || !lat || !lon) {
                        _climateUnavailableReasons[siteId] = 'no-coordinates';
                        return Promise.resolve();
                    }
                    return _svc.resolveFor(lat, lon);
                });
                await Promise.all(_coordPromises);
                log('Climate normals pre-resolved for', _siteIds.length, 'site(s) in this export');
            } else {
                _siteIds.forEach(function(siteId) { _climateUnavailableReasons[siteId] = 'service-unavailable'; });
                warn('GilbaClimateNormalsService or GAIP_SiteConfig not loaded — ' +
                     'per-site climate normals pre-pass skipped, Monthly N Distribution ' +
                     'may show unavailable for sites other than the currently active one.');
            }
        } catch (_climateErr) {
            _siteIds.forEach(function(siteId) { _climateUnavailableReasons[siteId] = 'service-unavailable'; });
            warn('Climate normals pre-pass failed:', _climateErr && _climateErr.message);
        }

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
                progress.update(i + 1, entry.siteLabel, entry.sampleLabel || entry.sampleId);

                // Switch to the sample's site
                sm.setActiveSite(entry.siteId);

                // Load samples according to primaryType — soil-only, water-only, or tissue-only
                if (entry.primaryType === 'soil' || (!entry.primaryType && entry.sampleId)) {
                    sm.loadSample('soil', entry.sampleId);
                }
                if (entry.waterSampleId) {
                    sm.loadSample('water', entry.waterSampleId);
                }
                // b35fix_greentissue: with tissue now matched per zone (green), a zone can
                // legitimately have no tissue sample of its own even though the site does.
                // setActiveSite() is a no-op across consecutive zones on the same site, so
                // without an explicit clear here the form would keep showing the PREVIOUS
                // zone's tissue data instead of correctly showing none.
                if (entry.tissueSampleId) {
                    sm.loadSample('tissue', entry.tissueSampleId);
                } else {
                    var ss = global.GilbaSiteSelector;
                    if (ss && ss.clearTissueForm) {
                        ss.clearTissueForm();
                    }
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

                // GH-245 follow-up 3: _buildEngineInputs()'s own getReason() can
                // only see "not-attempted" here (the coordinate was never
                // resolved) — the pre-pass above already knows more precisely
                // why (no coordinates configured vs. service unavailable), so
                // prefer that when it has an answer for this sample's site.
                if (data.nutritionSummary && data.nutritionSummary.climateDataUnavailable &&
                    _climateUnavailableReasons[entry.siteId]) {
                    data.nutritionSummary.climateDataUnavailableReason = _climateUnavailableReasons[entry.siteId];
                }

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

                // ──────────────────────────────────────────────────────────────
                // b35fix436 / C45 (revised), per-sample spray-log filter.
                //
                // Problem: collectData() at word-export.js:9230 writes the
                // unfiltered slUI.getEntries() cache into data.sprayLog. The
                // per-sample loop here doesn't call SampleManager.setActiveSample
                // per iteration, so collectData reads the same DOM/active-sample
                // values across every iteration. Filtering at collectData scope
                // (b35fix435 attempt) was a no-op in this loop because
                // data.turf.subCategory is constant across the iterations.
                //
                // Correct scope: HERE, where entry.sampleLabel is per-iteration
                // and carries the surface noun ("Green 1", "Fairway 3", "Tee 7").
                // Derive the spray-log zone from the label prefix and filter
                // data.sprayLog.entries against it. Untagged entries (zone
                // empty/null) emit on every surface; tagged entries emit only
                // when zone matches the derived sample zone.
                //
                // Vocabulary mirrors spray-log-cascade.js:1044-1052 getCurrentZone
                // (canonical SSOT). Inline duplicate tracked as OQ17 for SaaS-port
                // consolidation.
                // ──────────────────────────────────────────────────────────────
                try {
                    if (data.sprayLog && data.sprayLog.entries && data.sprayLog.entries.length > 0) {
                        // Map sample label prefix → spray-log zone vocabulary.
                        // Label format observed: "Green 1 Q3 2025", "Fairway 3 Q3 2025",
                        // "Tee 7", "Surround 12", "Pitch 1" (sports).
                        var labelLower = (resolvedLabel || '').toLowerCase();
                        var sampleZone = '';
                        if (/^green\b/.test(labelLower) || /^putting\s*green/.test(labelLower)) {
                            sampleZone = 'greens';
                        } else if (/^tee\b/.test(labelLower)) {
                            sampleZone = 'tees';
                        } else if (/^fairway\b/.test(labelLower)) {
                            sampleZone = 'fairways';
                        } else if (/^surround\b/.test(labelLower)) {
                            sampleZone = 'surrounds';
                        } else if (/^(pitch|oval|field|sports|sportsground|athletic)\b/.test(labelLower)) {
                            sampleZone = 'sportsground';
                        }
                        // Unrecognised label leaves sampleZone empty; tagged
                        // entries get rejected (safer default than emitting).

                        var filtered = data.sprayLog.entries.filter(function(e) {
                            var entryZone = ((e && e.zone) || '').toLowerCase();
                            // Untagged entry: emit on every surface (site-wide policy).
                            if (!entryZone) return true;
                            // Tagged entry: emit only when zone matches.
                            return sampleZone && entryZone === sampleZone;
                        });

                        if (filtered.length > 0) {
                            data.sprayLog.entries = filtered;
                            data.sprayLog.hasData = true;
                        } else {
                            // No matching entries for this surface: clear the section.
                            data.sprayLog.entries = [];
                            data.sprayLog.hasData = false;
                        }
                    }
                } catch (_slfErr) {
                    console.warn('[CombinedExport] spray-log filter error:', _slfErr && _slfErr.message);
                }

                // ──────────────────────────────────────────────────────────────
                // b35fix313 — Per-sample engine context bake
                //
                // Problem (Item 7 from handoff doc): the post-loop ANR engine call
                // at buildCombinedDocument lines ~1420-1431 hardcoded:
                //   - overseedConfig: { isOverseed: false, baseIsC4: false }
                //   - climate: { monthlyTemps: {}, hemisphere: 'south' }
                //   - species fallback: 'bentgrass'
                // For a multi-site export spanning e.g. a Vietnam couch course
                // (tropical, C4, no overseed) + a Bowral bentgrass green
                // (temperate, C3) + a Sydney couch fairway on winter ryegrass
                // overseed (C4 base, C3 overseed), every report got the same
                // wrong nutrition context. Species sometimes-OK by dumb luck,
                // but hemisphere/overseed/climate silently wrong everywhere.
                //
                // Fix: capture the per-sample engine inputs HERE, while the
                // correct site is active. The same readers the single-export
                // path uses (extractTurfConfig, extractMonthlyTemps,
                // detectOverseedScenario, extractAnnualNRate) are exposed on
                // window.GilbaNutritionSummary. Bake their output onto
                // data._combinedCtx so the post-loop ANR call reads it instead
                // of hardcoding globals at render time (when GAIP_STATE
                // reflects only the last sample loaded).
                // ──────────────────────────────────────────────────────────────
                try {
                    var _nsIntegration = global.GilbaNutritionSummary;
                    if (_nsIntegration) {
                        var _turfCfg = typeof _nsIntegration.extractTurfConfig === 'function'
                            ? _nsIntegration.extractTurfConfig() : null;
                        var _monthlyTemps = typeof _nsIntegration.extractMonthlyTemps === 'function'
                            ? _nsIntegration.extractMonthlyTemps() : null;
                        var _overseedCfg = typeof _nsIntegration.detectOverseedScenario === 'function'
                            ? _nsIntegration.detectOverseedScenario() : null;

                        // User N override — read via the same precedence the
                        // single-export path uses (b35fix312 made nutrition-panel
                        // input primary). No direct exporter; inline the read.
                        var _userN = null;
                        var _nEl = document.querySelector('.gaip-nutrition-annual-n');
                        if (!_nEl || !_nEl.value) {
                            _nEl = document.querySelector('.gaip-n-program, #n-program, [name="n-program"], .gaip-annual-n');
                        }
                        if (_nEl && _nEl.value) {
                            var _nParsed = parseFloat(_nEl.value);
                            if (isFinite(_nParsed) && _nParsed >= 0) _userN = _nParsed;
                        }

                        data._combinedCtx = {
                            species:            _turfCfg ? _turfCfg.species : null,
                            clippingsCollected: _turfCfg ? !!_turfCfg.clippingsCollected : false,
                            trafficIntensity:   _turfCfg ? (_turfCfg.trafficIntensity || 'moderate') : 'moderate',
                            hemisphere:         _turfCfg ? (_turfCfg.hemisphere || 'south') : 'south',
                            // GH-245: no || {} — an empty object here used to
                            // read as "no climate data" everywhere except the
                            // one guard that actually caught it, relying on
                            // that being correct rather than being obviously
                            // correct. null propagates explicitly to the
                            // engine instead (Hoxton audit D02/D03).
                            monthlyTemps:       _monthlyTemps,
                            climateNormalsSource: (global.climateMetrics && global.climateMetrics.monthlyTempsSource) || 'unavailable',
                            overseedConfig:     _overseedCfg || { isOverseed: false, baseIsC4: false, summerIntent: 'transition' },
                            userN:              _userN,
                            siteId:             entry.siteId  // self-check marker
                        };
                        log('Baked ctx for', entry.siteLabel, '-',
                            'species=' + data._combinedCtx.species,
                            'hem=' + data._combinedCtx.hemisphere,
                            'overseed=' + !!data._combinedCtx.overseedConfig.isOverseed,
                            'base=' + (data._combinedCtx.overseedConfig.baseSpecies || '(none)'));
                    } else {
                        warn('GilbaNutritionSummary not loaded, _combinedCtx skipped for', entry.sampleId);
                    }
                } catch (_ctxErr) {
                    warn('_combinedCtx bake failed for', entry.sampleId, '-', _ctxErr.message);
                }

                // Capture charts
                var charts = {};
                if (typeof global.GAIP_WordExport_captureCharts === 'function') {
                    charts = await global.GAIP_WordExport_captureCharts(data);
                } else {
                    // Fallback: try the internal captureCharts via re-export
                    // Charts may not be available if not exposed
                    log('Chart capture not exposed, report will be text-only for:', entry.sampleId);
                }

                collectedReports.push({
                    siteId: entry.siteId,
                    siteLabel: entry.siteLabel,
                    sampleId: entry.sampleId,
                    sampleLabel: resolvedLabel,
                    data: data,
                    charts: charts,
                    // b35fix310a Fix A1: forward zone provenance to render layer
                    zoneProvenance: entry.zoneProvenance || null
                });

                log('Collected report', (i + 1), '/', samples.length, ':', entry.siteLabel, '-', entry.sampleId);
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
            // b35fix429 (C30): Disease Risk Assessment, Moisture Management, and
            // Pre-Emergent Herbicide Timing section emits removed from word-export.js;
            // their classifier entries (and dead H2 subsections — Disease Details,
            // Risk Drivers, 7-Day Forecast, Water Balance, Water Balance Parameters,
            // Water Balance Chart) removed in lockstep.
            if (str.indexOf('Active DMI Fungicide') >= 0) return 'Active DMI Fungicide';
            if (str.indexOf('Treatment Options') >= 0) return 'Treatment Options';
            if (str.indexOf('Soil Moisture Zones') >= 0) return 'Soil Moisture Zones';
            if (str.indexOf('Zone-Specific Recommendations') >= 0) return 'Zone-Specific Recommendations';
            if (str.indexOf('14-Day Stress Trajectory') >= 0) return '14-Day Stress Trajectory';
            // b35fix433 (C42): Dew Forecast classifier entry removed in lockstep with section emit prune.
            if (str.indexOf('Traffic & Wear Analysis') >= 0) return 'Traffic & Wear Analysis';
            if (str.indexOf('Phytotoxicity Risk') >= 0) return 'Phytotoxicity Risk';
            // b35fix449 / C11x: Soil × Water Interactions classifier branch.
            // Pre-fix this heading fell through to the '__heading__' sentinel,
            // which made the deny-list test at line ~2470 a no-op for this
            // section (sentinel is not in siteLevelHeadings). Section then
            // re-emitted in full on every per-sample iteration. Surfaced
            // during C11a emit-site walk 2026-05-08; same defect class as
            // Phytotoxicity Risk (water-chemistry-driven, site-wide), which
            // already has the classifier + deny-list pairing.
            if (str.indexOf('Soil × Water') >= 0) return 'Soil × Water Interactions';
            if (str.indexOf('Environmental Stress Factors') >= 0) return 'Environmental Stress Factors Affecting Recovery';
            if (str.indexOf('Evapotranspiration') >= 0) return 'Evapotranspiration & Species Selection';
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
            if (str.indexOf('Fairway/Tee') >= 0 && str.indexOf('Disease Assessment') >= 0) return 'Fairway/Tee, Disease Assessment';
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
     * Check if a Paragraph is a page break.
     *
     * b35fix402b: rewritten to use structural signature instead of the
     * old length+substring heuristic. The old detector had two bugs that
     * made it return false for every real PageBreak paragraph since
     * the docx library upgrade increased per-paragraph JSON size:
     *   1. `if (str.length > 500) return false` rejected real PageBreak
     *      paragraphs (which serialise to ~700 bytes in current docx lib).
     *   2. `str.indexOf('break')` and `str.indexOf('Break')` both returned
     *      -1 because the docx library renders the break element as
     *      `"rootKey":"w:br"` — neither substring appears.
     *
     * Production evidence (gilbasolutions.com Combined Export, header
     * stamp Hub v11.21.1): document.xml had 25 page-break paragraphs
     * with 7 adjacent pairs creating blank pages. The b35fix402 dedup
     * pass and the existing trims at lines 2290/2309 both no-op'd
     * because isPageBreak returned false for every input.
     *
     * New detector keys on the unambiguous structural signature:
     *   - `"rootKey":"w:br"` element present
     *   - `"type":"page"` attribute present (vs line break or column break)
     *   - paragraph total under 2000 bytes (a content paragraph wrapping
     *     a page break would be far larger; bare PageBreak para is ~700)
     *
     * Structural rather than heuristic so it doesn't break again when
     * the docx library bumps version and changes serialisation size.
     */
    function isPageBreak(para) {
        if (!para) return false;
        try {
            var str = JSON.stringify(para);
            // Defensive cap — a content paragraph wrapping a page break would
            // be much larger. Bare PageBreak paragraph is ~700 bytes; leave
            // generous headroom for future docx library size changes.
            if (str.length > 2000) return false;
            return str.indexOf('"rootKey":"w:br"') >= 0
                && str.indexOf('"type":"page"') >= 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * Collapse runs of consecutive page-break paragraphs to a single break.
     *
     * b35fix402 (C18). Defensive last-pass dedup before Document construction.
     *
     * The renderer pushes page-break paragraphs at multiple emission sites
     * (line ~1277, ~1341, ~2168 per-zone, ~2409 site-wide ANR, ~3186, ~3218
     * site-wide Purchasing). Sections returned by we.buildSections() may
     * also begin or end with their own breaks. The existing trim at lines
     * ~2254 and ~2273 catches end-of-zone breaks at the cut-point boundary
     * but does not catch start-of-spliced-section breaks or post-zone-loop
     * site-wide-section breaks landing immediately after a zone's own.
     *
     * Doubled-break adjacency produces visible blank pages in the rendered
     * docx. Production evidence: page 26 of GAIP_Rockingham_Report_2026-05-01
     * (pre-streamlined v3) was a blank page from this bug class. v3 fixed
     * it surgically; this dedup pass removes the bug class.
     *
     * Walks the array once, mutates in place, returns the same array for
     * caller convenience.
     */
    function dedupConsecutivePageBreaks(allChildren) {
        if (!allChildren || allChildren.length < 2) return allChildren;
        var collapsed = 0;
        for (var i = allChildren.length - 1; i > 0; i--) {
            if (isPageBreak(allChildren[i]) && isPageBreak(allChildren[i - 1])) {
                allChildren.splice(i, 1);
                collapsed++;
            }
        }
        if (collapsed > 0) {
            log('[CombinedExport b35fix402] Collapsed', collapsed, 'redundant page break(s)');
        }
        return allChildren;
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
        // b35fix371: GP (%) column dropped. Pre-fix it rendered the same value
        // for every row because cm.growth.{c3,c4,weighted} is a single global
        // computed once for the active site's climate; with mostly-C4 cohorts
        // (couch + kikuyu) every row read the same C4 value. Wasted column
        // space and looked broken to council users. Replaced with Area (ha)
        // which IS per-sample (read from r.data.soil.areaHa) and is what
        // councils use for budget and product purchasing decisions.
        var nutrients = [
            { label: 'Area (ha)',     key: 'areaHa', unit: 'ha',  isArea: true },
            { label: 'pH',            key: 'pH',   unit: '' },
            { label: 'EC (dS/m)',     key: 'EC',   unit: 'dS/m' },
            { label: 'OM (%)',        key: 'OM',   unit: '%' },
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
                    children: [new TextRun({ text: String(text), bold: true, size: 20, color: 'FFFFFF' })]
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
                    children: [new TextRun({ text: String(text), size: 20, color: '1F2937' })]
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
                    children: [new TextRun({ text: String(text), bold: true, size: 20, color: '374151' })]
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

                if (nut.isArea) {
                    // b35fix371: per-sample area read from data.soil.areaHa.
                    // Format matches the b35fix368 _buildSectionHeaderLine
                    // helper: 1.0 → "1", 0.85 → "0.85", 12.345 → "12.34".
                    var areaRaw = d.soil && d.soil.areaHa;
                    if (areaRaw != null && isFinite(areaRaw) && areaRaw > 0) {
                        var areaN = Number(areaRaw);
                        if (areaN >= 10) {
                            displayText = areaN.toFixed(2);
                        } else {
                            displayText = areaN.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
                        }
                        if (!displayText) displayText = String(areaN);
                        fill = 'F9FAFB';   // neutral — area is not a status
                        val = areaN;
                    } else {
                        val = null;
                    }
                } else {
                    val = d.soil ? d.soil[nut.key] : null;
                    if (val !== null && val !== undefined) {
                        var thresh = d.soil && d.soil.thresholds && d.soil.thresholds[nut.key];
                        if (nut.key === 'pH' || nut.key === 'CEC' || nut.key === 'Na' || nut.key === 'EC' || nut.key === 'OM') {
                            fill = 'F9FAFB';
                        } else if (thresh && thresh.min !== undefined) {
                            fill = (parseFloat(val) < thresh.min) ? 'FEE2E2' : 'D1FAE5';
                        } else {
                            fill = 'F9FAFB';
                        }
                        displayText = typeof val === 'number'
                            ? (nut.key === 'EC' ? val.toFixed(2) : (nut.key === 'OM' ? val.toFixed(1) : val.toFixed(val >= 10 ? 0 : 1)))
                            : String(val);
                    }
                }

                if (val === null || val === undefined) {
                    rowCells.push(makeDataCell('-', 'F9FAFB', nutColW));
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

    /**
     * Build Zone Issues Summary table — aggregates per-green diagnostic flags.
     * Columns: Zone | Key Issues | Priority Action
     * Sources: MLSN deficiencies, Mulder's interactions, pH, EC, CEC.
     * Inserted after the Zone Comparison table in the combined report.
     *
     * b35fix300
     */
    function buildZoneIssuesSummaryTable(reports, docxRefs) {
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

        var border = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' };
        var borders = { top: border, bottom: border, left: border, right: border };
        var cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

        // Column widths (DXA) — Zone narrow, Issues wide, Action wide
        var totalWidth = 9360;
        var zoneW = 1400;
        var issuesW = 4280;
        var actionW = totalWidth - zoneW - issuesW; // 3680

        function makeHeaderCell(text, w) {
            return new TableCell({
                borders: borders,
                margins: cellMargins,
                width: { size: w, type: WidthType.DXA },
                shading: { fill: '059669', type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(text), bold: true, size: 20, color: 'FFFFFF' })]
                })]
            });
        }

        function makeCell(text, w, opts) {
            opts = opts || {};
            var shading = opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined;
            return new TableCell({
                borders: borders,
                margins: cellMargins,
                width: { size: w, type: WidthType.DXA },
                shading: shading,
                verticalAlign: VerticalAlign.TOP,
                children: [new Paragraph({
                    children: [new TextRun({
                        text: String(text),
                        bold: !!opts.bold,
                        size: opts.size || 16,
                        color: opts.color || '1F2937'
                    })]
                })]
            });
        }

        // ── Aggregate issues per report ──────────────────────────────────────
        var zoneRows = [];
        var hasAnyIssues = false;

        for (var ri = 0; ri < reports.length; ri++) {
            var rep = reports[ri];
            var d = rep.data;
            var soil = d.soil || {};
            var zoneLabel = rep.sampleLabel || rep.sampleId || ('Zone ' + (ri + 1));
            var issues = [];
            var actions = [];

            // 1. MLSN / SLAN deficiencies
            if (soil.hasData && soil.thresholds) {
                var defNutrients = [];
                var majorKeys = ['P', 'K', 'Ca', 'Mg', 'S'];
                for (var mi = 0; mi < majorKeys.length; mi++) {
                    var nk = majorKeys[mi];
                    var nv = soil[nk];
                    var nt = soil.thresholds[nk];
                    if (nv != null && nt && nt.min != null && parseFloat(nv) < nt.min) {
                        defNutrients.push(nk);
                    }
                }
                if (defNutrients.length > 0) {
                    issues.push(defNutrients.join(', ') + ' below ' +
                        (soil.methodology === 'SLAN' ? 'SLAN' : 'MLSN') + ' minimum');
                    actions.push('Correct ' + defNutrients.join(', ') + ' deficits, see per-zone recommendations');
                }
            }

            // 2. Mulder's interactions (Ca:Mg, Fe:Mn, K:Mg, etc.)
            if (global.GilbaMulders && soil.hasData) {
                try {
                    var mNutrients = [];
                    var mKeys = ['K', 'Ca', 'Mg', 'P', 'Fe', 'Mn', 'Zn', 'Cu', 'B', 'S'];
                    for (var mk = 0; mk < mKeys.length; mk++) {
                        var mv = soil[mKeys[mk]];
                        if (mv != null && parseFloat(mv) > 0) {
                            mNutrients.push({ nutrient: mKeys[mk], actual: parseFloat(mv) });
                        }
                    }
                    var mCtx = {
                        methodology: soil.methodology || 'mlsn',
                        soilPH: soil.pH || null,
                        extractant: soil.extractant || soil.methodology || null
                    };
                    var mResult = global.GilbaMulders.analyse(mNutrients, mCtx);
                    var mFlags = mResult.flags || {};
                    var mEntries = [];
                    Object.keys(mFlags).forEach(function(sym) {
                        mFlags[sym].forEach(function(f) { mEntries.push(f); });
                    });
                    if (mEntries.length > 0) {
                        // Summarise: list unique ratio labels
                        var ratioLabels = [];
                        for (var mj = 0; mj < mEntries.length; mj++) {
                            var rl = mEntries[mj].suppressor + ':' + mEntries[mj].suppressed;
                            if (ratioLabels.indexOf(rl) === -1) ratioLabels.push(rl);
                        }
                        issues.push('Nutrient antagonism: ' + ratioLabels.join(', '));
                        // High severity gets explicit action
                        var highSev = mEntries.filter(function(f) {
                            return f.severity === 'high';
                        });
                        if (highSev.length > 0) {
                            actions.push('Address ' + highSev[0].suppressor + ':' +
                                highSev[0].suppressed + ' imbalance (high severity)');
                        }
                    }
                } catch (e) {
                    // Non-critical — skip Mulder's for this zone
                }
            }

            // 3. pH flags
            var pH = soil.pH != null ? parseFloat(soil.pH) : null;
            if (pH !== null) {
                if (pH < 5.5) {
                    issues.push('pH ' + pH.toFixed(1) + ', strongly acidic');
                    actions.push('Lime to raise pH into 5.8\u20136.5 range');
                } else if (pH > 8.0) {
                    issues.push('pH ' + pH.toFixed(1) + ', alkaline, trace element lockup risk');
                    actions.push('Acidify or use chelated trace element foliar applications');
                } else if (pH > 7.5) {
                    issues.push('pH ' + pH.toFixed(1) + ', elevated, monitor trace element availability');
                }
            }

            // 4. Low EC (rootzone salinity or very low fertility indicator)
            var ec = soil.EC != null ? parseFloat(soil.EC) : null;
            if (ec !== null && ec < 0.3) {
                issues.push('EC ' + ec.toFixed(2) + ' dS/m, very low');
            }

            // 5. Low CEC (sand-based rootzone, limited nutrient holding capacity)
            var cec = soil.CEC != null ? parseFloat(soil.CEC) : null;
            if (cec !== null && cec < 5) {
                issues.push('CEC ' + cec.toFixed(1) + ', low holding capacity (spoon-feeding required)');
                actions.push('Spoon-feed nutrients; increase organic matter over time');
            }

            // Only add zones with issues
            if (issues.length > 0) {
                hasAnyIssues = true;
                zoneRows.push({
                    zone: zoneLabel,
                    issues: issues.join('. ') + '.',
                    action: actions.length > 0 ? actions[0] : 'Review per-zone report'
                });
            } else {
                zoneRows.push({
                    zone: zoneLabel,
                    issues: 'No significant issues detected.',
                    action: 'Maintain current programme'
                });
            }
        }

        // Don't render the table if every zone is clear — no value added
        if (!hasAnyIssues) return null;

        // ── Build docx table ─────────────────────────────────────────────────
        var rows = [];

        // Header row
        rows.push(new TableRow({
            tableHeader: true,
            children: [
                makeHeaderCell('Zone', zoneW),
                makeHeaderCell('Key Issues', issuesW),
                makeHeaderCell('Priority Action', actionW)
            ]
        }));

        // Data rows
        for (var zi = 0; zi < zoneRows.length; zi++) {
            var zr = zoneRows[zi];
            var hasIssue = zr.issues !== 'No significant issues detected.';
            rows.push(new TableRow({
                children: [
                    makeCell(zr.zone, zoneW, { bold: true, fill: 'F3F4F6', color: '374151' }),
                    makeCell(zr.issues, issuesW, { fill: hasIssue ? 'FEF3C7' : 'F0FDF4' }),
                    makeCell(zr.action, actionW, { fill: hasIssue ? 'FEF3C7' : 'F0FDF4' })
                ]
            }));
        }

        return new Table({
            width: { size: totalWidth, type: WidthType.DXA },
            columnWidths: [zoneW, issuesW, actionW],
            rows: rows
        });
    }

    // computeANRFromSoil — DELETED in b35fix302b.
    // All methodology routing (MLSN | AMMONIUM_ACETATE | SLAN) now lives in
    // NutritionRequirementEngine_Pure.compute() with full unit-test coverage
    // (see tests/nutrition-requirement-engine.test.js: 'Methodology routing'
    // and 'compute() routes methodology end-to-end' sections).
    // Cotula S78 placeholder is constructed inline at the call site below
    // (engine doesn't model dicot sufficiency).

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
        var PageOrientation = global.docx.PageOrientation;
        var Tab = global.docx.Tab;

        var we = global.GAIP_WordExport;

        // Build sections array: one set of content per report, with page breaks between
        var allChildren = [];

        // ── COVER PAGE ──────────────────────────────────────────────────────────
        var combinedLogo = typeof global.GAIP_getReportLogo === 'function' ? global.GAIP_getReportLogo() : null;
        var hasLogo = combinedLogo && combinedLogo.base64;
        var coverNoBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        var coverNoBorders = { top: coverNoBorder, bottom: coverNoBorder, left: coverNoBorder, right: coverNoBorder };

        // Compute site groups
        var siteGroups = {};
        reports.forEach(function(r) {
            if (!siteGroups[r.siteLabel]) siteGroups[r.siteLabel] = [];
            siteGroups[r.siteLabel].push(r.sampleLabel || r.sampleId);
        });
        var siteKeys = Object.keys(siteGroups);
        var siteCount = siteKeys.length;

        // ── GREEN HEADER BAND ────────────────────────────────────────────────
        allChildren.push(new Table({
            width: { size: 9746, type: WidthType.DXA },
            columnWidths: [9746],
            rows: [new TableRow({
                children: [new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '059669' },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 720, bottom: 720, left: 720, right: 720 },
                    borders: coverNoBorders,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            spacing: { before: 0, after: 120 },
                            children: [new TextRun({ text: 'Gilba Agronomic Intelligence Hub', bold: true, size: 52, color: 'FFFFFF' })]
                        }),
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            spacing: { before: 0, after: 0 },
                            children: [new TextRun({ text: 'Combined Analysis Report', size: 52, color: 'D1FAE5' })]
                        })
                    ]
                })]
            })]
        }));

        // ── BODY SECTION: single borderless table for reliable centering ────────
        // Using table cells because cell alignment & margins are honored by Pages
        // and Word alike, unlike standalone paragraph alignment which Pages ignores.
        var primarySiteName = siteCount === 1 ? siteKeys[0] : 'Multi-Site Report';

        // ── BODY: standalone paragraphs — alignment:CENTER works reliably here
        //    (spacing.before works since these follow the green band Table, not first in doc)

        // Spacer after green band
        allChildren.push(new Paragraph({
            spacing: { before: 900, after: 0 },
            children: [new TextRun({ text: '' })]
        }));

        // Logo
        if (hasLogo) {
            try {
                var clBase64 = combinedLogo.base64.split(',')[1] || combinedLogo.base64;
                var clMaxW = 120, clMaxH = 120;
                var clScale = Math.min(clMaxW / combinedLogo.width, clMaxH / combinedLogo.height, 1);
                var clW = Math.round(combinedLogo.width * clScale);
                var clH = Math.round(combinedLogo.height * clScale);
                allChildren.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 160 },
                    children: [new ImageRun({
                        type: combinedLogo.type.includes('png') ? 'png' : 'jpg',
                        data: Uint8Array.from(atob(clBase64), function(c) { return c.charCodeAt(0); }),
                        transformation: { width: clW, height: clH },
                        altText: { title: 'Organisation Logo', name: 'logo_combined_cover' }
                    })]
                }));
            } catch (e) {
                console.warn('[CombinedExport] Error adding logo to cover:', e);
            }
        }

        // Site name
        allChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: siteCount > 1 ? 100 : 0 },
            children: [new TextRun({ text: primarySiteName, bold: true, size: 56, color: '111827' })]
        }));

        // Multi-site sub-names
        if (siteCount > 1) {
            allChildren.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [new TextRun({ text: siteKeys.join('  ·  '), size: 30, color: '6B7280' })]
            }));
        }

        // Spacer before samples
        allChildren.push(new Paragraph({
            spacing: { before: 700, after: 0 },
            children: [new TextRun({ text: '' })]
        }));

        // Samples count
        allChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80 },
            children: [new TextRun({
                text: reports.length + ' sample' + (reports.length !== 1 ? 's' : '') +
                      (siteCount > 1 ? ' across ' + siteCount + ' sites' : ''),
                size: 22, color: '6B7280'
            })]
        }));

        // Samples list
        for (var sk = 0; sk < siteKeys.length; sk++) {
            var siteSamples = siteGroups[siteKeys[sk]];
            var sampleRunChildren = [];
            if (siteCount > 1) {
                sampleRunChildren.push(new TextRun({ text: siteKeys[sk] + '  ', bold: true, size: 30, color: '1F2937' }));
            }
            sampleRunChildren.push(new TextRun({ text: siteSamples.join('  ·  '), size: 30, color: '374151' }));
            allChildren.push(new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 60 },
                children: sampleRunChildren
            }));
        }

        // Date
        var _months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        var _d = new Date();
        var _dateStr = _d.getDate() + ' ' + _months[_d.getMonth()] + ' ' + _d.getFullYear();
        allChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 0 },
            children: [new TextRun({ text: _dateStr, size: 20, color: 'A0AEC0', italics: true })]
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
                children: [new TextRun({ text: 'Cross-Module Pattern Analysis', bold: true, size: 36, color: '1F2937' })]
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
                        children: [new TextRun({ text: hText, bold: true, size: 22, color: '1F2937' })]
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
                            if (part) bChildren.push(new TextRun({ text: part, bold: isBold, size: 20, color: isBold ? '374151' : '374151' }));
                            isBold = !isBold;
                        });
                        allChildren.push(new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 300 }, bullet: { level: 0 }, children: bChildren }));
                    });
                    return;
                }
                var pChildren = [];
                var isPBold = false;
                para.split(/<<BOLD>>|<<\/BOLD>>/).forEach(function(part) {
                    if (part) pChildren.push(new TextRun({ text: part, bold: isPBold, size: 20, color: isPBold ? '374151' : '374151' }));
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
                children: [new TextRun({ text: 'Zone Comparison', bold: true, size: 36, color: '1F2937' })]
            }));
            allChildren.push(new Paragraph({
                spacing: { after: 240 },
                children: [new TextRun({
                    text: 'Soil nutrient status and growth potential across all analysed zones. ' +
                          'Green = adequate (above MLSN minimum). Red = deficit (below MLSN minimum). ' +
                          'Amber = low growth potential.',
                    size: 22, color: '6B7280'
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

            // b35fix300: Zone Issues Summary — aggregated diagnostic flags per green
            try {
                var issuesTable = buildZoneIssuesSummaryTable(reports, {
                    Paragraph: Paragraph, TextRun: TextRun,
                    Table: Table, TableRow: TableRow, TableCell: TableCell,
                    AlignmentType: AlignmentType, WidthType: WidthType,
                    BorderStyle: BorderStyle, ShadingType: ShadingType, VerticalAlign: VerticalAlign
                });
                if (issuesTable) {
                    allChildren.push(new Paragraph({
                        spacing: { before: 360, after: 120 },
                        children: [new TextRun({ text: 'Zone Issues Summary', bold: true, size: 28, color: '1F2937' })]
                    }));
                    allChildren.push(new Paragraph({
                        spacing: { after: 200 },
                        children: [new TextRun({
                            text: 'Aggregated diagnostic flags per zone. Deficiency thresholds, nutrient antagonisms, ' +
                                  'pH, EC, and CEC assessed against current soil data.',
                            size: 22, color: '6B7280'
                        })]
                    }));
                    allChildren.push(issuesTable);
                }
            } catch (e) {
                warn('Zone issues summary table failed:', e);
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
                                        children: [new TextRun({ text: cr.sampleLabel || cr.sampleId, bold: true, size: 22, color: '374151' })]
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
                            width: { size: cellW * 2, type: WidthType.DXA },
                            columnWidths: [cellW, cellW],
                            rows: [new TableRow({ children: cellsInRow })]
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

        // ──────────────────────────────────────────────────────────────────
        // b35fix307 Q1: Hoist per-sample ANR computation + Step 5 programme
        // overlay BEFORE the per-report render loop.
        //
        // Previously these ran later (around line ~1525+), AFTER we.buildSections
        // had already rendered each report's Nutrition Program section using the
        // facility-cached programme. Result: every per-green table showed the
        // same facility programme while the bottom-of-doc K reconciliation and
        // Purchasing Summary used per-sample output — two contradictory
        // programmes in one docx.
        //
        // Running the overlay here means each report's r.data.nutritionProgram
        // is per-sample by the time we.buildSections is called. Every downstream
        // render sees consistent data.
        // ──────────────────────────────────────────────────────────────────
        var anrReports = reports.filter(function(r) {
            return r.data && r.data.soil && r.data.soil.hasData && (r.data.soil.P != null || r.data.soil.K != null);
        });

        var _enginePure = (typeof window !== 'undefined' && window.NutritionRequirementEngine_Pure) ||
                          (typeof global !== 'undefined' && global.NutritionRequirementEngine_Pure);
        var _engineReadyCombined = _enginePure && typeof _enginePure.compute === 'function';
        var _engineCount = 0, _cotulaCount = 0, _failedCount = 0;

        anrReports.forEach(function(r) {
            if (!r.data.soil) { r._anr = null; return; }

            // Cotula S78 — engine doesn't model dicot sufficiency; keep placeholder
            // for the S78 sufficiency-table renderer downstream.
            // GH-379: r.data.soil.methodology is upper-cased by word-export.js
            // (this file's own ANR subtitle reads it as 'COTULA_S78' below), so
            // the lowercase compare here never matched and only the surfaceType
            // half of this test ever fired. Compare case-insensitively.
            if (String(r.data.soil.methodology || '').toLowerCase() === 'cotula_s78' || r.data.soil.surfaceType === 'cotula_bowling_green') {
                r._anr = { isCotula: true, s78: r.data.soil };
                _cotulaCount++;
                return;
            }

            if (!_engineReadyCombined) {
                console.warn('[CombinedExport] engine not loaded, skipping ANR for', r.siteLabel || '?', r.sampleId || '?');
                r._anr = null;
                _failedCount++;
                return;
            }

            // b35fix313: read per-sample engine inputs from r.data.engineInputs
            // (baked during the collection loop by _buildEngineInputs in
            // word-export.js collectData, while the correct site was active).
            // Previously this block hardcoded hemisphere='south', overseed=false,
            // and species-fallback='bentgrass' — silently wrong for any site
            // that wasn't temperate-southern-non-overseed-bentgrass. Handoff
            // Item 7.
            var _ei = r.data.engineInputs;
            if (!_ei || !_ei.turf || !_ei.turf.species) {
                console.warn('[CombinedExport] engineInputs missing or species unset for',
                             r.siteLabel || '?', r.sampleId || '?',
                             ', skipping ANR (no silent species fallback). Check collectData ran during loop.');
                r._anr = null;
                _failedCount++;
                return;
            }

            try {
                var _engineResult = _enginePure.compute({
                    soil: r.data.soil,
                    turf: _ei.turf,
                    climate: _ei.climate,
                    // GH-299 (D07 item 6): resolved once per sample by
                    // word-export.js's _buildEngineInputs() (same object this
                    // whole block already reads turf/climate from) — inherits
                    // the AA-ceiling fix rather than needing a separate
                    // resolution here, same pattern GH-290/291 established.
                    // GH-383: sufficiency ranges for all three methodologies,
                    // resolved once per sample by nutrition-program-inputs.js
                    // via word-export.js's _buildEngineInputs(). aaRanges is
                    // still passed for the graceful-degradation path.
                    ranges: _ei.ranges,
                    aaRanges: _ei.aaRanges,
                    // GH-369: this ANR compute() call — the one that resolves
                    // r._anr.K.val, i.e. the exact number the K Reconciliation
                    // table's "K req" column and Balance arithmetic are built
                    // from — never received tissuePercent at all. GH-368
                    // threaded tissue into the single-export ANR call
                    // (word-export.js) and into this same file's separate
                    // per-sample nutrition-PROGRAMME computation (the
                    // perSampleInputs.tissuePercent overlay a few hundred
                    // lines below, feeding the Monthly Schedule) but missed
                    // this one — so the Combined export's K Reconciliation
                    // row could never actually be tissue-ratio-informed,
                    // which would have made the GH-369 row-level tissue-status
                    // note below permanently a no-op on this export path.
                    // Same source, same helper as the other two call sites.
                    tissuePercent: (window.GAIP_WordExport &&
                                   window.GAIP_WordExport._tissuePercentFromData)
                        ? window.GAIP_WordExport._tissuePercentFromData(r.data)
                        : null,
                    overseedConfig: _ei.overseedConfig
                });
                // b35fix325: carry structured methodology fields through from
                // the engine. _anr.K.val retained for backward compat with
                // pre-b35fix325 readers; new fields (intent, methodology, floor,
                // ceiling, citation, correctionRequired, removal) enable
                // intent-aware reconciliation rendering and gate logic.
                function _shapeAnr(perSampleNut) {
                    if (!perSampleNut) return null;
                    return {
                        // Legacy fields (backward compat)
                        val: perSampleNut.annualRequirement,
                        status: perSampleNut.status,
                        // Structured fields (b35fix325)
                        annual: perSampleNut.annualRequirement,
                        intent: perSampleNut.intent || null,
                        methodology: perSampleNut.methodology || null,
                        citation: perSampleNut.citation || null,
                        floor: perSampleNut.floor != null ? perSampleNut.floor : null,
                        ceiling: perSampleNut.ceiling != null ? perSampleNut.ceiling : null,
                        removal: perSampleNut.removal != null ? perSampleNut.removal : null,
                        correctionRequired: perSampleNut.correctionRequired != null
                                          ? perSampleNut.correctionRequired : 0,
                        currentLevel: perSampleNut.currentLevel != null
                                    ? perSampleNut.currentLevel : null,
                        // GH-369: whether `annual`/`val` above was derived from
                        // this sample's measured tissue ratio rather than the
                        // generic textbook constant — see
                        // NutritionRequirementEngine_Pure.getRemovalRate()'s
                        // own comment. Consumed by the K Reconciliation
                        // renderer to decide whether to attach the tissue
                        // plant-status note to this row.
                        tissueInformed: !!perSampleNut.tissueInformed
                    };
                }
                r._anr = {
                    P: _shapeAnr(_engineResult.perSample.P),
                    K: _shapeAnr(_engineResult.perSample.K),
                    S: _shapeAnr(_engineResult.perSample.S)
                };
                _engineCount++;
            } catch (_err) {
                console.warn('[CombinedExport] engine failed for', r.siteLabel || '?', r.sampleId || '?', '-', _err.message);
                r._anr = null;
                _failedCount++;
            }
        });

        if (_engineCount > 0 || _cotulaCount > 0 || _failedCount > 0) {
            console.log('[CombinedExport] per-sample ANR: engine=' + _engineCount +
                        ' cotula=' + _cotulaCount +
                        ' failed=' + _failedCount +
                        ' (total=' + anrReports.length + ')');
        }

        // Per-sample programme overlay (moved from later in the pipeline).
        // Without this moved up, per-green Nutrition Program sections would
        // still render from the facility-cached programme.
        var _facilityCalendarInputs = null;
        if (window.GilbaNutritionCalendar && window.GilbaNutritionCalendar.collectFromState) {
            try {
                // GH-388: the aaTextureKey overlay is gone with
                // NutritionCalendar._collectAATexture(). Since GH-384 the AA
                // sufficiency range comes from the shared resolver, which
                // buckets the texture itself off the one texture chain; this
                // key was computed on every export and read by nobody.
                _facilityCalendarInputs = window.GilbaNutritionCalendar.collectFromState();
            } catch (e) {
                console.warn('[CombinedExport] Could not collect facility calendar inputs:', e.message);
            }
        }

        // The facility snapshot supplies only the sample-independent shape of
        // the calendar's input object (monthly temps get overlaid per sample,
        // distribution/max-N per site). GH-383: every programme-level field on
        // it — annual N, clipping, traffic, species, methodology, texture — is
        // OVERWRITTEN per sample from nutrition-program-inputs.js keyed by that
        // sample's own r.siteId, because this snapshot is built from the hidden
        // #rp-hub-runner's DOM, which carries whichever site restored first.
        // Samples whose site has no resolvable annual N are skipped
        // individually (_perSampleProgSkip).
        var _perSampleProgGen = !!(
            _facilityCalendarInputs &&
            window.GilbaNutritionCalendar &&
            window.GilbaNutritionCalendar.computeProgram &&
            ((window.AuFertiliserRecommender && window.AuFertiliserRecommender.generateAnnualProgram) ||
             (window.PrebbleRecommender && window.PrebbleRecommender.generateProgram))
        );

        var _perSampleProgOk = 0, _perSampleProgFail = 0, _perSampleProgSkip = 0;

        if (_perSampleProgGen && anrReports.length > 0) {
            // GH-362 (Hoxton audit D30 root cause; supersedes GH-360's guard).
            //
            // b35fix305 resolved the recommender branch ONCE here, for the whole
            // document, from NutritionPrebbleIntegration.isNewZealand() -->
            // regional-profiles.js detectRegionFromHub(), which reads the single
            // global .gaip-lat/.gaip-lon DOM inputs. Two consequences, both of
            // them the audit's D30 symptom (an NZ/Prebbles site's export carrying
            // AU-catalogue products):
            //
            //   1. The collection loop above switches the active site per entry,
            //      so by the time this ran those inputs held whichever site was
            //      collected LAST. In a multi-site combined export every sample
            //      got that one site's catalogue.
            //   2. When those inputs are empty or non-numeric (a site with no
            //      coordinates), detectRegionFromHub() returns its 'uk_ireland'
            //      default, isNewZealand() accepts that and returns false, and an
            //      NZ site falls through to the AU branch.
            //
            // Same class of bug as GH-245 follow-up 3 below, which fixed the
            // climate binding per-sample and left this one global. The branch is
            // now resolved per sample, from that sample's own coordinates
            // (r.data.engineInputs.climate, already resolved per-sample in the
            // collection loop).
            var _prebbleAvailable = !!(window.PrebbleRecommender && window.PrebbleRecommender.generateProgram);
            var _auAvailable = !!(window.AuFertiliserRecommender && window.AuFertiliserRecommender.generateAnnualProgram);

            // Same NZ bounding box NutritionPrebbleIntegration.isNewZealand()
            // uses for its own coordinate check. Returns null (not false) when
            // the coordinates are unusable, so the caller can tell "this sample
            // is not in NZ" apart from "we do not know where this sample is" --
            // conflating those two is root cause 2 above.
            var _nzFromCoords = function (lat, lon) {
                lat = parseFloat(lat);
                lon = parseFloat(lon);
                if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) return null;
                return (lon >= 166 && lon <= 179 && lat >= -47 && lat <= -34);
            };
            console.log('[CombinedExport] GH-362 recommender availability: prebble=' + _prebbleAvailable +
                ' au=' + _auAvailable + ' (branch now resolved per sample, see per-sample logs below)');

            anrReports.forEach(function(r) {
                if (!r.data || !r.data.soil || !r.data.soil.hasData) { _perSampleProgSkip++; return; }
                if (r._anr && r._anr.isCotula) { _perSampleProgSkip++; return; }

                var perSampleInputs = Object.assign({}, _facilityCalendarInputs);

                // GH-383 (D31 stage 1): every programme-level input for THIS
                // sample's site comes from the one shared adapter, keyed by
                // r.siteId — not from the facility-level collectFromState()
                // snapshot this object starts as a copy of.
                //
                // What that closes: the facility snapshot is built once, from
                // the hidden #rp-hub-runner's own DOM, which
                // nutrition-calendar.js's restoreFromPersisted() fills with
                // whichever site was active first and then refuses to refill
                // (it returns early once this.program is set). Every later
                // site in a multi-site Combined export therefore inherited the
                // FIRST site's annual N target — REVIEW-GH349-onward.md's open
                // question 12, seen live as a Burns sample printing 250 kg N/ha
                // in a Test5-active export.
                var _NPI = window.GAIP_NutritionProgramInputs;
                var _siteInputs = null;
                if (_NPI) {
                    try {
                        _siteInputs = _NPI.resolveSiteProgramInputs({
                            siteId: r.siteId,
                            soil: r.data.soil || null,
                            sample: {
                                species: (r.data.engineInputs && r.data.engineInputs.turf && r.data.engineInputs.turf.species) || undefined,
                                methodology: (r.data.soil && r.data.soil.methodology) || undefined,
                                soilTexture: (r.data.engineInputs && r.data.engineInputs.soilTexture) || undefined,
                                CEC: (r.data.soil && (r.data.soil.CEC != null ? r.data.soil.CEC : r.data.soil.cec)),
                                pH: (r.data.soil && (r.data.soil.pH_water != null ? r.data.soil.pH_water : r.data.soil.pH))
                            },
                            // Never let this per-site resolution read the Plan
                            // page's live form: this page has none, and a
                            // hidden legacy input with the same class is
                            // exactly the cross-site leak above.
                            planForm: null
                        });
                    } catch (_piErr) {
                        console.warn('[CombinedExport] GH-383: programme input resolution failed for site',
                            r.siteId, '-', _piErr && _piErr.message);
                    }
                }
                if (!_siteInputs) {
                    // No adapter, or no config for this site. Do not guess with
                    // another site's numbers — skip this sample's programme,
                    // the same way a missing annual N target already did.
                    console.warn('[CombinedExport] GH-383: no programme inputs for site', r.siteId,
                        '— skipping this sample\'s per-sample programme rather than computing it ' +
                        'against another site\'s configuration.');
                    _perSampleProgSkip++;
                    return;
                }

                var _siteCfg = _NPI.getSiteConfig(r.siteId);
                var _persistedCal = _siteCfg && _siteCfg.nutritionCalendarProgram;
                // GH-367: "the lookup ran and this site has no saved config"
                // and "the lookup could not run at all" are different answers.
                // GH-383 collapses the second case earlier — resolveSiteProgram
                // Inputs() throws rather than borrowing another site's config,
                // and the guard above skips the sample — so reaching this line
                // means the lookup succeeded. The flag stays because the
                // distributor binding below still gates on it.
                var _siteCfgLookupOk = !!_siteCfg;

                if (!(_siteInputs.annualN > 0)) {
                    console.warn('[CombinedExport] GH-383: no annual N resolved for site', r.siteId,
                        '(source', _siteInputs.sources.annualN + ') — skipping this sample\'s programme.');
                    _perSampleProgSkip++;
                    return;
                }
                // GH-394 (D31 stage 3): the PRE-traffic base, plus the modifier
                // the adapter resolved — not `_siteInputs.annualN`, which is
                // already scaled. computeProgram() multiplies annualNOverride by
                // the modifier itself (it is the Plan page's own single
                // application point), so handing it the adjusted N applied the
                // modifier a second time: 1.15 became 1.3225 on a sports site's
                // per-sample programme in a Combined export, while the same
                // site's ANR table — which the engine computes without
                // re-multiplying — printed 1.15. Inert until this ticket
                // because every site resolved 1.0; live the moment a schedule
                // is saved, which is why it is fixed here and not later.
                perSampleInputs.annualNOverride = _siteInputs.annualNBase;
                perSampleInputs.clippingManagement = _siteInputs.clippingManagement;
                perSampleInputs.traffic = _siteInputs.trafficIntensity;
                perSampleInputs.trafficModifier = _siteInputs.trafficModifier;
                perSampleInputs.inputSources = _siteInputs.sources;
                // GH-387: the RAW surface the calendar works in ('greens',
                // 'soccer', ...) — the same value nutrition-calendar.js's
                // collectFromState() resolves on the Plan page and stamps as
                // meta.surfaceType. GH-383 assigned `turfType` here ('golf',
                // 'sports'), which is a different field entirely: the Plan and
                // the export then handed their product recommenders different
                // surfaces and, on an AU site, got different products out of
                // the same catalogue for the same sample.
                perSampleInputs.surfaceType = _siteInputs.surfaceType || perSampleInputs.surfaceType;
                perSampleInputs.species = _siteInputs.speciesKey || perSampleInputs.species;
                perSampleInputs.speciesDisplay = _siteInputs.speciesDisplay || perSampleInputs.speciesDisplay;
                perSampleInputs.methodology = _siteInputs.methodology;
                perSampleInputs.soilTexture = _siteInputs.soilTexture;
                perSampleInputs.CEC = _siteInputs.CEC;
                perSampleInputs.pH = _siteInputs.pH;

                // maxNPerMonth and the distribution mode are not part of the
                // requirement contract (they shape the monthly SCHEDULE, not
                // the annual figures) and stay where they were.
                if (_siteCfg && _siteCfg.maxNPerMonth > 0) {
                    perSampleInputs.maxNPerMonth = _siteCfg.maxNPerMonth;
                }
                if (_persistedCal && _persistedCal.meta && _persistedCal.meta.distribution) {
                    perSampleInputs.distribution = _persistedCal.meta.distribution;
                }

                // GH-383: `parseFloat(...) || 0` turned a missing reading into
                // 0 ppm, which reads as maximally deficient against every floor
                // and triggers the largest possible lift for a nutrient that
                // was never measured — the exact failure GH-338 fixed on the
                // Plan page and left standing here. validateSampleInputs()
                // applies that same null-not-zero rule for both surfaces.
                var _validated = _NPI.validateSampleInputs({
                    soil: r.data.soil,
                    bulkDensity: perSampleInputs.bulkDensity,
                    soilDepth: perSampleInputs.soilDepth
                });
                perSampleInputs.soilPpm = _validated.soilPpm;

                // GH-361 (Hoxton audit D07a): same "this sample's own data,
                // not the facility default" overlay as soilPpm above, so
                // computeProgram()'s tissue gate sees this sample's real
                // tissue percentages when a tissue result exists for it —
                // r.data.tissue is populated per-sample by the same
                // collectData()/_buildEngineInputs() pipeline soil comes
                // from (word-export.js), matched to this sample's zone.
                //
                // GH-369 follow-up (independent review): this used to parse
                // r.data.tissue inline and OVERWRITE perSampleInputs.tissuePercent
                // unconditionally, including with an all-null object when
                // r.data.tissue had nothing. Two problems: (1) it duplicated
                // _tissuePercentFromData()'s parse instead of sharing it; (2)
                // perSampleInputs starts as a copy of _facilityCalendarInputs,
                // which nutrition-calendar.js's own collectFromState() may
                // already have populated with a MORE complete resolution (its
                // SampleManager fallback + {tissue:{...}} wrapper-unwrap,
                // neither of which this per-sample overlay re-implements) —
                // clobbering that with an all-null object whenever this
                // sample's r.data.tissue came up empty threw away a real
                // value the facility-level resolution had already found,
                // silently losing the tissue gate in the export while the
                // Plan page (which reads collectFromState() directly) kept
                // it — the exact UI-vs-export divergence class GH-362 exists
                // to close. Now only overlays when this sample's own tissue
                // data actually resolved to something.
                var _resolvedSampleTissue = (window.GAIP_WordExport && window.GAIP_WordExport._tissuePercentFromData)
                    ? window.GAIP_WordExport._tissuePercentFromData(r.data)
                    : null;
                if (_resolvedSampleTissue) {
                    perSampleInputs.tissuePercent = _resolvedSampleTissue;
                }
                // else: leave whatever _facilityCalendarInputs already carried
                // (collectFromState()'s own resolution) rather than clobbering
                // it with nulls.

                // GH-245 follow-up 3: perSampleInputs started as a copy of
                // _facilityCalendarInputs, which was built once from
                // window.climateMetrics — whichever site happened to be
                // active LAST in the collection loop above, not this sample's
                // own site. Every sample's Monthly Schedule was silently
                // computed against one site's climate (or null, if that last
                // site failed). r.data.engineInputs.climate was already
                // resolved correctly per-sample in that same collection loop
                // (via _buildEngineInputs()/collectData(), same mechanism
                // Monthly N Distribution already relies on) — overlay it here
                // so the calendar engine sees this sample's real climate.
                var _sampleClimate = r.data.engineInputs && r.data.engineInputs.climate;
                if (_sampleClimate) {
                    // GH-363: month-key convention mismatch, and the real cause
                    // of what GH-354 only guarded against. GilbaClimateNormals
                    // Service keys monthlyTemps 1-12 (climate-normals-service.js),
                    // which is what nutrition-requirement-engine.js consumes and
                    // what engineInputs.climate carries. GilbaNutritionCalendar
                    // works in 0-11 and has extractMonthlyTemps() to reindex
                    // exactly once on the way in — this overlay bypassed it and
                    // handed computeProgram() the raw 1-12 object, whose key 0 is
                    // always undefined. Confirmed live on a site with fully
                    // resolved NASA POWER normals: every sample returned
                    // climateDataUnavailable ('fetch-failed', though the fetch
                    // had succeeded), per-sample programmes came out ok=0
                    // failed=1, and the report silently fell back to the cached
                    // site-level window.GAIP_NUTRITION_PROGRAM instead of the
                    // per-sample recompute b35fix307/GH-245 introduced.
                    // Reindexed through the calendar's own helper so the
                    // convention has one implementation, not two.
                    var _reindexed = (window.GilbaNutritionCalendar &&
                        typeof window.GilbaNutritionCalendar.extractMonthlyTemps === 'function')
                        ? window.GilbaNutritionCalendar.extractMonthlyTemps(
                            { monthlyTemps: _sampleClimate.monthlyTemps }, {})
                        : _sampleClimate.monthlyTemps;
                    perSampleInputs.monthlyTemps = _reindexed;
                    perSampleInputs.hemisphere = _sampleClimate.hemisphere;
                    perSampleInputs.latitude = _sampleClimate.latitude;
                    perSampleInputs.monthlyTempsUnavailableReason = _sampleClimate.unavailableReason;
                }

                // GH-362: resolve THIS sample's product catalogue from THIS
                // sample's coordinates — see the block comment above the loop
                // for why the previous once-per-document resolution was wrong.
                // GH-367: placeholder coordinates are NOT an answer. _build
                // EngineInputs() substitutes a Sydney-ish -33/151 when a site
                // has none saved, which reads here as a valid Australian
                // location -- so an NZ site with no coordinates resolved to the
                // AU catalogue and this branch's "unknown" path (below) could
                // never be reached. Treat the placeholder as unknown so the
                // site-config and global-detection fallbacks actually run.
                var _sampleNZ = (_sampleClimate && _sampleClimate.coordinatesDefaulted)
                    ? null
                    : _nzFromCoords(
                        _sampleClimate && _sampleClimate.latitude,
                        _sampleClimate && _sampleClimate.longitude
                    );
                var _nzSource = (_sampleClimate && _sampleClimate.coordinatesDefaulted)
                    ? 'placeholder-coordinates-ignored'
                    : 'sample-coordinates';
                if (_sampleNZ === null) {
                    // No usable coordinates for this sample. An nzDistributor on
                    // this site's own persisted config means the NZ-only
                    // distributor panel was used for it (that dropdown renders
                    // only for NZ sites), which is still site-specific evidence.
                    // The global detection is the last resort and only preserves
                    // pre-GH-362 behaviour rather than regressing every
                    // coordinate-less site to "not NZ".
                    if (_siteCfg && _siteCfg.nzDistributor) {
                        _sampleNZ = true;
                        _nzSource = 'site-config-nzDistributor';
                    } else {
                        _sampleNZ = !!(window.NutritionPrebbleIntegration
                            && typeof window.NutritionPrebbleIntegration.isNewZealand === 'function'
                            && window.NutritionPrebbleIntegration.isNewZealand());
                        _nzSource = 'global-detection-fallback';
                    }
                }
                var _usePrebble = _sampleNZ && _prebbleAvailable;
                var _useAU = !_sampleNZ && _auAvailable;
                console.log('[CombinedExport] GH-362 branch for sample', r.sampleId, 'site', r.siteId,
                    ': isNZ=' + _sampleNZ + ' (via ' + _nzSource + ')' +
                    ' lat=' + (_sampleClimate && _sampleClimate.latitude) +
                    ' lon=' + (_sampleClimate && _sampleClimate.longitude) +
                    ' usePrebble=' + _usePrebble + ' useAU=' + _useAU);

                // GH-362: an NZ sample with no Prebble catalogue loaded used to
                // fall through to the AU recommender behind a console.warn
                // (b35fix305). The audit's D30 fix shape is explicit that a
                // silent fallback to a default catalogue must become a loud
                // failure. r.data.nutritionProgram is cleared as well as skipped
                // because collectData() may already have populated it from the
                // on-screen window.GAIP_NUTRITION_PROGRAM cache (word-export.js
                // "v10.3.38"), which is exactly the wrong-catalogue programme we
                // must not print — skipping the recompute alone would leave it
                // standing.
                if (_sampleNZ && !_prebbleAvailable) {
                    console.warn('[CombinedExport] GH-362: sample', r.sampleId, 'site', r.siteId,
                        'resolves to NZ but PrebbleRecommender is unavailable — omitting the fertiliser ' +
                        'programme rather than substituting the AU catalogue.');
                    r.data.nutritionProgram = { hasData: false };
                    r.data.nutritionProgramCatalogueUnavailable = true;
                    r.data.nutritionProgramCatalogueUnavailableRegion = 'New Zealand';
                    _perSampleProgFail++;
                    return;
                }
                if (!_usePrebble && !_useAU) {
                    console.warn('[CombinedExport] GH-362: sample', r.sampleId, 'site', r.siteId,
                        'has no product catalogue available for its region — omitting the fertiliser programme.');
                    r.data.nutritionProgram = { hasData: false };
                    r.data.nutritionProgramCatalogueUnavailable = true;
                    _perSampleProgFail++;
                    return;
                }

                // b35fix382 INSTRUMENTATION — log calendar engine inputs BEFORE
                // computeProgram fires, so we can see exactly what soilPpm,
                // bulkDensity, soilDepth, methodology, annualNOverride and
                // monthlyTemps the per-sample calendar saw. b35fix381 logged
                // the recommender inputs (post-calendar). This logs the calendar
                // inputs (pre-calendar). Diff against the live preview to find
                // whether soilPpm overlay actually reached the engine.
                try {
                    console.log('[CombinedExport b35fix382] calendar PRE-compute inputs:', {
                        sampleId: r.sampleId,
                        siteId: r.siteId,
                        soilPpm: perSampleInputs.soilPpm,
                        bulkDensity: perSampleInputs.bulkDensity,
                        soilDepth: perSampleInputs.soilDepth,
                        methodology: perSampleInputs.methodology,
                        annualNOverride: perSampleInputs.annualNOverride,
                        species: perSampleInputs.species,
                        clippingManagement: perSampleInputs.clippingManagement,
                        traffic: perSampleInputs.traffic,
                        surfaceType: perSampleInputs.surfaceType,
                        rDataSoilK: r.data.soil.K,
                        rDataSoilHasData: r.data.soil.hasData,
                    });
                } catch (_e) {
                    console.warn('[CombinedExport b35fix382] PRE-compute log failed:', _e && _e.message);
                }

                try {
                    var perSampleCalendar = window.GilbaNutritionCalendar.computeProgram(perSampleInputs);
                    if (!perSampleCalendar || perSampleCalendar.error) {
                        console.warn('[CombinedExport] computeProgram error for sample', r.sampleId, ':', perSampleCalendar && perSampleCalendar.error);
                        _perSampleProgFail++;
                        return;
                    }
                    if (perSampleCalendar.climateDataUnavailable) {
                        // GH-245 / GH-245 follow-up 3: no real monthly climate
                        // normals for this sample's own site — see
                        // perSampleCalendar.climateDataUnavailableReason for
                        // why (no coordinates configured, service not loaded,
                        // or NASA POWER + the Open-Meteo fallback both failed).
                        // Skip Monthly Schedule for this sample rather than
                        // crash on the missing .program shape or fabricate one
                        // from a latitude guess. Surfaced via
                        // r.data.nutritionSummary.climateDataUnavailable
                        // (set separately, from _buildEngineInputs) for the
                        // Monthly N Distribution disclaimer. Hoxton audit D03.
                        console.warn('[CombinedExport] climate data unavailable for sample', r.sampleId, '- skipping Monthly Schedule');
                        r.data.nutritionProgramClimateDataUnavailable = true;
                        r.data.nutritionProgramClimateDataUnavailableReason = perSampleCalendar.climateDataUnavailableReason;
                        // GH-363: skipping the recompute is not enough. collectData()
                        // may already have filled r.data.nutritionProgram from the
                        // on-screen window.GAIP_NUTRITION_PROGRAM cache
                        // (word-export.js "v10.3.38"), so leaving it standing prints a
                        // site-level programme in place of the per-sample one that was
                        // just declared uncomputable — the silent substitution this
                        // branch exists to prevent. Clear it and let the renderer say
                        // why (the flag below is what re-opens the section; see
                        // word-export.js renderNutritionProgramSection).
                        r.data.nutritionProgram = { hasData: false };
                        if (!r.data.nutritionSummary) r.data.nutritionSummary = {};
                        r.data.nutritionSummary.climateDataUnavailable = true;
                        r.data.nutritionSummary.climateDataUnavailableReason =
                            perSampleCalendar.climateDataUnavailableReason;
                        _perSampleProgFail++;
                        return;
                    }

                    // b35fix382 INSTRUMENTATION — log what the calendar engine
                    // produced. annual_totals.K shows the engine's resolved
                    // annual K requirement (removal + correction). If this is
                    // identical for every sample despite different soilPpm.K,
                    // the calendar engine isn't seeing the per-sample overlay.
                    try {
                        console.log('[CombinedExport b35fix382] calendar POST-compute output:', {
                            sampleId: r.sampleId,
                            annualN: perSampleCalendar.annual_totals && perSampleCalendar.annual_totals.N,
                            annualK: perSampleCalendar.annual_totals && perSampleCalendar.annual_totals.K,
                            annualP: perSampleCalendar.annual_totals && perSampleCalendar.annual_totals.P,
                            soilSeenK: perSampleCalendar.soil && perSampleCalendar.soil.ppm && perSampleCalendar.soil.ppm.K,
                            methodology: perSampleCalendar.meta && perSampleCalendar.meta.methodology,
                            adjustments_K: perSampleCalendar.adjustments && perSampleCalendar.adjustments.K,
                        });
                    } catch (_e) {
                        console.warn('[CombinedExport b35fix382] POST-compute log failed:', _e && _e.message);
                    }

                    // GH-362 superseded GH-360's guard here: the branch is now
                    // resolved per sample before this point (see the
                    // "GH-362 branch for sample" block above), so a wrong-region
                    // catalogue can no longer reach this line to be guarded
                    // against.
                    var perSampleProgram;
                    if (_useAU) {
                        // b35fix381 INSTRUMENTATION — paired with
                        // [NutritionAuFertiliserIntegration b35fix381] PRE log
                        // in nutrition-au-fertiliser-integration.js. Same
                        // shape, same fields, different `path` tag. Diff the
                        // two PRE blocks for a given sampleId to find the
                        // monthly K profile divergence (or confirm inputs
                        // match and the difference is post-input).
                        var _options = {
                            // GH-387: the AU recommender keys on the CANONICAL
                            // surface key ('golf_greens', 'tees', 'fairways'),
                            // which is what NutritionAuFertiliserIntegration's
                            // getSurfaceType() hands it on the Plan page. Both
                            // now come from the shared adapter's one mapping,
                            // so the two surfaces cannot resolve it differently.
                            surfaceType: _siteInputs.recommenderSurfaceType || perSampleInputs.surfaceType,
                            methodology: perSampleInputs.methodology,
                            distributorFilter: (window.NutritionAuFertiliserIntegration
                                && window.NutritionAuFertiliserIntegration.selectedDistributor) || 'all',
                            muldersFlags: {}
                        };
                        var _monthly = perSampleCalendar.program.monthly;
                        console.log('[CombinedExport b35fix381] PRE-recommender input snapshot:', {
                            path: 'combined-export-per-sample',
                            siteId: r.siteId,
                            sampleId: r.sampleId,
                            annualK: _monthly.reduce(function(s, m) { return s + (m.K || 0); }, 0),
                            annualN: _monthly.reduce(function(s, m) { return s + (m.N || 0); }, 0),
                            annualP: _monthly.reduce(function(s, m) { return s + (m.P || 0); }, 0),
                            monthlyK: _monthly.map(function(m) {
                                return { month: m.month_name || m.month, K: +(m.K || 0).toFixed(2), gp: +(m.gp || 0).toFixed(2) };
                            }),
                            options: {
                                surfaceType: _options.surfaceType,
                                methodology: _options.methodology,
                                distributorFilter: _options.distributorFilter,
                                muldersFlagsCount: 0,
                                muldersFlagsKeys: [],
                            },
                        });

                        perSampleProgram = window.AuFertiliserRecommender.generateAnnualProgram(
                            _monthly, _options
                        );

                        // b35fix381 INSTRUMENTATION — POST product set, paired
                        // with [NutritionAuFertiliserIntegration b35fix381]
                        // POST log. If PRE blocks match for the same sampleId
                        // but POST blocks differ, the divergence is in
                        // recommender selection (not input data).
                        try {
                            var _sel = [];
                            (perSampleProgram && perSampleProgram.monthly || []).forEach(function(m) {
                                (m.granular || []).forEach(function(p) {
                                    _sel.push({ id: p.id, name: p.name, kind: 'granular',
                                        month: m.month_name || m.month, rateKgHa: p.rateKgHa || 0 });
                                });
                                (m.liquid || []).forEach(function(p) {
                                    _sel.push({ id: p.id, name: p.name, kind: 'liquid',
                                        month: m.month_name || m.month, rateLHa: p.rateLHa || 0 });
                                });
                            });
                            console.log('[CombinedExport b35fix381] POST-recommender selection:', {
                                path: 'combined-export-per-sample',
                                sampleId: r.sampleId,
                                productIds: Array.from(new Set(_sel.map(function(s) { return s.id; }))),
                                applications: _sel,
                            });
                        } catch (_e) {
                            console.warn('[CombinedExport b35fix381] POST-instrument failed for ' +
                                r.sampleId + ': ' + (_e && _e.message));
                        }
                    } else if (_usePrebble) {
                        // Mirror the on-screen distributor filter (see
                        // NutritionNzFertiliserIntegration.generateAndRender / getProductsForDistributor).
                        // Without this, the report always used the raw, unfiltered Prebble-only
                        // catalogue no matter which distributor the user picked in the
                        // "Distributor" dropdown on Plan > Nutrition, so the report's product
                        // set could differ from what was actually shown on screen.
                        // GH-367 (Hoxton audit D30, second half). The line below
                        // used to be `(_siteCfg && _siteCfg.nzDistributor) || 'all'`,
                        // which collapsed three different situations into the
                        // same silent default:
                        //
                        //   1. the site config was read and carries no
                        //      nzDistributor -- the operator never touched the
                        //      dropdown, whose own default IS 'all'. Legitimate.
                        //   2. the site config could NOT be read (module absent,
                        //      lookup threw). We do not know what the operator
                        //      chose, and 'all' silently widens the catalogue.
                        //   3. the filter machinery itself is unavailable, so
                        //      whatever was chosen cannot be applied -- the raw
                        //      window.PrebbleProducts pool is Prebble-only, so a
                        //      PGG Wrightson customer gets a purchasing table of
                        //      Prebble products.
                        //
                        // 2 and 3 are exactly the audit's question ("does the
                        // export path receive the distributor at all, or receive
                        // it and ignore it?") and its fix shape is explicit: an
                        // unresolved binding must be a loud failure, not a
                        // fall-through to a default catalogue. They now skip the
                        // sample the same way an unresolvable region does.
                        if (!_siteCfgLookupOk) {
                            console.warn('[CombinedExport] GH-367: sample', r.sampleId, 'site', r.siteId,
                                '— the site config could not be read, so the distributor selection is unknown. ' +
                                'Omitting the fertiliser programme rather than defaulting to the full catalogue.');
                            r.data.nutritionProgram = { hasData: false };
                            r.data.nutritionProgramCatalogueUnavailable = true;
                            r.data.nutritionProgramCatalogueUnavailableReason = 'distributor-unresolved';
                            _perSampleProgFail++;
                            return;
                        }

                        var _nzDistributor = (_siteCfg && _siteCfg.nzDistributor) || 'all';
                        var _origPrebbleGranular = null, _origPrebbleLiquid = null, _swappedPrebblePool = false;
                        if (window.NutritionNzFertiliserIntegration
                                && typeof window.NutritionNzFertiliserIntegration.getProductsForDistributor === 'function'
                                && window.PrebbleProducts) {
                            var _pool = window.NutritionNzFertiliserIntegration.getProductsForDistributor(_nzDistributor);
                            _origPrebbleGranular = window.PrebbleProducts.granular;
                            _origPrebbleLiquid = window.PrebbleProducts.liquid;
                            window.PrebbleProducts.granular = _pool.granular;
                            window.PrebbleProducts.liquid = _pool.liquid;
                            _swappedPrebblePool = true;
                        }

                        // Case 3. The raw pool happens to equal the 'prebble'
                        // selection, so that one alone is still honoured; every
                        // other selection would silently ship the wrong
                        // catalogue.
                        if (!_swappedPrebblePool && _nzDistributor !== 'prebble') {
                            console.warn('[CombinedExport] GH-367: sample', r.sampleId, 'site', r.siteId,
                                '— distributor "' + _nzDistributor + '" is selected but the product-filter ' +
                                'machinery (NutritionNzFertiliserIntegration/PrebbleProducts) is unavailable, so ' +
                                'the filter cannot be applied. Omitting the fertiliser programme rather than ' +
                                'shipping an unfiltered catalogue.');
                            r.data.nutritionProgram = { hasData: false };
                            r.data.nutritionProgramCatalogueUnavailable = true;
                            r.data.nutritionProgramCatalogueUnavailableReason = 'distributor-filter-unavailable';
                            _perSampleProgFail++;
                            return;
                        }
                        console.log('[CombinedExport] nzdist-debug per-sample:', {
                            sampleId: r.sampleId,
                            siteId: r.siteId,
                            hasSiteCfg: !!_siteCfg,
                            resolvedDistributor: _nzDistributor,
                            swapped: _swappedPrebblePool,
                            granularCount: _swappedPrebblePool ? _pool.granular.length : (window.PrebbleProducts.granular || []).length,
                            granularIds: _swappedPrebblePool ? _pool.granular.map(function(p) { return p.id; }) : null,
                        });
                        // Mirror NutritionNzFertiliserIntegration.generateAndRender()'s context
                        // object as closely as the per-sample loop allows. Previously this call
                        // only passed {surfaceType, methodology, muldersFlags} — missing
                        // soilPpm/pDeficient/latitude/soilTemp/soilCEC/irrigationFrequency/
                        // tissueStatus meant generateProgram() ran with soilPDeficient always
                        // false and a default -35° latitude for its soil-temp/release-curve
                        // estimate (see prebbles-products.js generateProgram), producing
                        // different product picks and "covered by"/carryover windows than what
                        // was shown on screen for the same sample. soilPpm/pDeficient now use
                        // this sample's own soil (perSampleInputs.soilPpm, built above from
                        // r.data.soil) — the rest (CEC/irrigation/soilTemp/latitude/tissue)
                        // aren't sample-specific on screen either, so read via the same
                        // NutritionPrebbleIntegration getters the live page calls, for parity
                        // rather than inventing a different source here.
                        var _pi = window.NutritionPrebbleIntegration;
                        // GH-379: perSampleInputs.methodology is the folded
                        // lowercase key (see the hand-off above), so this
                        // compare is no longer defeated by word-export.js's
                        // upper-cased stamp.
                        var _pThreshold = (perSampleInputs.methodology === 'mlsn') ? 21 : 30;
                        var _pDeficient = perSampleInputs.soilPpm && perSampleInputs.soilPpm.P != null
                            && perSampleInputs.soilPpm.P < _pThreshold;
                        var _prebbleContext = {
                            surfaceType: perSampleInputs.surfaceType,
                            methodology: perSampleInputs.methodology,
                            soilCEC: _pi && typeof _pi.getSoilCEC === 'function' ? _pi.getSoilCEC() : null,
                            irrigationFrequency: _pi && typeof _pi.getIrrigationFrequency === 'function' ? _pi.getIrrigationFrequency() : null,
                            soilTemp: _pi && typeof _pi.getSoilTemperature === 'function' ? _pi.getSoilTemperature() : null,
                            latitude: _pi && typeof _pi.getLatitude === 'function' ? _pi.getLatitude() : null,
                            hemisphere: 'southern',
                            soilPpm: perSampleInputs.soilPpm,
                            pDeficient: _pDeficient,
                            tissueStatus: _pi && typeof _pi.getTissueStatus === 'function' ? _pi.getTissueStatus() : null,
                            establishment: false,
                            seeding: false,
                            renovation: false,
                            muldersFlags: {}
                        };
                        // b35fix426 INSTRUMENTATION — mirrors the [NutritionAuFertiliserIntegration
                        // b35fix381] / [CombinedExport b35fix381] PRE/POST pair, applied to the
                        // Prebble/NZ branch (never instrumented before). Diff this PRE block
                        // against a matching PRE log added to NutritionNzFertiliserIntegration.
                        // generateAndRender() for the same sample's site to find exactly which
                        // input still differs between the on-screen calc and this per-sample
                        // recompute.
                        var _prebbleMonthly = (perSampleCalendar.program && perSampleCalendar.program.monthly) || [];
                        console.log('[CombinedExport b35fix426] PRE-recommender input snapshot:\n' + JSON.stringify({
                            path: 'combined-export-per-sample',
                            siteId: r.siteId,
                            sampleId: r.sampleId,
                            context: _prebbleContext,
                            monthlyNKP: _prebbleMonthly.map(function(m) {
                                return { month: m.month_name || m.month, gp: +(m.gp || 0).toFixed(2), N: +(m.N || 0).toFixed(1), K: +(m.K || 0).toFixed(1), P: +(m.P || 0).toFixed(1) };
                            }),
                        }, null, 2));
                        try {
                            perSampleProgram = window.PrebbleRecommender.generateProgram(perSampleCalendar, _prebbleContext);
                        } finally {
                            if (_swappedPrebblePool) {
                                window.PrebbleProducts.granular = _origPrebbleGranular;
                                window.PrebbleProducts.liquid = _origPrebbleLiquid;
                            }
                        }
                        // b35fix426 INSTRUMENTATION — POST product set + coveredBy state per
                        // month, paired with the PRE block above.
                        try {
                            console.log('[CombinedExport b35fix426] POST-recommender monthly:\n' + JSON.stringify({
                                path: 'combined-export-per-sample',
                                sampleId: r.sampleId,
                                monthly: (perSampleProgram && perSampleProgram.monthly || []).map(function(m) {
                                    return {
                                        month: m.month_name || m.month,
                                        granular: (m.granular || []).map(function(p) { return p.name + ' @ ' + (p.rateKgHa || 0) + 'kg/ha'; }),
                                        liquid: (m.liquid || []).map(function(p) { return p.name + ' @ ' + (p.rateLHa || 0) + 'L/ha'; }),
                                        coveredBy: m.coveredBy ? (m.coveredBy.product + ' (' + m.coveredBy.month + ')') : null,
                                    };
                                }),
                            }, null, 2));
                        } catch (_e) {
                            console.warn('[CombinedExport b35fix426] POST-instrument failed for ' + r.sampleId + ': ' + (_e && _e.message));
                        }
                    }

                    if (!perSampleProgram || !perSampleProgram.monthly) {
                        console.warn('[CombinedExport] Recommender returned no monthly for sample', r.sampleId);
                        _perSampleProgFail++;
                        return;
                    }

                    var productUsage = null;
                    if (perSampleProgram.annualSummary && perSampleProgram.annualSummary.products) {
                        productUsage = perSampleProgram.annualSummary.products;
                    } else {
                        productUsage = {};
                        perSampleProgram.monthly.forEach(function(m) {
                            (m.granular || []).forEach(function(p) {
                                if (!productUsage[p.id]) {
                                    productUsage[p.id] = {
                                        product: p,
                                        brandName: p.brand,
                                        applications: 0,
                                        totalKgHa: 0,
                                        // b35fix322 Bug 1 quick fix: extend totalDelivered
                                        // to all macros + key micros so amendment self-suppression
                                        // (P/K/S/Ca/Mg) sees programme delivery correctly.
                                        // Previously only N/P/K were initialised → S/Ca/Mg/Fe
                                        // additions silently failed, then `delivers` only carried
                                        // N/P/K anyway (Bug 1 structural fix patches au-fertiliser-products.js
                                        // to publish full analysis).
                                        totalDelivered: { N: 0, P: 0, K: 0, S: 0, Ca: 0, Mg: 0, Fe: 0 }
                                    };
                                }
                                productUsage[p.id].applications++;
                                productUsage[p.id].totalKgHa += (p.rateKgHa || 0);
                                // b35fix322: derive deliveries from analysis when delivers
                                // doesn't carry the nutrient (delivers only tracks N/P/K
                                // for legacy reasons). analysis is the canonical source.
                                var gAnalysis = (p.analysis) || {};
                                ['N','P','K','S','Ca','Mg','Fe'].forEach(function(nut) {
                                    var fromDelivers = (p.delivers && p.delivers[nut]) || 0;
                                    var fromAnalysis = (parseFloat(gAnalysis[nut]) || 0) * (p.rateKgHa || 0) / 100;
                                    // Prefer delivers when populated (engine-computed
                                    // for N/P/K accounts for release timing); fall back
                                    // to analysis-derived for the others.
                                    var add = (fromDelivers > 0) ? fromDelivers : fromAnalysis;
                                    productUsage[p.id].totalDelivered[nut] += add;
                                });
                            });
                            (m.liquid || []).forEach(function(p) {
                                if (!productUsage[p.id]) {
                                    productUsage[p.id] = {
                                        product: p,
                                        brandName: p.brand,
                                        applications: 0,
                                        totalLHa: 0,
                                        // b35fix322 Bug 1 quick fix: full totalDelivered keys.
                                        totalDelivered: { N: 0, P: 0, K: 0, S: 0, Ca: 0, Mg: 0, Fe: 0 }
                                    };
                                }
                                productUsage[p.id].applications++;
                                if (p.form === 'soluble') {
                                    productUsage[p.id].totalKgHa =
                                        (productUsage[p.id].totalKgHa || 0) + (p.rateLHa || 0);
                                } else {
                                    productUsage[p.id].totalLHa =
                                        (productUsage[p.id].totalLHa || 0) + (p.rateLHa || 0);
                                }
                                // b35fix322: see granular branch above for rationale.
                                var lAnalysis = (p.analysis) || {};
                                // For liquids the rate is L/ha or kg/ha depending on form;
                                // analysis is %w/v or %w/w respectively. Both yield kg/ha
                                // of nutrient when multiplied by rate × pct / 100 to first
                                // approximation (catalogue convention used elsewhere in
                                // word-export-combined.js for purchasing summary maths).
                                var lRate = (p.rateLHa || 0);
                                ['N','P','K','S','Ca','Mg','Fe'].forEach(function(nut) {
                                    var fromDelivers = (p.delivers && p.delivers[nut]) || 0;
                                    var fromAnalysis = (parseFloat(lAnalysis[nut]) || 0) * lRate / 100;
                                    var add = (fromDelivers > 0) ? fromDelivers : fromAnalysis;
                                    productUsage[p.id].totalDelivered[nut] += add;
                                });
                            });
                        });
                    }

                    // Write per-sample programme BEFORE we.buildSections runs for this report.
                    // This is the core of b35fix307 Q1 — every downstream render now sees
                    // per-sample data consistently.
                    r.data.nutritionProgram = {
                        hasData: true,
                        monthly: perSampleProgram.monthly,
                        annualSummary: { products: productUsage },
                        strategy: perSampleCalendar.adjustments || {},
                        muldersFlags: {},
                        _generatedForSample: r.sampleId
                    };

                    // ───────── b35fix322: amendment merge ─────────
                    // After the per-sample N programme is in place, compute
                    // amendment decisions against that programme and merge any
                    // `apply` decisions into annualSummary.products. This is
                    // the bridge that lets Annual Product Summary, Monthly
                    // Schedule, and Purchasing Summary all see amendments.
                    //
                    // Self-suppression is prevented by the _isAmendment flag on
                    // each entry — checkProgrammeDelivery() inside
                    // _computeAmendmentDecision skips flagged entries when
                    // computing programme delivery for downstream nutrients.
                    //
                    // ORDER MATTERS: decisions must be computed against the
                    // programme that contains ONLY catalogue products
                    // (productUsage as built above). We then merge amendments
                    // into r.data.nutritionProgram.annualSummary.products. If
                    // we computed decisions after the merge, the very products
                    // we're producing would be visible in the programme-delivery
                    // calculation (and only suppressed by the _isAmendment guard
                    // — better not to depend on it twice).
                    try {
                        var _wx = window.GAIP_WordExport;
                        if (_wx && typeof _wx._computeAmendmentDecision === 'function'
                                && typeof _wx._amendmentDecisionsToProducts === 'function'
                                && r.data.soil && r.data.soil.thresholds) {
                            var _soilForAmend = r.data.soil;
                            var _surfaceType = (_facilityCalendarInputs && _facilityCalendarInputs.surfaceType) || '';
                            var _ctx = (r.data._combinedCtx || {});
                            var _hem = _ctx.hemisphere || 'south';
                            var _amendCtx = {
                                isOverseed: !!(_ctx.overseedConfig && _ctx.overseedConfig.isOverseed),
                                seedingActive: !!(_ctx.overseedConfig && _ctx.overseedConfig.isOverseed)
                            };

                            // Build decisions for any nutrient with measured deficit.
                            // Programme passed in is the catalogue-only programme
                            // (productUsage); amendments computed against this.
                            var _amendNutrients = ['P','K','Ca','Mg','S'];
                            var _amendDecisions = [];
                            _amendNutrients.forEach(function(n) {
                                var v = _soilForAmend[n];
                                var th = _soilForAmend.thresholds[n];
                                if (v === undefined || v === null || !th) return;
                                if (!(v < th.min)) return;
                                var deficit = th.min - v;
                                // b35fix424 (C20): hemisphere threaded through.
                                var d = _wx._computeAmendmentDecision(
                                    n, deficit, _soilForAmend, _surfaceType,
                                    r.data.nutritionProgram, _amendCtx, _hem
                                );
                                if (d) _amendDecisions.push(d);
                            });

                            // Convert apply-decisions to product entries.
                            var _amendOut = _wx._amendmentDecisionsToProducts(
                                _amendDecisions, _soilForAmend, _hem
                            );

                            var _amendIds = Object.keys(_amendOut.products);
                            if (_amendIds.length > 0) {
                                _amendIds.forEach(function(pid) {
                                    // No collision risk — amendment ids are
                                    // namespaced "amendment:NUT:slug". If a
                                    // catalogue product already used the same
                                    // id (impossible by construction but defend
                                    // against future namespace clashes), prefer
                                    // catalogue and skip.
                                    if (!productUsage[pid]) {
                                        productUsage[pid] = _amendOut.products[pid];
                                    }
                                });

                                // ───────── b35fix323: Monthly Schedule injection ─────────
                                // Annual Product Summary and Purchasing Summary read from
                                // annualSummary.products (merged above), but Monthly
                                // Schedule reads from `perSampleProgram.monthly[i].granular`.
                                // Without this injection the April/October row stays blank
                                // even though the Annual Product Summary shows the dolomite
                                // line. b35fix322 surfaced the bug by getting the row into
                                // Annual Product Summary; b35fix323 closes the loop.
                                //
                                // Index resolution preference (in order):
                                //   1. Match by month_name === monthSlot ('April' | 'October')
                                //      — handles both 'Apr'/'Oct' abbreviations and full names
                                //      because we test indexOf(monthSlot.slice(0,3))
                                //   2. Fall back to fixed monthIndex (3 for April, 9 for October)
                                //      — correct when monthly[] is a 12-entry Jan→Dec array
                                //
                                // If monthly[] is shorter than monthIndex (rare — partial
                                // year programmes), skip the schedule injection but keep
                                // the annualSummary merge — the Annual Product Summary
                                // and Purchasing Summary still show the row.
                                var _monthly = perSampleProgram.monthly || [];
                                var _slotAbbrev = (_amendOut.monthSlot || '').slice(0, 3);
                                var _idx = -1;
                                for (var _mi = 0; _mi < _monthly.length; _mi++) {
                                    var _mn = (_monthly[_mi] && _monthly[_mi].month_name) || '';
                                    if (_mn && _slotAbbrev &&
                                        _mn.toLowerCase().indexOf(_slotAbbrev.toLowerCase()) === 0) {
                                        _idx = _mi;
                                        break;
                                    }
                                }
                                if (_idx === -1 && _monthly.length > _amendOut.monthIndex) {
                                    _idx = _amendOut.monthIndex;
                                }

                                var _granEntries = _amendOut.granularEntries || [];
                                if (_idx >= 0 && _granEntries.length > 0) {
                                    if (!Array.isArray(_monthly[_idx].granular)) {
                                        _monthly[_idx].granular = [];
                                    }
                                    _granEntries.forEach(function(g) {
                                        // Defence: don't double-inject if a previous
                                        // run somehow left the same id in place.
                                        var alreadyThere = _monthly[_idx].granular.some(function(x) {
                                            return x && x.id === g.id;
                                        });
                                        if (!alreadyThere) _monthly[_idx].granular.push(g);
                                    });
                                    console.log('[CombinedExport] b35fix323 amendment scheduled for ' +
                                                r.sampleId + ': ' + _granEntries.length +
                                                ' entry/entries → monthly[' + _idx + '] (' +
                                                (_monthly[_idx].month_name || 'unknown') + ')');
                                } else if (_granEntries.length > 0) {
                                    console.warn('[CombinedExport] b35fix323 amendment NOT scheduled for ' +
                                                 r.sampleId + ': could not resolve monthly slot ' +
                                                 _amendOut.monthSlot + ' (monthly.length=' + _monthly.length + ')');
                                }
                                // ───────── end b35fix323 ─────────

                                console.log('[CombinedExport] b35fix322 amendments merged for ' +
                                            r.sampleId + ': ' + _amendIds.length +
                                            ' product(s), slot=' + _amendOut.monthSlot +
                                            ' hem=' + _hem);
                            }

                            // Also expose the structured decisions on the
                            // report so downstream renderers (Annual Soil
                            // Amendments table) can consume them without
                            // re-computing — both single and combined paths
                            // can rely on the same shape.
                            r.data._amendmentDecisions = _amendDecisions;
                            r.data._amendmentMonthSlot = _amendOut.monthSlot;

                            // ───────── b35fix324: K reconciliation merge ─────────
                            // Programme-shortfall-driven spot-K, distinct from the
                            // soil-deficit K above. This block runs AFTER the
                            // b35fix322/323 merge so:
                            //   (a) productUsage now contains both catalogue products
                            //       and any soil-deficit amendments
                            //   (b) the SSOT helper _computeProgrammeKDelivered skips
                            //       _isAmendment entries, so the catalogue-only K
                            //       sum is invariant under that merge
                            //
                            // K req comes from r._anr.K.val (the same number rendered
                            // in the K Reconciliation table). K delivered comes from
                            // _computeProgrammeKDelivered (the SAME function the
                            // K Reconciliation renderer uses via r._programmeKDelivered).
                            // Two callers, one source of truth — no asymmetric-engines
                            // pattern.
                            //
                            // _synthesiseKReconDecision applies both gates (programme
                            // balance < -20 AND soil K below threshold floor); returns
                            // null when either gate fails, so the merge is a no-op
                            // for sites that don't warrant spot-K.
                            try {
                                if (typeof _wx._synthesiseKReconDecision === 'function'
                                        && typeof _wx._computeProgrammeKDelivered === 'function'
                                        && r._anr && r._anr.K && r._anr.K.val != null) {
                                    // SSOT: compute catalogue-only K once, store on r,
                                    // share with the renderer.
                                    var _catalogueK = _wx._computeProgrammeKDelivered(productUsage);
                                    r._programmeKDelivered = _catalogueK;

                                    var _kReconDecision = _wx._synthesiseKReconDecision(
                                        _soilForAmend,
                                        parseFloat(r._anr.K.val),
                                        _catalogueK
                                    );

                                    if (_kReconDecision) {
                                        var _kReconOut = _wx._amendmentDecisionsToProducts(
                                            [_kReconDecision], _soilForAmend, _hem
                                        );

                                        // Merge product entry (single, namespaced
                                        // amendment:K-recon:potassium-sulphate).
                                        Object.keys(_kReconOut.products).forEach(function(pid) {
                                            if (!productUsage[pid]) {
                                                productUsage[pid] = _kReconOut.products[pid];
                                            }
                                        });

                                        // Push split granular entries into their
                                        // resolved monthly slots. Each entry carries
                                        // _monthIndex set by the helper (Sep/Nov/Jan
                                        // south, Mar/May/Jul north). Resolution
                                        // preference: match by month_name first
                                        // (handles Jan/Feb abbreviations), fall back
                                        // to fixed _monthIndex.
                                        var _kMonthly = perSampleProgram.monthly || [];
                                        var _monthAbbrevs = ['Jan','Feb','Mar','Apr','May','Jun',
                                                             'Jul','Aug','Sep','Oct','Nov','Dec'];
                                        var _placedCount = 0, _missedCount = 0;

                                        (_kReconOut.granularEntries || []).forEach(function(g) {
                                            var targetIdx = g._monthIndex;
                                            var resolvedIdx = -1;

                                            // Try month_name match first
                                            if (typeof targetIdx === 'number' &&
                                                    targetIdx >= 0 && targetIdx < 12) {
                                                var targetAbbrev = _monthAbbrevs[targetIdx];
                                                for (var _ki = 0; _ki < _kMonthly.length; _ki++) {
                                                    var _kmn = (_kMonthly[_ki] && _kMonthly[_ki].month_name) || '';
                                                    if (_kmn && targetAbbrev &&
                                                            _kmn.toLowerCase().indexOf(targetAbbrev.toLowerCase()) === 0) {
                                                        resolvedIdx = _ki;
                                                        break;
                                                    }
                                                }
                                                // Fallback: fixed index
                                                if (resolvedIdx === -1 && _kMonthly.length > targetIdx) {
                                                    resolvedIdx = targetIdx;
                                                }
                                            }

                                            if (resolvedIdx >= 0) {
                                                if (!Array.isArray(_kMonthly[resolvedIdx].granular)) {
                                                    _kMonthly[resolvedIdx].granular = [];
                                                }
                                                // Defensive: don't double-inject
                                                var alreadyThere = _kMonthly[resolvedIdx].granular.some(function(x) {
                                                    return x && x.id === g.id;
                                                });
                                                if (!alreadyThere) {
                                                    _kMonthly[resolvedIdx].granular.push(g);
                                                    _placedCount++;
                                                }
                                            } else {
                                                _missedCount++;
                                            }
                                        });

                                        console.log('[CombinedExport] b35fix324 K-recon spot-K for ' +
                                                    r.sampleId + ': ' + _placedCount +
                                                    ' split(s) placed' +
                                                    (_missedCount > 0 ? ', ' + _missedCount + ' unresolved' : '') +
                                                    ' (kReq=' + parseFloat(r._anr.K.val).toFixed(0) +
                                                    ', kDel=' + _catalogueK.toFixed(0) +
                                                    ', balance=' + (_catalogueK - parseFloat(r._anr.K.val)).toFixed(0) +
                                                    ', soilK=' + (_soilForAmend.K || '?') +
                                                    ', floor=' + ((_soilForAmend.thresholds && _soilForAmend.thresholds.K && _soilForAmend.thresholds.K.min) || '?') + ')');

                                        // Expose K-recon decision on the report alongside
                                        // the b35fix322 decisions, so any future renderer
                                        // can distinguish the two amendment sources.
                                        if (!Array.isArray(r.data._kReconDecisions)) {
                                            r.data._kReconDecisions = [];
                                        }
                                        r.data._kReconDecisions.push(_kReconDecision);
                                    }
                                }
                            } catch (_kReconErr) {
                                console.warn('[CombinedExport] b35fix324 K-recon merge failed for ' +
                                             r.sampleId + ': ' + (_kReconErr && _kReconErr.message));
                            }
                            // ───────── end b35fix324 K reconciliation merge ─────────
                        }
                    } catch (_amendErr) {
                        console.warn('[CombinedExport] b35fix322 amendment merge failed for ' +
                                     r.sampleId + ': ' + (_amendErr && _amendErr.message));
                    }
                    // ───────── end b35fix322 amendment merge ─────────

                    _perSampleProgOk++;
                } catch (e) {
                    // GH-354-DEBUG: e.message alone ("Cannot read properties of
                    // null (reading '0')") doesn't say WHERE in this ~500-line
                    // try block it threw. Logging e.stack too until the exact
                    // line is confirmed live.
                    console.warn('[CombinedExport] per-sample programme failed for', r.sampleId, ':', e.message, '\n', e.stack);
                    _perSampleProgFail++;
                }
            });

            if (_perSampleProgOk > 0 || _perSampleProgFail > 0 || _perSampleProgSkip > 0) {
                console.log('[CombinedExport] b35fix307 per-sample programme (hoisted): ok=' + _perSampleProgOk +
                            ' failed=' + _perSampleProgFail +
                            ' skipped=' + _perSampleProgSkip +
                            ' (total samples=' + anrReports.length + ')');
            }
        }
        // ───────────── end b35fix307 Q1 hoisted preprocessing ─────────────

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
                    new TextRun({ text: report.siteLabel, bold: true, size: 28, color: '1F2937' }),
                    new TextRun({ text: ' ,  ', size: 28, color: '9CA3AF' }),
                    new TextRun({ text: report.sampleLabel || report.sampleId, bold: true, size: 28, color: '374151' })
                ]
            }));

            allChildren.push(new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: 'Report ' + (r + 1) + ' of ' + reports.length, size: 22, color: '9CA3AF' })]
            }));

            // b35fix310a Fix A1: zone provenance footer
            // Discloses which sample drives recommendations for this zone and whether
            // other samples for the same zone exist (which feed the trend section).
            // Keeps the reader informed of the collapse decision rather than hiding it.
            if (report.zoneProvenance) {
                var zp = report.zoneProvenance;
                var provenanceRuns = [];
                var winnerDate = zp.winnerDate ? ' (' + zp.winnerDate + ')' : '';
                if (zp.candidateCount > 1) {
                    provenanceRuns.push(new TextRun({
                        text: 'Recommendations based on latest sample: ' + zp.winnerLabel + winnerDate + '. ',
                        italics: true, size: 22, color: '6B7280'
                    }));
                    var priorDates = (zp.priorSamples || []).map(function(s) {
                        return s.date || s.label || s.sampleId;
                    }).join(', ');
                    var priorCount = zp.candidateCount - 1;
                    provenanceRuns.push(new TextRun({
                        text: priorCount + ' prior sample' +
                              (priorCount === 1 ? '' : 's') +
                              ' for this zone (' + priorDates + ') ' +
                              (priorCount === 1 ? 'informs' : 'inform') +
                              ' the Nutrient Trend Analysis section.',
                        italics: true, size: 22, color: '6B7280'
                    }));
                } else {
                    provenanceRuns.push(new TextRun({
                        text: 'Recommendations based on sample: ' + zp.winnerLabel + winnerDate +
                              ' (single sample for this zone, no trend history available).',
                        italics: true, size: 22, color: '6B7280'
                    }));
                }
                allChildren.push(new Paragraph({
                    spacing: { after: 200 },
                    children: provenanceRuns
                }));
            }

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
                            // b35fix429 (C30): Disease Risk Assessment, Moisture Management,
                            // Pre-Emergent Herbicide Timing entries removed (sections pruned
                            // from word-export.js); dead H2 subsections (Disease Details,
                            // Risk Drivers, 7-Day Forecast, Water Balance, Water Balance
                            // Parameters, Water Balance Chart) removed in lockstep.
                            'Active DMI Fungicide',
                            'Treatment Options',
                            'Soil Moisture Zones',
                            'Zone-Specific Recommendations',
                            '14-Day Stress Trajectory',
                            // b35fix433 (C42): Dew Forecast & Match Conditions deny-list entry removed in lockstep with section emit prune.
                            'Traffic & Wear Analysis',
                            'Phytotoxicity Risk',
                            // b35fix449 / C11x: Soil × Water Interactions paired
                            // with Phytotoxicity Risk above; both water-chemistry-driven,
                            // both architecturally site-wide. Pre-fix this entry was
                            // missing from the deny-list AND its classifier branch
                            // was missing at line ~785; either gap alone would have
                            // produced the bleed. Both gaps closed in lockstep.
                            'Soil × Water Interactions',
                            // b35fix450 / C11y: two dead deny-list entries
                            // pruned (Salinity Stress Impact, and the Salinity
                            // ampersand Stress Interactions category label).
                            // The first defended against a section the producer
                            // at word-export.js:~12363 explicitly suppresses in
                            // combined export via !window.GAIP_COMBINED_EXPORT_ACTIVE
                            // (water source is site-level so the per-sample
                            // emit is wrong by construction). The second is not
                            // an H1 heading at all, it is a category label
                            // inside the References and Methodology array at
                            // word-export.js:~13544 (small bold TextRun, no
                            // outlineLvl, classifier returns null for it).
                            // Neither entry was reachable through the
                            // per-sample classifier round-trip; both were
                            // misleading code that suggested a defence
                            // mechanism existed where none was needed.
                            // Surfaced 2026-05-08 during the post-b35fix429
                            // dead-heading audit (banked lesson #44, deny-list
                            // audit walks symmetric-difference both directions).
                            // Per banked lesson #29, the retired literals are
                            // described rather than quoted to avoid breaking
                            // the deny-list-extractor regex used by the C11y
                            // regression test.
                            'Environmental Stress Factors Affecting Recovery',
                            'Evapotranspiration & Species Selection',
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
                            'Fairway/Tee, Disease Assessment',
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

                    // "Site Information" in word-export.js carries pageBreakBefore:true
                    // (correct for single-report). In combined export this creates an extra
                    // page break that separates the heading from its table. Re-create
                    // the heading without pageBreakBefore so it flows naturally with its table.
                    if (extractHeadingText(sections[si3]) === 'Site Information') {
                        allChildren.push(new Paragraph({
                            heading: HeadingLevel.HEADING_1,
                            keepNext: true,
                            spacing: { before: 200, after: 100 },
                            children: [new TextRun('Site Information')]
                        }));
                        continue;
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

        // b35fix316 — TRANSPOSED Annual Nutrient Requirements table.
        //
        // Previous layout (pre-b35fix316): samples-as-columns. Each green got its own
        // column; nutrient rows ran down. That worked fine for 3-6 sample golf course
        // reports but broke down at council scale — Sutherland Shire Council's 45-sample
        // multi-site report produced a 1,464-character-wide table that spilled off the
        // page with illegible text.
        //
        // This transpose: samples-as-rows, nutrients-as-columns. Table width is now
        // fixed (8 columns for standard MLSN/SLAN/AA, 12 for cotula S78) regardless
        // of sample count; only table height grows. Scales linearly from 2 samples
        // to 100+ without horizontal overflow.
        //
        // Architecture:
        //   - Main ANR table: Sample | N | P ppm | P req | K ppm | K req | S ppm | S req
        //   - K reconciliation extracted to a separate follow-up table (standard path only):
        //     Sample | K req | K delivered | K balance | Spot K?
        //   - Cotula S78 path: Sample | pH | Olsen P | K %BS | Ca %BS | Mg %BS |
        //     Na %BS | CEC | TBS | VW | K/Mg | N program
        //
        // Rationale for splitting K reconciliation into a separate table:
        //   - Keeps main table narrow (8 cols vs 12 with K recon inline)
        //   - The five K columns (ppm, req, delivered, balance, spot) visually
        //     dominated the table even at 3-sample scale
        //   - K reconciliation is a different semantic concern (per-sample vs
        //     facility-level interplay) worth calling out separately
        // b35fix307 Q1: the per-sample ANR pass + Step 5 programme overlay already
        // ran before the per-report render loop, so r._anr and r.data.nutritionProgram
        // are populated by the time we reach here.
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

            // GH-383 (decision D-4b): the annual N every figure in this table
            // scales against comes from the site's own generated nutrition
            // programme. When a site has never had one generated, the shared
            // input adapter falls back to Settings > Turf and then to the
            // species default — a defensible number, but not one the client
            // chose on the Plan page, and the document must say so rather than
            // present it as their target. `annualNSource` is the adapter's own
            // provenance stamp, carried on engineInputs.
            var _nFallbackSites = [];
            anrReports.forEach(function (r) {
                var _src = r.data && r.data.engineInputs && r.data.engineInputs.turf &&
                    r.data.engineInputs.turf.annualNSource;
                if (_src !== 'settings-turf' && _src !== 'species-default') return;
                var _label = (r.siteLabel || r.data.siteName || 'this site') + ' (' +
                    (_src === 'settings-turf' ? 'Site Settings → Turf' : 'species default') + ')';
                if (_nFallbackSites.indexOf(_label) === -1) _nFallbackSites.push(_label);
            });
            if (_nFallbackSites.length) {
                allChildren.push(new Paragraph({
                    spacing: { after: 120 },
                    children: [new TextRun({
                        text: 'Note — annual nitrogen target source: ' + _nFallbackSites.join('; ') +
                            '. No nutrition programme has been generated on the Plan page for ' +
                            (_nFallbackSites.length > 1 ? 'these sites' : 'this site') +
                            ', so the annual N target every requirement below is scaled against was taken ' +
                            'from the site configuration rather than from a programme. Generate the ' +
                            'programme on the Plan page to base these figures on your own target.',
                        size: 16, italics: true, color: '92400E'
                    })]
                }));
            }

            // b35fix303 Task 1: Detect cotula early so subtitle and table both agree
            // on whether reconciliation rows will render.
            var hasCotula = anrReports.some(function(r) { return r._anr && r._anr.isCotula; });
            var hasStandard = anrReports.some(function(r) { return !r._anr || !r._anr.isCotula; });


            // b35fix303 Task 1: Compute facility-level K delivery from N programme.
            // Fallback used when a specific sample's programme didn't generate.
            //
            // b35fix324a: prefer the per-sample _programmeKDelivered field
            // baked during the b35fix324 hoist (catalogue-only sum, single
            // source of truth). Fall back to legacy raw sum for samples that
            // didn't go through the hoist (defensive — should be all samples
            // post-b35fix324a).
            var _facilityKDelivered = null;
            for (var _kdi = 0; _kdi < anrReports.length; _kdi++) {
                var _ar = anrReports[_kdi];
                if (typeof _ar._programmeKDelivered === 'number' && _ar._programmeKDelivered > 0) {
                    _facilityKDelivered = Math.round(_ar._programmeKDelivered);
                    break;
                }
                var _np = _ar.data && _ar.data.nutritionProgram;
                if (_np && _np.annualSummary && _np.annualSummary.products) {
                    var _kSum = 0;
                    Object.values(_np.annualSummary.products).forEach(function(p) {
                        var n = p.nutrients || p.totalDelivered || {};
                        _kSum += parseFloat(n.K || 0);
                    });
                    if (_kSum > 0) {
                        _facilityKDelivered = Math.round(_kSum);
                        break;
                    }
                }
            }

            // b35fix304 Task 2 Step 5: per-sample K delivery. Falls back to facility
            // value if this sample's programme didn't generate.
            //
            // b35fix324a: prefer r._programmeKDelivered (set by the b35fix324
            // hoist using _computeProgrammeKDelivered — catalogue-only). Falls
            // back to raw sum for samples missing that field.
            function _perSampleKDelivered(r) {
                if (r && typeof r._programmeKDelivered === 'number' && r._programmeKDelivered > 0) {
                    return Math.round(r._programmeKDelivered);
                }
                var np = r && r.data && r.data.nutritionProgram;
                if (!np || !np.annualSummary || !np.annualSummary.products) return null;
                var sum = 0;
                Object.values(np.annualSummary.products).forEach(function(p) {
                    var n = p.nutrients || p.totalDelivered || {};
                    sum += parseFloat(n.K || 0);
                });
                return sum > 0 ? Math.round(sum) : null;
            }
            var _willRenderKReconciliation = (_facilityKDelivered != null) && !hasCotula && hasStandard;
            var _reconSuffix = _willRenderKReconciliation
                ? ' K reconciliation against N programme delivery shown in follow-up table.'
                : '';

            // b35fix331 — Item 1a residual closure (Option B: caption + cell marker).
            //
            // Pre-pass K-recon classification for the ANR table.
            //
            // Background: the engine's K req is removal-rate (under MLSN within
            // floor, under SLAN within range) — what the turf removes through
            // clippings — not "annual application target". On samples where soil
            // K is sufficient, this often produces a non-zero K req with a
            // negative programme balance, which the K Reconciliation row
            // classifier correctly labels 'trend' (soil reserves cover the
            // immediate gap, programme is mining reserves over time, no spot
            // intervention warranted).
            //
            // Pre-b35fix331 the ANR table showed e.g. "K req = 120.0" without
            // any visual cue distinguishing those rows from genuine deficits.
            // Superintendents skimming the table read the figure as "apply 120
            // kg K/ha", which contradicts the K Reconciliation table directly
            // below. Per Spencer review (b35fix330 follow-up): the engine is
            // correct (removal-only intent); the display lacks framing.
            //
            // Fix: classify each sample's K-recon state ONCE here, store on
            // r._b35fix331KReconState, then both the ANR-table renderer below
            // AND the K-recon-table renderer further down read from it. SSOT
            // replaces what was previously a duplicate compute.
            //
            // Marker policy (ANR table): cells with state === 'trend' get a
            // dagger (†) appended to the K req number. State 'no-need' already
            // renders as 0.0 (no marker needed). State 'applied' / 'advisory'
            // are real deficits where the K req IS driving action — no marker.
            //
            // Classifier returns { state, text, color }. We only need .state
            // for the ANR marker; the K-recon table uses the full object.
            var _wxClassifyB35fix331 = (typeof window !== 'undefined' &&
                                        window.GAIP_WordExport &&
                                        window.GAIP_WordExport._classifyKReconState) || null;
            anrReports.forEach(function(r) {
                if (!_willRenderKReconciliation || !_wxClassifyB35fix331) {
                    r._b35fix331KReconState = null;
                    return;
                }
                var anrK = r._anr && r._anr.K;
                var req = anrK && anrK.val != null ? parseFloat(anrK.val) : null;
                var _psK = _perSampleKDelivered(r);
                var kDel = _psK != null ? _psK : _facilityKDelivered;
                var _isZeroReq = (req === 0 || req == null);
                var balance = (_isZeroReq) ? null : (kDel - req);
                var _kReconApplied = !!(r.data && r.data._kReconDecisions
                                      && r.data._kReconDecisions.length > 0);
                var _kReconDecision = _kReconApplied ? r.data._kReconDecisions[0] : null;
                try {
                    r._b35fix331KReconState = _wxClassifyB35fix331({
                        anrK: anrK,
                        kReconApplied: _kReconApplied,
                        kReconDecision: _kReconDecision,
                        kRequired: req,
                        kDelivered: kDel,
                        balance: balance
                    });
                } catch (e) {
                    r._b35fix331KReconState = null;
                }
            });

            // b35fix331 — Caption rewrite (Item 1a residual).
            //
            // Pre-fix MLSN caption: "MLSN removal + deficit correction." — true
            //   but doesn't say "K req is removal-rate, not application target".
            // Pre-fix SLAN caption: "SLAN sufficiency-based requirements
            //   (P pH-adjusted where pH is available)." — accurate methodology
            //   label but again doesn't frame what the K req figure means on
            //   sufficient soils.
            //
            // Post-fix: both captions now explicitly state that K req is the
            // removal-rate (replacement target on sufficient soils, or removal
            // + lift correction on deficit soils), with a cross-reference to
            // the K Reconciliation table for the actual programme decision.
            // Footnote symbol † is wired in when any ANR row is in 'trend'
            // state, with explanation appended to the caption.
            //
            // Citations: SLAN range source is Carrow et al. (2004), GCM 72(1):
            // 194-198 — corrected in b35fix333 from a fabricated "Throssell et
            // al. 2009" citation that did not justify the encoded ranges.
            // Carrow, Waddington & Rieke (2001) is retained as a secondary
            // reference for the sufficiency-as-floor framing. Caption references
            // both honestly.
            var _hasTrendRows = _willRenderKReconciliation && anrReports.some(function(r) {
                return r._b35fix331KReconState && r._b35fix331KReconState.state === 'trend';
            });
            var _trendNote = _hasTrendRows
                ? ' Rows marked † have K req above programme delivery but soil K is in sufficiency range (programme is drawing on soil reserves; see K Reconciliation table for application decision).'
                : '';

            // GH-369 follow-up (independent review): the Tissue K status
            // column + explanation in the K Reconciliation table below only
            // renders when `if (_facilityKDelivered != null)` — but THIS
            // table (the Annual Nutrient Requirements table) always renders,
            // including on the branches GH-362/363/367 deliberately null the
            // programme out on (catalogue-unavailable, distributor-unresolved,
            // climate-unavailable) — exactly the cases most likely to leave a
            // tissue-lowered P/K req with no K Reconciliation table to explain
            // it. Marking ‡ on THIS table's own P/K req cells, unconditionally,
            // closes that gap: the explanation is now reachable wherever the
            // tissue-informed figure itself renders, not only behind the
            // narrower K-Reconciliation-table condition.
            // GH-369 follow-up: routed through the shared
            // _isTissueContradictionRow() SSOT (word-export.js) instead of
            // its own inline critical/intent check, so this table and the
            // K Reconciliation table below apply the identical rule.
            var _wxTissueForAnr = (typeof window !== 'undefined' && window.GAIP_WordExport) || null;
            function _isTissueMarked(nut, r) {
                var anrResult = r._anr && r._anr[nut];
                if (!anrResult || !_wxTissueForAnr || !_wxTissueForAnr._isTissueContradictionRow) return false;
                return _wxTissueForAnr._isTissueContradictionRow(nut, anrResult.tissueInformed, anrResult.intent, r.data);
            }
            var _hasTissueMarkedRows = anrReports.some(function(r) {
                return _isTissueMarked('P', r) || _isTissueMarked('K', r);
            });
            var _tissueMarkNote = _hasTissueMarkedRows
                ? ' Rows marked ‡ show a P or K req figure derived from this sample\'s own measured tissue ' +
                  'ratio; the same tissue reading is independently below sufficiency for that nutrient, a ' +
                  'separate plant-status signal (see Tissue Analysis) — the req figure is a replacement-dose ' +
                  'estimate, not a statement that no action is needed.'
                : '';

            var subtitleText;
            if (methodStr === 'MLSN') {
                subtitleText = 'MLSN methodology (Woods et al. 2016): K/P/S req figures are removal-rate ' +
                               '(replacement target). Below the MLSN floor, req = removal + deficit ' +
                               'correction; at or above the floor, req = removal only, soil reserves ' +
                               'are agronomically sufficient, the figure indicates the rate at which ' +
                               'clippings are removing the nutrient, not a per-year application target.' +
                               _reconSuffix + _trendNote + _tissueMarkNote + ' All rates kg/ha/yr.';
            } else if (methodStr === 'SLAN') {
                subtitleText = 'SLAN sufficiency methodology (Carrow et al. 2004, GCM 72(1):194-198): ' +
                               'K/P/S req figures are removal-rate (replacement target), with P pH-adjusted ' +
                               'where pH is available. Within the sufficiency range, req = removal only ' +
                               '(soil reserves cover the agronomic requirement); below floor, req = removal ' +
                               '+ lift correction over years-to-correct; above ceiling, req = 0. ' +
                               'Sufficiency-as-floor framing per Carrow, Waddington & Rieke (2001).' +
                               _reconSuffix + _trendNote + _tissueMarkNote + ' All rates kg/ha/yr.';
            } else if (methodStr === 'AA') {
                // ────────────────────────────────────────────────────────
                // b35fix441b / C47: AA caption reanchor (combined-export
                // sibling of the b35fix441 / C47 fix in word-export.js
                // line ~10850). Same evidence chain: pre-fix copy claimed
                // MLSN/SLAN thresholds were inapplicable, but Hill Labs
                // sample-type-specific sufficiency thresholds (S277, S81,
                // S78) ARE applied — they drive the Soil Amendment table
                // and the trend-column threshold comparisons elsewhere on
                // the same page. The disclaimer was a parallel emission
                // site that the b35fix441 / C47 fix missed because the
                // downstream-reader audit only grepped word-export.js,
                // not word-export-combined.js. Surfaced by Hagley Combined
                // Report 2026-05-05 production verification post-b35fix441
                // deploy: single-export rendered the new C47 copy
                // correctly, combined-export rendered the old copy.
                // Lesson #32 banked: when fixing a string in word-
                // export.js, grep word-export-combined.js for the same
                // pattern before declaring the fix complete.
                //
                // Scope note: at this point in the combined-export pipeline
                // we are outside the anrReports.forEach loop, so the per-
                // sample data shape is not directly in scope. Pull the
                // aaSampleType from the first AA-methodology report (when
                // multiple AA samples are mixed in one export, they're all
                // S277 or all S81 in practice — Hill Labs samples of
                // different types in the same combined export is an edge
                // case that would emit the first report's code; that's
                // acceptable because the disclaimer is informational and
                // the actual threshold-applied math is per-sample correct).
                // ────────────────────────────────────────────────────────
                var _b35fix441b_aaReport = null;
                for (var _b441bi = 0; _b441bi < anrReports.length; _b441bi++) {
                    var _b441br = anrReports[_b441bi];
                    var _b441brm = _b441br.data && _b441br.data.soil && _b441br.data.soil.methodology;
                    if (_b441brm === 'AMMONIUM_ACETATE' || _b441brm === 'AMMONIUM ACETATE') {
                        _b35fix441b_aaReport = _b441br;
                        break;
                    }
                }
                var _b35fix441b_aaCode = (_b35fix441b_aaReport && _b35fix441b_aaReport.data &&
                                          _b35fix441b_aaReport.data.soil &&
                                          _b35fix441b_aaReport.data.soil.aaSampleType) || 'S277';
                var _b35fix441b_aaLabel = (_b35fix441b_aaReport && _b35fix441b_aaReport.data &&
                                           _b35fix441b_aaReport.data.soil &&
                                           _b35fix441b_aaReport.data.soil.aaSampleTypeLabel) ||
                                          'TURF Ryegrass, Sand (S277)';
                subtitleText = 'Hill Labs ' + _b35fix441b_aaCode + ' sample-type sufficiency thresholds applied (' +
                               _b35fix441b_aaLabel + '). Cation values converted from cert-native ' +
                               'me/100g to ppm for amendment-math comparison; cation deficit-correction ' +
                               'recommendations appear in the Soil Amendment table above. The figures ' +
                               'below are annual removal-replacement estimates (clipping uptake), not ' +
                               'deficit-closure rates.' + _reconSuffix + _trendNote + _tissueMarkNote + ' All rates kg/ha/yr.';
            } else if (methodStr === 'S78') {
                subtitleText = 'Hill Labs S78, Turf Cotula. Sufficiency-based interpretation. MLSN does not apply to cotula.';
            } else {
                subtitleText = 'Requirements based on ' + methodStr + ' methodology.' + _reconSuffix + ' All rates kg/ha/yr.';
            }
            allChildren.push(new Paragraph({
                spacing: { before: 50, after: 160 },
                children: [new TextRun({ text: subtitleText, size: 20, italics: true, color: '6B7280' })]
            }));

            // Styling constants
            var noBorder = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' };
            var noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
            var HEADER_FILL = '1F2937';
            var HEADER_TEXT = 'FFFFFF';

            // b35fix316 helper: build a TableCell with standard styling.
            function _mkCell(text, opts) {
                opts = opts || {};
                var runs = Array.isArray(text)
                    ? text
                    : [new TextRun({
                        text: String(text),
                        bold: !!opts.bold,
                        italics: !!opts.italics,
                        size: opts.size || 17,
                        color: opts.color || '111827'
                    })];
                return new TableCell({
                    borders: noBorders,
                    shading: { fill: opts.fill || 'FFFFFF', type: ShadingType.CLEAR },
                    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
                    children: [new Paragraph({
                        alignment: opts.align || AlignmentType.LEFT,
                        children: runs
                    })]
                });
            }

            // b35fix316 helper: build a header cell (dark fill, white bold text).
            function _mkHdr(text, width) {
                return new TableCell({
                    borders: noBorders,
                    shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
                    width: width ? { size: width, type: WidthType.DXA } : undefined,
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: text, bold: true, size: 20, color: HEADER_TEXT })]
                    })]
                });
            }

            // GH-369: a cell that can hold more than one paragraph — the
            // Tissue K status column needs a short status line plus, when
            // applicable, the independence explanation in the same cell
            // (same row/unit as the K req figure), not a separate note
            // elsewhere in the document. `lines` is an array of
            // {text, bold, italics, size, color}.
            function _mkMultiLineCell(lines, opts) {
                opts = opts || {};
                return new TableCell({
                    borders: noBorders,
                    shading: { fill: opts.fill || 'FFFFFF', type: ShadingType.CLEAR },
                    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
                    children: lines.map(function(line, idx) {
                        return new Paragraph({
                            alignment: opts.align || AlignmentType.LEFT,
                            spacing: idx > 0 ? { before: 40 } : undefined,
                            children: [new TextRun({
                                text: line.text,
                                bold: !!line.bold,
                                italics: !!line.italics,
                                size: line.size || 15,
                                color: line.color || '111827'
                            })]
                        });
                    })
                });
            }

            var tableRows = [];

            if (hasCotula && !hasStandard) {
                // ── All-cotula report: S78 sufficiency table (TRANSPOSED) ────
                //
                // Columns: Sample | pH | Olsen P | K %BS | Ca %BS | Mg %BS |
                //          Na %BS | CEC | TBS | VW | K/Mg | N program
                //
                // Each cell shows the measured value coloured by status
                // (LOW/OK/HIGH per GAIP_CotulaBowling.interpretS78Value).
                var S78_COLS = [
                    { key: 'pH',         label: 'pH',        width: 500 },
                    { key: 'P_olsen',    label: 'Olsen P',   width: 650 },
                    { key: 'K_pct_bs',   label: 'K %BS',     width: 600 },
                    { key: 'Ca_pct_bs',  label: 'Ca %BS',    width: 600 },
                    { key: 'Mg_pct_bs',  label: 'Mg %BS',    width: 600 },
                    { key: 'Na_pct_bs',  label: 'Na %BS',    width: 600 },
                    { key: 'CEC',        label: 'CEC',       width: 550 },
                    { key: 'TBS',        label: 'TBS',       width: 550 },
                    { key: 'VW',         label: 'Vol Wt',    width: 600 },
                    { key: 'K_Mg_ratio', label: 'K/Mg',      width: 550 }
                ];
                var SAMPLE_COL_W_COTULA = 1800;
                var NPROG_COL_W = 700;

                var hdr = [_mkHdr('Sample', SAMPLE_COL_W_COTULA)];
                S78_COLS.forEach(function(col) { hdr.push(_mkHdr(col.label, col.width)); });
                hdr.push(_mkHdr('N prog', NPROG_COL_W));
                tableRows.push(new TableRow({ children: hdr }));

                anrReports.forEach(function(r, ri) {
                    var rowFill = ri % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
                    var soil = r._anr && r._anr.s78 ? r._anr.s78 : (r.data && r.data.soil ? r.data.soil : null);

                    var cells = [_mkCell(r.sampleLabel || r.sampleId, {
                        fill: rowFill, bold: true, size: 20, width: SAMPLE_COL_W_COTULA
                    })];

                    S78_COLS.forEach(function(col) {
                        var raw = soil ? soil[col.key] : null;
                        var interp = null;
                        if (window.GAIP_CotulaBowling && soil) {
                            try { interp = window.GAIP_CotulaBowling.interpretS78Value(col.key, parseFloat(raw)); } catch(e) {}
                        }
                        var color = !interp ? '6B7280'
                                  : interp.status === 'LOW'  ? 'DC2626'
                                  : interp.status === 'HIGH' ? 'F59E0B'
                                  : '16A34A';
                        var displayVal = raw != null
                            ? parseFloat(raw).toFixed(2).replace(/\.?0+$/, '')
                            : '-';
                        cells.push(_mkCell(displayVal, {
                            fill: rowFill, bold: true, size: 20, color: color,
                            align: AlignmentType.CENTER, width: col.width
                        }));
                    });

                    // N programme — empirical range for cotula (not GP-modelled)
                    cells.push(_mkCell('50–120', {
                        fill: rowFill, bold: true, size: 20, color: '1D4ED8',
                        align: AlignmentType.CENTER, width: NPROG_COL_W
                    }));

                    tableRows.push(new TableRow({ children: cells }));
                });

                allChildren.push(new Table({
                    width: { size: 8300, type: WidthType.DXA },
                    columnWidths: [SAMPLE_COL_W_COTULA].concat(S78_COLS.map(function(c) { return c.width; })).concat([NPROG_COL_W]),
                    rows: tableRows
                }));

                // Cotula footnote — ranges reference
                allChildren.push(new Paragraph({
                    spacing: { before: 100, after: 80 },
                    children: [new TextRun({
                        text: 'Target ranges (Hill Labs S78 Turf Cotula): pH 5.8–6.5, Olsen P 20–30 mg/L, K %BS 3.0–6.0, Ca %BS 45–75, Mg %BS 5.0–15.0, Na %BS 0–5.0, CEC 12–25 me/100g, TBS 40–80%, Vol Wt 0.60–1.00 g/mL, K/Mg 0.3–1.0. N programme is empirical (no GP model for cotula). Colour: red=low, amber=high, green=within range.',
                        size: 15, italics: true, color: '6B7280'
                    })]
                }));

            } else {
                // ── Standard MLSN/SLAN/AA table (TRANSPOSED) ─────────────────
                //
                // Columns: Sample | N Total | P ppm | P req | K ppm | K req | S ppm | S req
                //
                // Main table is fixed 8-column width regardless of sample count.
                // K reconciliation (delivered/balance/spot) extracted to a separate
                // follow-up table below — keeps the main table narrow and separates
                // the "what's required" concern from the "how does that compare to
                // your programme" concern.
                var SAMPLE_COL_W = 1800;
                var N_COL_W = 700;
                var PKS_PPM_COL_W = 800;
                var PKS_REQ_COL_W = 900;

                var hdr = [
                    _mkHdr('Sample',        SAMPLE_COL_W),
                    _mkHdr('N kg/ha',       N_COL_W),
                    _mkHdr('P ppm',         PKS_PPM_COL_W),
                    _mkHdr('P req',         PKS_REQ_COL_W),
                    _mkHdr('K ppm',         PKS_PPM_COL_W),
                    _mkHdr('K req',         PKS_REQ_COL_W),
                    _mkHdr('S ppm',         PKS_PPM_COL_W),
                    _mkHdr('S req',         PKS_REQ_COL_W)
                ];
                tableRows.push(new TableRow({ children: hdr }));

                // Colour helper for ANR status. Recognises both MLSN status
                // bands (Very Low / Low / Adequate / High / Excessive) and
                // SLAN status bands (Deficient / Sufficient / Excessive).
                function _anrColor(anrResult) {
                    if (!anrResult) return '6B7280';
                    var s = anrResult.status;
                    // Red — deficit
                    if (s === 'Very Low' || s === 'Low' || s === 'Deficient') return 'DC2626';
                    // Amber — excess
                    if (s === 'Excessive' || s === 'High') return 'F59E0B';
                    // Green — in-range (Adequate under MLSN, Sufficient under SLAN)
                    return '16A34A';
                }

                anrReports.forEach(function(r, ri) {
                    var rowFill = ri % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
                    var ns = r.data.nutritionSummary;
                    var soil = r.data.soil || {};

                    var nVal = ns && ns.totalN ? parseFloat(ns.totalN).toFixed(0) : '-';

                    var cells = [
                        // Sample label — bold, left-aligned
                        _mkCell(r.sampleLabel || r.sampleId, {
                            fill: rowFill, bold: true, size: 20, width: SAMPLE_COL_W
                        }),
                        // N Total — single column, no soil ppm equivalent
                        _mkCell(nVal, {
                            fill: rowFill, bold: true, size: 17, align: AlignmentType.CENTER,
                            width: N_COL_W
                        })
                    ];

                    // P / K / S — each gets a (ppm, req) pair
                    ['P', 'K', 'S'].forEach(function(nut) {
                        var anrResult = r._anr && r._anr[nut];
                        var ppmVal = soil[nut] != null ? soil[nut].toFixed(0) : '-';
                        var reqVal = anrResult && anrResult.val != null
                            ? parseFloat(anrResult.val).toFixed(1)
                            : '-';

                        // b35fix331: append † on K req cells where the K-recon
                        // classifier returned 'trend' state (programme short of
                        // removal but soil K sufficient — caption explains).
                        // Only K column gets the marker; P/S have analogous
                        // sufficiency-vs-deficit logic but Item 1a closure is
                        // scoped to K. P/S marker treatment is a candidate
                        // follow-up if superintendents request it.
                        if (nut === 'K' && r._b35fix331KReconState
                                        && r._b35fix331KReconState.state === 'trend'
                                        && reqVal !== '-') {
                            reqVal = reqVal + ' †';
                        }

                        // GH-369 follow-up: ‡ on a P or K req cell derived
                        // from this sample's own tissue ratio while the same
                        // tissue reading is independently below sufficiency —
                        // see _tissueMarkNote above (unconditional on this
                        // always-rendered table, unlike the K Reconciliation
                        // table's own explanation).
                        if ((nut === 'P' || nut === 'K') && _isTissueMarked(nut, r) && reqVal !== '-') {
                            reqVal = reqVal + ' ‡';
                        }

                        var statusColor = _anrColor(anrResult);

                        cells.push(_mkCell(ppmVal, {
                            fill: rowFill, size: 15, color: statusColor, italics: true,
                            align: AlignmentType.CENTER, width: PKS_PPM_COL_W
                        }));
                        cells.push(_mkCell(reqVal, {
                            fill: rowFill, bold: true, size: 17, color: statusColor,
                            align: AlignmentType.CENTER, width: PKS_REQ_COL_W
                        }));
                    });

                    tableRows.push(new TableRow({ children: cells }));
                });

                allChildren.push(new Table({
                    width: { size: 7600, type: WidthType.DXA },
                    columnWidths: [SAMPLE_COL_W, N_COL_W, PKS_PPM_COL_W, PKS_REQ_COL_W, PKS_PPM_COL_W, PKS_REQ_COL_W, PKS_PPM_COL_W, PKS_REQ_COL_W],
                    rows: tableRows
                }));

                // b35fix316: K reconciliation — separate follow-up table.
                // Only renders when a facility N programme exists (standard path).
                // Previously these were inline rows in the main ANR table; extracting
                // them keeps the main table narrow and makes the reconciliation
                // semantics explicit: "here's what your N programme delivers in K,
                // and here's how that compares to each sample's K requirement."
                if (_facilityKDelivered != null) {
                    allChildren.push(new Paragraph({
                        spacing: { before: 240, after: 60 },
                        children: [new TextRun({
                            text: 'K Reconciliation, Programme Delivery vs Requirement',
                            bold: true, size: 20, color: '111827'
                        })]
                    }));
                    // b35fix325: methodology citation in caption.
                    // Pull from the first sample's _anr.K.methodology+citation
                    // (all samples share the same methodology in a given run).
                    var _capMethod = null, _capCitation = null;
                    for (var _ci = 0; _ci < anrReports.length; _ci++) {
                        var _capK = anrReports[_ci]._anr && anrReports[_ci]._anr.K;
                        if (_capK && _capK.methodology) {
                            _capMethod = _capK.methodology;
                            _capCitation = _capK.citation;
                            break;
                        }
                    }
                    var _captionText;
                    if (_capMethod && /SLAN-Carrow|carrow.*2004|SLAN-Throssell|throssell/i.test(_capMethod)) {
                        // b35fix333: source corrected from fabricated Throssell to
                        // Carrow et al. (2004). Regex retains Throssell match so
                        // any cached/stored old methodology strings still trigger
                        // this branch (caption itself reads Carrow 2004 either way).
                        // K range also updated 75-150 → 75-176 per Carrow 2004
                        // "other soils" / high-CEC values (Option 1).
                        _captionText = 'SLAN sufficiency range (Carrow et al. 2004, GCM 72(1):194-198): ' +
                                       'K 75–176 ppm. Below floor → removal + lift correction; within ' +
                                       'range → removal only; above ceiling → zero application. ' +
                                       'Balance = programme K (catalogue products only) − engine K req. ' +
                                       'Source: ' + (_capCitation || 'Carrow et al. (2004). GCM 72(1):194-198.') + '.';
                    } else if (_capMethod && /MLSN/i.test(_capMethod)) {
                        // GH-384 (decision D-6): the lift target is the MLSN
                        // minimum itself, not 1.5 x it. This caption still said
                        // "lift toward target × 1.5" after the arithmetic
                        // changed, which would have described the export's
                        // printed figure incorrectly to the client.
                        _captionText = 'MLSN methodology (Woods et al. 2016): K req = removal + ' +
                                       'deficit correction (lift to the 37 ppm minimum over 2 years) ' +
                                       'when soil K is below it; within the range → removal only; ' +
                                       'at or above the ceiling (minimum × 1.5) → zero application. ' +
                                       'Balance = programme K (catalogue products only) − engine K req.';
                    } else {
                        _captionText = 'K delivered by the facility-level N programme compared to ' +
                                       'each sample\'s K requirement. Negative balance suggests ' +
                                       'per-sample spot K supplement needed.';
                    }
                    allChildren.push(new Paragraph({
                        spacing: { after: 120 },
                        children: [new TextRun({
                            text: _captionText,
                            size: 15, italics: true, color: '6B7280'
                        })]
                    }));

                    // GH-369: added the "Tissue K status" column and narrowed
                    // the existing five to keep the table under the page's
                    // usable width (9746 DXA, per GH-255) — see that entry's
                    // own note on the same page-width constant.
                    var reconRows = [new TableRow({ children: [
                        _mkHdr('Sample',           1800),
                        _mkHdr('K req',            1000),
                        _mkHdr('K delivered',      1200),
                        _mkHdr('K balance',        1200),
                        _mkHdr('Spot K?',          2200),
                        _mkHdr('Tissue K status',  2200)
                    ]})];
                    // GH-369 follow-up: only print the explanatory caption
                    // below the table when at least one row actually has
                    // tissue data — otherwise a fully tissue-free export
                    // prints a caption pointing at a "tissue analysis
                    // section" that doesn't exist on that report.
                    var _anyTissueDataInReconTable = false;

                    anrReports.forEach(function(r, ri) {
                        var rowFill = ri % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
                        var anrK = r._anr && r._anr.K;
                        var req = anrK && anrK.val != null ? parseFloat(anrK.val) : null;
                        var _psK = _perSampleKDelivered(r);
                        var kDel = _psK != null ? _psK : _facilityKDelivered;

                        // b35fix325: intent-aware balance display.
                        // When K req = 0 (intent='suppress-above-ceiling') the
                        // balance arithmetic is meaningless — the engine has
                        // declared NO requirement, so "+82" type values were
                        // the cosmetic bug surfaced in production. Display "—"
                        // for K req=0 and Spot K?='No' (there's nothing to
                        // reconcile).
                        var intent = anrK && anrK.intent;
                        var _isZeroReq = (req === 0 || req == null);
                        var balance = (_isZeroReq) ? null : (kDel - req);

                        var balText = balance == null ? '-'
                                    : (balance >= 0 ? '+' : '') + balance.toFixed(1);
                        var balColor = balance == null ? '6B7280'
                                     : balance > 20 ? '16A34A'
                                     : balance >= -10 ? '6B7280'
                                     : 'DC2626';

                        // b35fix326a: classify Spot K? cell state via SSOT
                        // classifier in word-export.js. Distinguishes 'trend'
                        // (sufficient soil + programme mining reserves, amber)
                        // from 'advisory' (deficient soil + spot-K not fired,
                        // red) which the pre-b35fix326a inline state machine
                        // collapsed into a single "Advisory" red state.
                        //
                        // b35fix331: read from r._b35fix331KReconState (set by
                        // the pre-pass loop above). The pre-pass already called
                        // the classifier once with the same inputs; reusing its
                        // result here eliminates an asymmetric-engines pattern
                        // (two compute sites for the same conceptual quantity).
                        // If the pre-pass produced no result (defensive null),
                        // fall back to a fresh classification.
                        var _state = r._b35fix331KReconState;
                        if (!_state) {
                            var _kReconApplied = !!(r.data && r.data._kReconDecisions
                                                  && r.data._kReconDecisions.length > 0);
                            var _kReconDecision = _kReconApplied ? r.data._kReconDecisions[0] : null;
                            var _wxClassifyFallback = (typeof window !== 'undefined' &&
                                                       window.GAIP_WordExport &&
                                                       window.GAIP_WordExport._classifyKReconState) || null;
                            if (_wxClassifyFallback) {
                                try {
                                    _state = _wxClassifyFallback({
                                        anrK: anrK,
                                        kReconApplied: _kReconApplied,
                                        kReconDecision: _kReconDecision,
                                        kRequired: req,
                                        kDelivered: kDel,
                                        balance: balance
                                    });
                                } catch (e) {
                                    _state = { state: 'unknown', text: '-', color: '6B7280' };
                                }
                            } else {
                                _state = { state: 'unknown', text: '-', color: '6B7280' };
                            }
                        }
                        var rec      = _state.text;
                        var recColor = _state.color;

                        // GH-369: tissue plant-status check for this row's K,
                        // shared with the single-export ANR section and
                        // Priority Actions (see word-export.js
                        // _tissueSufficiencyState()'s own comment for why this
                        // is deliberately a different question from the
                        // tissue-RATIO gate that may have shaped `req` above).
                        var _wxTissue = (typeof window !== 'undefined' && window.GAIP_WordExport) || null;
                        var _kTissueState = (_wxTissue && _wxTissue._tissueSufficiencyState)
                            ? _wxTissue._tissueSufficiencyState('K', r.data) : null;
                        var _tissueLines;
                        if (!_kTissueState) {
                            _tissueLines = [{ text: '-', color: '9CA3AF' }];
                        } else if (_kTissueState.critical) {
                            _anyTissueDataInReconTable = true;
                            _tissueLines = [
                                { text: 'Critically low (' + _kTissueState.value + '%)', bold: true, color: 'DC2626' }
                            ];
                            // Only spell out the independence explanation when
                            // this row's K req figure is ITSELF tissue-ratio
                            // derived — that's the specific juxtaposition this
                            // fix exists for (a lowered, tissue-informed dose
                            // sitting next to a critical plant-status flag,
                            // with nothing explaining the two are not the same
                            // measurement). When req is generic-ratio-derived,
                            // the critical flag still matters but isn't sitting
                            // next to a number it could be misread against.
                            //
                            // GH-369 follow-up: routed through the shared
                            // _isTissueContradictionRow() SSOT (word-export.js)
                            // so this row and the ANR table's own ‡ marker
                            // apply the identical rule -- tissueInformed alone
                            // is not enough, since it describes the REMOVAL
                            // component, not the printed req: the AA
                            // suppress-above-ceiling branch forces req to 0
                            // while still reporting tissueInformed=true
                            // (removal was tissue-derived, the printed 0 was
                            // not, it came from the soil ceiling). Without
                            // this guard the sentence would claim the
                            // ceiling-suppressed 0.0 is itself tissue-derived,
                            // which is false.
                            if (anrK && _wxTissue && _wxTissue._isTissueContradictionRow &&
                                _wxTissue._isTissueContradictionRow('K', anrK.tissueInformed, anrK.intent, r.data)) {
                                _tissueLines.push({
                                    text: 'K req (left) is this sample\'s measured K/N ratio, a ' +
                                        'replacement-dose estimate — not a statement that no action ' +
                                        'is needed. Apply foliar potassium immediately.',
                                    italics: true, size: 13, color: 'DC2626'
                                });
                            } else {
                                _tissueLines.push({
                                    text: 'Apply foliar potassium immediately.',
                                    italics: true, size: 13, color: 'DC2626'
                                });
                            }
                        } else if (_kTissueState.low) {
                            _anyTissueDataInReconTable = true;
                            _tissueLines = [{ text: 'Below sufficiency (' + _kTissueState.value + '%)', color: 'D97706' }];
                        } else {
                            _anyTissueDataInReconTable = true;
                            _tissueLines = [{ text: 'Adequate (' + _kTissueState.value + '%)', color: '6B7280' }];
                        }

                        reconRows.push(new TableRow({ children: [
                            _mkCell(r.sampleLabel || r.sampleId, {
                                fill: rowFill, bold: true, size: 20, width: 1800
                            }),
                            _mkCell(req != null ? req.toFixed(1) : '-', {
                                fill: rowFill, size: 20, align: AlignmentType.CENTER, width: 1000
                            }),
                            _mkCell(String(kDel), {
                                fill: rowFill, size: 20, color: '6B7280', italics: true,
                                align: AlignmentType.CENTER, width: 1200
                            }),
                            _mkCell(balText, {
                                fill: rowFill, bold: true, size: 17, color: balColor,
                                align: AlignmentType.CENTER, width: 1200
                            }),
                            _mkCell(rec, {
                                fill: rowFill, size: 15, color: recColor, italics: true,
                                align: AlignmentType.CENTER, width: 2200
                            }),
                            _mkMultiLineCell(_tissueLines, { fill: rowFill, width: 2200 })
                        ]}));
                    });

                    allChildren.push(new Table({ width: { size: 9600, type: WidthType.DXA }, columnWidths: [1800, 1000, 1200, 1200, 2200, 2200], rows: reconRows }));
                    // GH-369 follow-up: only when at least one row actually
                    // had tissue data (_anyTissueDataInReconTable) — a fully
                    // tissue-free export would otherwise print a caption
                    // pointing at a tissue analysis section that isn't in
                    // this report and a column of nothing but "-".
                    if (_anyTissueDataInReconTable) {
                        allChildren.push(new Paragraph({
                            spacing: { before: 60, after: 100 },
                            children: [new TextRun({
                                text: 'Tissue K status is a separate, independently-measured plant-status ' +
                                    'signal (published sufficiency range) from K req’s removal/replacement ' +
                                    'estimate — the two are not reconciled into one number because a low ' +
                                    'tissue reading with sufficient soil K usually indicates an uptake ' +
                                    'restriction (e.g. cation antagonism), which more soil-applied K does not ' +
                                    'correct. See the tissue analysis section for the full reading.',
                                size: 15, italics: true, color: '6B7280'
                            })]
                        }));
                    }
                }
            } // end if hasCotula / else standard

            // b35fix303 Task 1: Footnote when no facility N programme exists,
            // explaining why the K reconciliation table is absent.
            if (_facilityKDelivered == null && hasStandard && !hasCotula) {
                allChildren.push(new Paragraph({
                    spacing: { before: 120, after: 100 },
                    children: [new TextRun({
                        text: 'Note: K reconciliation omitted, no fertiliser programme found for this site. Add an N programme to enable per-sample K balance reporting.',
                        size: 17, italics: true, color: '9CA3AF'
                    })]
                }));
            }

            // b35fix307 Q4: Monthly N distribution.
            // Previously rendered as one-row-per-sample. Every row was identical
            // by construction — monthly N is derived from (annual N target,
            // monthly GP, distribution strategy), all of which are site-level
            // in the current data model. Soil chemistry varies sample-by-sample
            // but doesn't feed N distribution. Collapsed to a single-line
            // caption per site to remove the redundant table noise.
            //
            // b35fix387: routed through _buildMonthlyNDistribution helper on
            // GAIP_WordExport (shared with single-export). Pre-fix combined
            // rendered three plain prose paragraphs; the single-export already
            // had a proper colour-graded table. Same data shape on
            // r.data.nutritionSummary.{monthlyN, totalN, activeMonths} via
            // the b35fix313 collectData path. Combined-export passes
            // siteUniformCaption:true so the helper appends the caption
            // explaining why every sample on the site shows the same
            // distribution.
            //
            // GH-247: the above was still true, but the code that picked
            // "the" sample to render never re-scoped per site — it scanned
            // the whole facility's anrReports (every site's samples mixed
            // together) for the first one with monthlyN data and rendered
            // just that one table, so a 2+ site combined export silently
            // showed only one site's Monthly N Distribution. Grouped by
            // siteLabel first (same pattern as the Fertiliser Purchasing
            // Summary rollup below) so every site gets its own table — each
            // site's annual N target/distribution strategy/climate can
            // genuinely differ from the next.
            if (we && typeof we._buildMonthlyNDistribution === 'function') {
                var _mnDocxRefs = {
                    Paragraph: Paragraph, TextRun: TextRun, Table: Table,
                    TableRow: TableRow, TableCell: TableCell,
                    WidthType: WidthType, AlignmentType: AlignmentType
                };
                var _mnSiteGroups = {};
                var _mnSiteOrder = [];
                anrReports.forEach(function(r) {
                    var label = r.siteLabel || 'Unknown Site';
                    if (!_mnSiteGroups[label]) {
                        _mnSiteGroups[label] = [];
                        _mnSiteOrder.push(label);
                    }
                    _mnSiteGroups[label].push(r);
                });

                _mnSiteOrder.forEach(function(siteLabel) {
                    var siteReports = _mnSiteGroups[siteLabel];
                    var siteNutritionSummary = null;
                    for (var _mi = 0; _mi < siteReports.length; _mi++) {
                        var _ns = siteReports[_mi].data && siteReports[_mi].data.nutritionSummary;
                        if (_ns && _ns.monthlyN && _ns.monthlyN.length > 0) {
                            siteNutritionSummary = _ns;
                            break;
                        }
                    }
                    if (!siteNutritionSummary) return;

                    // Only label which site each table belongs to when there's
                    // more than one — keeps a single-site combined export
                    // visually identical to before this fix.
                    if (_mnSiteOrder.length > 1) {
                        allChildren.push(new Paragraph({
                            spacing: { before: 160, after: 40 },
                            children: [new TextRun({ text: siteLabel, bold: true, size: 22, color: '374151' })]
                        }));
                    }

                    var _mnNodes = we._buildMonthlyNDistribution(
                        siteNutritionSummary.monthlyN,
                        siteNutritionSummary.totalN,
                        siteNutritionSummary.activeMonths,
                        _mnDocxRefs,
                        {
                            siteUniformCaption: true,
                            climateDataUnavailable: siteNutritionSummary.climateDataUnavailable,
                            climateDataUnavailableReason: siteNutritionSummary.climateDataUnavailableReason,
                            climateNormalsSource: siteNutritionSummary.climateNormalsSource
                        }
                    );
                    _mnNodes.forEach(function(node) { allChildren.push(node); });
                });
            }
            allChildren.push(new Paragraph({ children: [] }));
        }

        // ────────────────────────────────────────────────────────────────────
        // b35fix303 Task 3: Per-site fertiliser purchasing rollup
        // For each site, aggregate per-sample fert programmes into total product
        // requirements. Useful for procurement: golf clubs ordering one truckload
        // per year; council parks managers ordering per-region.
        //
        // Aggregation logic:
        //   - Iterate site groups
        //   - For each site, walk its samples and sum products by name
        //   - If sample area is available, multiply per-ha rate × area for absolute kg
        //   - Otherwise show per-ha rate only with a footnote
        //   - Skip silently if no programme exists for any sample at the site
        // ────────────────────────────────────────────────────────────────────
        if (anrReports.length > 0 && !hasCotula) {
            // Group anrReports by siteLabel for rollup processing
            var sitesForRollup = {};
            anrReports.forEach(function(r) {
                var label = r.siteLabel || 'Unknown Site';
                if (!sitesForRollup[label]) sitesForRollup[label] = [];
                sitesForRollup[label].push(r);
            });

            var siteLabels = Object.keys(sitesForRollup);
            siteLabels.forEach(function(siteLabel) {
                var siteReports = sitesForRollup[siteLabel];

                // b35fix311: partition samples by freshness BEFORE aggregating.
                // Stale samples never feed procurement math — you cannot buy
                // product against soil chemistry from 2+ years ago. The
                // per-site opt-out (`allowStaleRecommendations: true`) bypasses
                // this check but stamps a warning banner on the output.
                var siteId = siteReports[0] && siteReports[0].siteId;
                var sm = global.GAIP_SampleManager;
                var siteOptOut = false;
                try {
                    if (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.getConfig === 'function') {
                        var scfg = global.GAIP_SiteConfig.getConfig(siteId);
                        siteOptOut = !!(scfg && scfg.allowStaleRecommendations);
                    }
                } catch (_e) { /* config unavailable; stay with default (no opt-out) */ }

                var freshReports = [];
                var staleReports = [];
                siteReports.forEach(function(r) {
                    // Look up the stored sample for freshness. r.data.site/turf doesn't
                    // carry the full sample record, so we pull it from the store.
                    var storedSample = null;
                    try {
                        if (sm && typeof sm.getAllSamples === 'function') {
                            var all = sm.getAllSamples();
                            storedSample = all && all.allSites && all.allSites[r.siteId] &&
                                           all.allSites[r.siteId].soil &&
                                           all.allSites[r.siteId].soil[r.sampleId];
                        }
                    } catch (_e) { /* fall through — treat as missing */ }

                    // With opt-out on, everything is treated as fresh for
                    // procurement purposes. Otherwise gate by canDriveRecommendations.
                    var fresh = siteOptOut ||
                                (sm && typeof sm.canDriveRecommendations === 'function' &&
                                 sm.canDriveRecommendations(storedSample, r.siteId));

                    if (fresh) {
                        freshReports.push(r);
                    } else {
                        staleReports.push({ report: r, sample: storedSample });
                    }
                });

                // Aggregate products across FRESH samples only
                // b35fix328: aggregate now carries full macro vector
                // (N/P/K/S/Ca/Mg). Pre-fix only N/P/K/S were summed and the
                // table only rendered N/K — Ca and Mg from amendments
                // (dolomite, gypsum) were invisible. Per-entry extraction
                // routes through window.GAIP_WordExport._extractEntryNutrients
                // so catalogue products derive Ca/Mg/S from analysis × mass
                // (their nutrients map only carries N/P/K) while amendments
                // use their populated totalDelivered vector.
                var aggregate = {};   // { productName: { kgHaSum, samplesContributing, N, P, K, S, Ca, Mg, kgAbsSum } }
                var totalAreaHa = 0;
                var anyAreaSeen = false;
                var anyProgrammeSeen = false;
                var samplesMissingArea = [];

                var _wxExtract = (global.GAIP_WordExport && typeof global.GAIP_WordExport._extractEntryNutrients === 'function')
                    ? global.GAIP_WordExport._extractEntryNutrients
                    : null;

                freshReports.forEach(function(r) {
                    var sampleArea = null;
                    if (r.data.site && r.data.site.areaHa != null) sampleArea = parseFloat(r.data.site.areaHa);
                    else if (r.data.turf && r.data.turf.areaHa != null) sampleArea = parseFloat(r.data.turf.areaHa);
                    if (sampleArea != null && !isNaN(sampleArea) && sampleArea > 0) {
                        totalAreaHa += sampleArea;
                        anyAreaSeen = true;
                    } else {
                        samplesMissingArea.push(r.sampleLabel || r.sampleId);
                    }

                    var prog = r.data.nutritionProgram;
                    if (!prog || !prog.annualSummary || !prog.annualSummary.products) return;
                    anyProgrammeSeen = true;

                    Object.values(prog.annualSummary.products).forEach(function(p) {
                        var name = p.name || (p.product && p.product.name) || 'Unknown product';
                        var kgHa = parseFloat(p.totalKg || p.totalKgHa || p.totalLHa || 0);
                        // b35fix328: use exposed helper for full macro vector.
                        // Fallback path (older catalogue entries with only
                        // nutrients map) preserves N/P/K/S only — Ca and Mg
                        // stay zero, which is the pre-b35fix328 behaviour for
                        // those entries.
                        var vec;
                        if (_wxExtract) {
                            vec = _wxExtract(p);
                        } else {
                            var n = p.nutrients || p.totalDelivered || {};
                            vec = {
                                N: parseFloat(n.N || 0) || 0,
                                P: parseFloat(n.P || 0) || 0,
                                K: parseFloat(n.K || 0) || 0,
                                S: parseFloat(n.S || 0) || 0,
                                Ca: parseFloat(n.Ca || 0) || 0,
                                Mg: parseFloat(n.Mg || 0) || 0
                            };
                        }
                        if (!aggregate[name]) {
                            aggregate[name] = {
                                kgHaSum: 0, samplesContributing: 0,
                                N: 0, P: 0, K: 0, S: 0, Ca: 0, Mg: 0,
                                kgAbsSum: 0
                            };
                        }
                        aggregate[name].kgHaSum += kgHa;
                        aggregate[name].samplesContributing++;
                        aggregate[name].N += vec.N;
                        aggregate[name].P += vec.P;
                        aggregate[name].K += vec.K;
                        aggregate[name].S += vec.S;
                        aggregate[name].Ca += vec.Ca;
                        aggregate[name].Mg += vec.Mg;
                        if (sampleArea != null && !isNaN(sampleArea) && sampleArea > 0) {
                            aggregate[name].kgAbsSum += kgHa * sampleArea;
                        }
                    });
                });

                // b35fix311: zero-fresh-zones case — suppress the summary and
                // emit a re-sample prompt. Procurement on stale data alone is
                // worse than no procurement guidance at all.
                if (freshReports.length === 0) {
                    allChildren.push(new Paragraph({ children: [new PageBreak()] }));
                    allChildren.push(new Paragraph({
                        heading: HeadingLevel.HEADING_1, keepNext: true,
                        children: [new TextRun(siteLabel + ', Fertiliser Purchasing Summary')]
                    }));
                    allChildren.push(new Paragraph({
                        spacing: { before: 120, after: 120 },
                        children: [new TextRun({
                            text: 'Procurement planning suppressed, no current soil data.',
                            bold: true, size: 22, color: 'C96A5F'
                        })]
                    }));
                    allChildren.push(new Paragraph({
                        spacing: { after: 160 },
                        children: [new TextRun({
                            text: 'All ' + siteReports.length + ' soil samples for this site exceed the ' +
                                  (sm && sm.STALENESS_CONFIG ? sm.STALENESS_CONFIG.thresholdMonths : 18) +
                                  '-month freshness threshold. ' +
                                  'Fertiliser purchasing recommendations require recent soil chemistry. ' +
                                  'Re-sample and re-run this report to enable purchasing guidance.',
                            size: 20, italics: true, color: '374151'
                        })]
                    }));
                    return;  // next site
                }

                if (!anyProgrammeSeen) return;   // no programmes — skip this site silently

                var aggregateNames = Object.keys(aggregate);
                if (aggregateNames.length === 0) return;

                // Render section
                allChildren.push(new Paragraph({ children: [new PageBreak()] }));
                allChildren.push(new Paragraph({
                    heading: HeadingLevel.HEADING_1, keepNext: true,
                    children: [new TextRun(siteLabel + ', Fertiliser Purchasing Summary')]
                }));

                // b35fix311: opt-out warning banner — stale data being used
                // because the site explicitly allowed it. Makes the risk visible
                // in the procurement document itself.
                if (siteOptOut && staleReports.length > 0) {
                    allChildren.push(new Paragraph({
                        spacing: { before: 60, after: 100 },
                        children: [new TextRun({
                            text: 'PROCUREMENT WARNING: Quantities below include soil data older than the ' +
                                  (sm && sm.STALENESS_CONFIG ? sm.STALENESS_CONFIG.thresholdMonths : 18) +
                                  '-month freshness threshold. ' +
                                  'This site is configured to allow stale-data recommendations ' +
                                  '(allowStaleRecommendations: true). Re-sample before making ' +
                                  'purchasing commitments.',
                            bold: true, size: 20, color: 'C96A5F'
                        })]
                    }));
                }

                var subText;
                if (anyAreaSeen && totalAreaHa > 0) {
                    subText = 'Aggregate across ' + freshReports.length + ' fresh sample' +
                              (freshReports.length === 1 ? '' : 's') + ', ' +
                              totalAreaHa.toFixed(2) + ' ha total. ' +
                              'Absolute kg = per-ha rate × area summed across samples. ' +
                              'Use for purchase planning.';
                } else {
                    subText = 'Aggregate across ' + freshReports.length + ' fresh sample' +
                              (freshReports.length === 1 ? '' : 's') + '. ' +
                              'Per-ha rates only, area data not entered on any sample. ' +
                              'Enter sample area (ha) to enable absolute kg totals for procurement.';
                }
                allChildren.push(new Paragraph({
                    spacing: { before: 50, after: 160 },
                    children: [new TextRun({ text: subText, size: 20, italics: true, color: '6B7280' })]
                }));

                // Build table
                var rNoBorder = { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' };
                var rBorders = { top: rNoBorder, bottom: rNoBorder, left: rNoBorder, right: rNoBorder };

                // b35fix328: detect which optional macro columns to render
                // (P, Ca, Mg, S). N and K always render in the area-aware
                // branch (existing contract). Detection uses absolute kg
                // totals (agg.* are already kg, summed across samples) so
                // sub-detection trace nutrients on a single product won't
                // light up a column. Threshold floor 0.5 kg absolute — at
                // typical procurement scales (multi-ha sites) this filters
                // analysis-line trace elements but lets real Ca/Mg from
                // dolomite (~210 kg Ca, ~115 kg Mg per ha) through.
                var aggNames = Object.keys(aggregate);
                var _wxDetect = (global.GAIP_WordExport && typeof global.GAIP_WordExport._detectActiveNutrientColumns === 'function')
                    ? global.GAIP_WordExport._detectActiveNutrientColumns
                    : null;

                var includeP = false, includeCa = false, includeMg = false, includeS = false;
                if (anyAreaSeen) {
                    var _absThreshold = 0.5;  // kg, absolute (post-area scaling)
                    aggNames.forEach(function(nm) {
                        var a = aggregate[nm];
                        if ((a.P || 0) > _absThreshold) includeP = true;
                        if ((a.Ca || 0) > _absThreshold) includeCa = true;
                        if ((a.Mg || 0) > _absThreshold) includeMg = true;
                        if ((a.S || 0) > _absThreshold) includeS = true;
                    });
                }

                var rollupCols, hdrLabels;
                if (anyAreaSeen) {
                    // Base: Product, Total kg, Total kg/ha avg, N kg, K kg
                    // Nutrient columns sized at 1100 DXA each when many are
                    // active, 1700 when none — keeps total row width
                    // bounded for A4 portrait. Approx widths:
                    //   3200 + 1500 + 1600 + (5 × 1100) = 11800 DXA (≈ 8.2")
                    //   3200 + 1600 + 1700 + (2 × 1700) = 11800 DXA (≈ 8.2")
                    var optCount = (includeP ? 1 : 0) + (includeCa ? 1 : 0) + (includeMg ? 1 : 0) + (includeS ? 1 : 0);
                    var nutColWidth = optCount === 0 ? 1700 : 1100;
                    var prodColWidth = optCount === 0 ? 3200 : 3000;
                    var totalKgColWidth = optCount === 0 ? 1600 : 1400;
                    var avgKgHaColWidth = optCount === 0 ? 1700 : 1400;

                    rollupCols = [prodColWidth, totalKgColWidth, avgKgHaColWidth];
                    hdrLabels = ['Product', 'Total kg', 'Total kg/ha avg'];
                    // N always
                    rollupCols.push(nutColWidth);
                    hdrLabels.push('N kg');
                    if (includeP) { rollupCols.push(nutColWidth); hdrLabels.push('P kg'); }
                    // K always
                    rollupCols.push(nutColWidth);
                    hdrLabels.push('K kg');
                    if (includeCa) { rollupCols.push(nutColWidth); hdrLabels.push('Ca kg'); }
                    if (includeMg) { rollupCols.push(nutColWidth); hdrLabels.push('Mg kg'); }
                    if (includeS) { rollupCols.push(nutColWidth); hdrLabels.push('S kg'); }
                } else {
                    rollupCols = [4200, 2400, 2400];          // Product, Total kg/ha, Apps
                    hdrLabels = ['Product', 'Total kg/ha', 'Samples'];
                }

                var hdrCellsRollup = hdrLabels.map(function(label, idx) {
                    return new TableCell({
                        borders: rBorders,
                        shading: { fill: '1F2937', type: ShadingType.CLEAR },
                        width: { size: rollupCols[idx], type: WidthType.DXA },
                        children: [new Paragraph({
                            alignment: idx === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                            children: [new TextRun({ text: label, bold: true, size: 22, color: 'FFFFFF' })]
                        })]
                    });
                });
                var rollupRows = [new TableRow({ children: hdrCellsRollup })];

                aggNames.forEach(function(name, ri) {
                    var agg = aggregate[name];
                    var rowFill = ri % 2 === 0 ? 'FFFFFF' : 'F9FAFB';
                    var cells;
                    if (anyAreaSeen) {
                        var avgKgHa = agg.samplesContributing > 0 ? agg.kgHaSum / agg.samplesContributing : 0;
                        cells = [
                            new TableCell({
                                borders: rBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                                width: { size: rollupCols[0], type: WidthType.DXA },
                                children: [new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 22 })] })]
                            }),
                            new TableCell({
                                borders: rBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                                width: { size: rollupCols[1], type: WidthType.DXA },
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(agg.kgAbsSum).toString(), bold: true, size: 22, color: '1F2937' })] })]
                            }),
                            new TableCell({
                                borders: rBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                                width: { size: rollupCols[2], type: WidthType.DXA },
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: avgKgHa.toFixed(0), size: 22, color: '6B7280' })] })]
                            })
                        ];

                        // Walk the same column order used for the header so
                        // hdrLabels[i] matches the i'th cell value. colIdx
                        // tracks position in rollupCols for width lookups.
                        var colIdx = 3;
                        function pushNutCell(value) {
                            cells.push(new TableCell({
                                borders: rBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                                width: { size: rollupCols[colIdx], type: WidthType.DXA },
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: Math.round(value || 0).toString(), size: 22, color: '6B7280' })] })]
                            }));
                            colIdx++;
                        }
                        pushNutCell(agg.N);
                        if (includeP) pushNutCell(agg.P);
                        pushNutCell(agg.K);
                        if (includeCa) pushNutCell(agg.Ca);
                        if (includeMg) pushNutCell(agg.Mg);
                        if (includeS) pushNutCell(agg.S);
                    } else {
                        var avgPerHa = agg.samplesContributing > 0 ? agg.kgHaSum / agg.samplesContributing : 0;
                        cells = [
                            new TableCell({
                                borders: rBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                                width: { size: rollupCols[0], type: WidthType.DXA },
                                children: [new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 22 })] })]
                            }),
                            new TableCell({
                                borders: rBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                                width: { size: rollupCols[1], type: WidthType.DXA },
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: avgPerHa.toFixed(0), bold: true, size: 22, color: '1F2937' })] })]
                            }),
                            new TableCell({
                                borders: rBorders, shading: { fill: rowFill, type: ShadingType.CLEAR },
                                width: { size: rollupCols[2], type: WidthType.DXA },
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: agg.samplesContributing + '/' + siteReports.length, size: 22, color: '6B7280' })] })]
                            })
                        ];
                    }
                    rollupRows.push(new TableRow({ children: cells }));
                });

                allChildren.push(new Table({ width: { size: rollupCols.reduce(function(a,b){return a+b;},0), type: WidthType.DXA }, columnWidths: rollupCols, rows: rollupRows }));
                allChildren.push(new Paragraph({ children: [] }));

                // b35fix311: exclusion footnotes — list zones dropped from
                // procurement math so the superintendent knows what's missing
                // from the totals and why.
                if (staleReports.length > 0 && !siteOptOut) {
                    var excludedLabels = staleReports.map(function(sr) {
                        var lbl = (sr.report && (sr.report.sampleLabel || sr.report.sampleId)) || 'unknown';
                        var age = sr.sample && sm && typeof sm.sampleAgeMonths === 'function'
                                    ? sm.sampleAgeMonths(sr.sample)
                                    : null;
                        return lbl + (age != null ? ' (' + Math.round(age) + ' months old)' : '');
                    }).join('; ');
                    allChildren.push(new Paragraph({
                        spacing: { before: 80, after: 40 },
                        children: [new TextRun({
                            text: 'Excluded from procurement (' + staleReports.length +
                                  ' sample' + (staleReports.length === 1 ? '' : 's') + '): ',
                            bold: true, size: 22, color: '6B7280'
                        }), new TextRun({
                            text: excludedLabels + '. ',
                            size: 22, color: '6B7280'
                        }), new TextRun({
                            text: 'Most recent sample exceeds the ' +
                                  (sm && sm.STALENESS_CONFIG ? sm.STALENESS_CONFIG.thresholdMonths : 18) +
                                  '-month freshness threshold. Re-sample to include.',
                            italics: true, size: 22, color: '6B7280'
                        })]
                    }));
                }
                if (samplesMissingArea.length > 0 && anyAreaSeen) {
                    // Only flag if at least one other sample DID have area
                    // (otherwise the subtitle already explained it)
                    allChildren.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [new TextRun({
                            text: 'Area (ha) missing for: ',
                            bold: true, size: 22, color: '6B7280'
                        }), new TextRun({
                            text: samplesMissingArea.join(', ') + '. ',
                            size: 22, color: '6B7280'
                        }), new TextRun({
                            text: 'Absolute kg totals above exclude these zones. ' +
                                  'Enter sample area on each to include them.',
                            italics: true, size: 22, color: '6B7280'
                        })]
                    }));
                }
            });
        }

        // Append ONE copy of References, Metadata, Glossary at the end
        if (trailingSections) {
            for (var ti = 0; ti < trailingSections.length; ti++) {
                allChildren.push(trailingSections[ti]);
            }
        }

        // b35fix402 (C18): final pass to collapse any consecutive page-break
        // paragraphs left behind by zone-boundary emission, splicing of
        // sections that begin/end with breaks, or trailing-sections push.
        // Defensive last step: runs after all pushes complete and before
        // Document construction so no later push can re-introduce the bug.
        dedupConsecutivePageBreaks(allChildren);

        // Create document
        var doc = new Document({
            features: { updateFields: true },
            styles: {
                default: { document: { run: { font: 'Times New Roman', size: 22 } } },
                paragraphStyles: [
                    // Explicit Normal style so Pages respects Calibri on body text
                    // (Pages ignores docDefaults but honours paragraph style fonts)
                    { id: 'Normal', name: 'Normal',
                      run: { font: 'Times New Roman', size: 22 },
                      paragraph: { spacing: { after: 0 } } },
                    { id: 'Title', name: 'Title', basedOn: 'Normal',
                      run: { size: 48, bold: true, color: '1F2937', font: 'Times New Roman' },
                      paragraph: { spacing: { before: 0, after: 60 }, alignment: AlignmentType.CENTER } },
                    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                      run: { size: 28, bold: true, color: '1F2937', font: 'Times New Roman' },
                      paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
                    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                      run: { size: 24, bold: true, color: '374151', font: 'Times New Roman' },
                      paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } }
                ]
            },
            sections: [{
                properties: {
                    page: {
                        // Explicit A4 portrait size. Without this, Word on mobile
                        // does not know the intended page dimensions and squeezes
                        // all table columns to near-zero width.
                        size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
                        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
                    }
                },
                headers: {
                    default: new Header({ children: [new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        // b35fix310a_1: surface the hub version stamp on every page
                        // of combined exports. Single-site exports already include
                        // this via the metadata section, but combined exports strip
                        // trailing References & Methodology, so the version never
                        // made it into the rendered output. Pull from the same
                        // global.GAIP_HUB_VERSION the export-metadata footer uses.
                        children: [new TextRun({
                            text: 'GAIP Combined Report  \u2022  Hub v' + (global.GAIP_HUB_VERSION || '11.3.10'),
                            size: 22, color: '9CA3AF'
                        })]
                    })] })
                },
                footers: {
                    default: new Footer({ children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: 'Page ', size: 22, color: '9CA3AF' }),
                            new TextRun({ children: [PageNumber.CURRENT], size: 22, color: '9CA3AF' }),
                            new TextRun({ text: ' of ', size: 22, color: '9CA3AF' }),
                            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 22, color: '9CA3AF' })
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
            var siteOrder = [];
            samples.forEach(function(s) {
                var key = s.siteLabel || s.siteId || 'Unknown';
                if (!groups[key]) { groups[key] = []; siteOrder.push(key); }
                groups[key].push(s);
            });
            var multiSite = siteOrder.length > 1;

            function buildGroupsHtml(filter) {
                filter = (filter || '').toLowerCase().trim();
                return siteOrder.map(function(siteLabel) {
                    var siteSamples = groups[siteLabel];
                    var siteMatch = !filter || siteLabel.toLowerCase().indexOf(filter) !== -1;
                    var visibleSamples = siteMatch ? siteSamples : siteSamples.filter(function(e) {
                        return (e.sampleLabel || e.sampleId || '').toLowerCase().indexOf(filter) !== -1;
                    });
                    if (!visibleSamples.length) return '';

                    var rows = visibleSamples.map(function(entry) {
                        var uid = entry.siteId + '::' + entry.sampleId;
                        var types = [];
                        if (entry.hasSoil)   types.push('Soil');
                        if (entry.hasWater)  types.push('Water');
                        if (entry.hasTissue) types.push('Tissue');
                        var typeBadges = types.map(function(t) {
                            return '<span class="gaip-bulk-badge gaip-bulk-badge-set">' + t + '</span>';
                        }).join('');
                        var isChecked = backdrop ? !!backdrop.querySelector('input[data-sample-uid="' + uid + '"]') ?
                            backdrop.querySelector('input[data-sample-uid="' + uid + '"]').checked : true : true;
                        return '<tr>' +
                            '<td style="width:28px">' +
                            '<input type="checkbox" ' + (isChecked ? 'checked' : '') + ' data-sample-uid="' + uid + '">' +
                            '</td>' +
                            '<td class="gaip-bulk-sample-label">' + _escHtml(entry.sampleLabel || entry.sampleId) + '</td>' +
                            '<td style="text-align:right">' + typeBadges + '</td>' +
                            '</tr>';
                    }).join('');

                    var siteHeader = multiSite
                        ? '<div class="gaip-bulk-group-head">' +
                          '<input type="checkbox" class="csp-site-check" data-site="' + _escHtml(siteLabel) + '" checked ' +
                          'style="width:15px;height:15px;accent-color:var(--gaip-brand,#236b4a);flex-shrink:0">' +
                          '<h4 class="gaip-bulk-group-title">' + _escHtml(siteLabel) + '</h4>' +
                          '<span class="gaip-bulk-group-count">' + visibleSamples.length + ' sample' + (visibleSamples.length !== 1 ? 's' : '') + '</span>' +
                          '</div>'
                        : '';

                    return '<div data-site-group="' + _escHtml(siteLabel) + '" class="gaip-bulk-group">' +
                        siteHeader +
                        '<table class="gaip-bulk-table"><tbody>' + rows + '</tbody></table>' +
                        '</div>';
                }).join('');
            }

            var backdrop = document.createElement('div');
            backdrop.className = 'gaip-bulk-area-backdrop';
            backdrop.style.display = 'flex';

            backdrop.innerHTML =
                '<div class="gaip-bulk-dialog">' +
                    '<header class="gaip-bulk-dialog-head">' +
                        '<div>' +
                            '<h3 class="gaip-bulk-dialog-title">Export Report</h3>' +
                            '<p style="margin:4px 0 0;font-size:12px;color:var(--gaip-text-secondary)">Select samples to include in the Word document</p>' +
                        '</div>' +
                        '<button type="button" id="csp-close" class="gaip-bulk-close" aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="gaip-bulk-intro">' +
                        '<div style="display:flex;align-items:center;gap:8px">' +
                            '<div style="flex:1;position:relative">' +
                                '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--gaip-text-secondary,#9ca3af);pointer-events:none">' +
                                    '<circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/>' +
                                '</svg>' +
                                '<input id="csp-search" type="text" placeholder="Search sites or samples…" ' +
                                'style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--gaip-border,#d0d7d4);border-radius:var(--gaip-r-s,4px);font-size:13px;background:var(--gaip-bg,#fff);color:var(--gaip-text);box-sizing:border-box;font-family:inherit">' +
                            '</div>' +
                            '<button id="csp-all" type="button" style="font-size:11px;padding:5px 10px;border:1px solid var(--gaip-border,#d0d7d4);background:var(--gaip-bg-raised,#fff);border-radius:var(--gaip-r-s,4px);cursor:pointer;color:var(--gaip-text-secondary,#5a6b65);white-space:nowrap;font-family:inherit">Select all</button>' +
                            '<button id="csp-none" type="button" style="font-size:11px;padding:5px 10px;border:1px solid var(--gaip-border,#d0d7d4);background:var(--gaip-bg-raised,#fff);border-radius:var(--gaip-r-s,4px);cursor:pointer;color:var(--gaip-text-secondary,#5a6b65);white-space:nowrap;font-family:inherit">Deselect all</button>' +
                        '</div>' +
                    '</div>' +
                    '<div id="csp-list" class="gaip-bulk-groups">' + buildGroupsHtml('') + '</div>' +
                    '<footer class="gaip-bulk-dialog-foot">' +
                        '<span id="csp-count" class="gaip-bulk-status">' + samples.length + ' of ' + samples.length + ' selected</span>' +
                        '<div style="display:flex;gap:8px">' +
                            '<button id="csp-cancel" type="button" class="gaip-bulk-cancel">Cancel</button>' +
                            '<button id="csp-export" type="button" class="gaip-bulk-apply">Generate &amp; Download</button>' +
                        '</div>' +
                    '</footer>' +
                '</div>';

            document.body.appendChild(backdrop);

            function updateCount() {
                var checked = backdrop.querySelectorAll('input[data-sample-uid]:checked').length;
                var countEl = backdrop.querySelector('#csp-count');
                if (countEl) countEl.textContent = checked + ' of ' + samples.length + ' selected';
                var exportBtn = backdrop.querySelector('#csp-export');
                if (exportBtn) exportBtn.disabled = checked === 0;
            }

            function rebuildList(filter) {
                var listEl = backdrop.querySelector('#csp-list');
                if (listEl) listEl.innerHTML = buildGroupsHtml(filter);
                // Re-wire checkboxes after rebuild
                backdrop.querySelectorAll('input[data-sample-uid]').forEach(function(cb) {
                    cb.addEventListener('change', function() { updateCount(); syncSiteCheck(cb); });
                });
                backdrop.querySelectorAll('.csp-site-check').forEach(function(sc) {
                    sc.addEventListener('change', function() { toggleSite(sc); });
                });
                updateCount();
            }

            function syncSiteCheck(changedCb) {
                var siteGroup = changedCb.closest('[data-site-group]');
                if (!siteGroup) return;
                var sc = siteGroup.querySelector('.csp-site-check');
                if (!sc) return;
                var all = siteGroup.querySelectorAll('input[data-sample-uid]');
                var checked = siteGroup.querySelectorAll('input[data-sample-uid]:checked');
                sc.indeterminate = checked.length > 0 && checked.length < all.length;
                sc.checked = checked.length === all.length;
            }

            function toggleSite(sc) {
                var siteGroup = sc.closest('[data-site-group]');
                if (!siteGroup) return;
                siteGroup.querySelectorAll('input[data-sample-uid]').forEach(function(cb) {
                    cb.checked = sc.checked;
                });
                sc.indeterminate = false;
                updateCount();
            }

            function close(result) {
                backdrop.remove();
                resolve(result);
            }

            // Wire initial checkboxes
            rebuildList('');

            // Search
            backdrop.querySelector('#csp-search').addEventListener('input', function() {
                rebuildList(this.value);
            });

            backdrop.querySelector('#csp-all').addEventListener('click', function() {
                backdrop.querySelectorAll('input[data-sample-uid]').forEach(function(cb) { cb.checked = true; });
                backdrop.querySelectorAll('.csp-site-check').forEach(function(sc) { sc.checked = true; sc.indeterminate = false; });
                updateCount();
            });
            backdrop.querySelector('#csp-none').addEventListener('click', function() {
                backdrop.querySelectorAll('input[data-sample-uid]').forEach(function(cb) { cb.checked = false; });
                backdrop.querySelectorAll('.csp-site-check').forEach(function(sc) { sc.checked = false; sc.indeterminate = false; });
                updateCount();
            });
            backdrop.querySelector('#csp-close').addEventListener('click', function() { close(null); });
            backdrop.querySelector('#csp-cancel').addEventListener('click', function() { close(null); });
            backdrop.querySelector('#csp-export').addEventListener('click', function() {
                var selected = [];
                backdrop.querySelectorAll('input[data-sample-uid]:checked').forEach(function(cb) {
                    var parts = cb.dataset.sampleUid.split('::');
                    for (var i = 0; i < samples.length; i++) {
                        if (samples[i].siteId === parts[0] && samples[i].sampleId === parts[1]) {
                            selected.push(samples[i]);
                            break;
                        }
                    }
                });
                close(selected.length > 0 ? selected : null);
            });
            backdrop.addEventListener('click', function(e) {
                if (e.target === backdrop) close(null);
            });
        });
    }

    function _escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    async function exportWithPicker(scope) {
        scope = scope || 'all';
        var samples = enumerateSamples(scope);
        if (!samples || samples.length === 0) {
            alert('No soil samples found to export.');
            return;
        }
        if (samples.length === 1) {
            return exportCombinedWithSamples(samples);
        }
        var selected = await showSamplePicker(samples, scope);
        if (!selected) return;
        return exportCombinedWithSamples(selected);
    }

    global.GAIP_CombinedExport = {
        version: '1.0.0',
        exportAll: function() { return exportCombined('all'); },
        exportCurrentSite: function() { return exportCombined('current'); },
        exportWithPicker: exportWithPicker,
        enumerate: enumerateSamples
    };


})(window);
