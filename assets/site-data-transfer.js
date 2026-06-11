/**
 * Gilba Hub — Site Data Transfer v1.0.0
 * ======================================
 * Export a site's complete data bundle (samples + site config + turf profile)
 * to a .json file. Import that file on any machine running the Hub to restore
 * the full site state.
 *
 * Usage:
 *   Export: click "📤 Export" button in site selector bar
 *   Import: click "📥 Import" button, pick the .json file
 *
 * Bundle format:
 *   {
 *     version: 1,
 *     exportedAt: ISO string,
 *     exportedBy: 'Gilba Hub v...',
 *     site: { id, label },
 *     samples: { allSites: { [siteId]: {...} }, allActive, allMeta, sites },
 *     siteConfig: { ... },   // turf, location, schedule settings
 *     turfProfile: { ... }   // saved profile object (if one exists for this site)
 *   }
 */

(function (global) {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;


    var VERSION = '1.0.0';
    var BUNDLE_VERSION = 2;

    // =========================================================================
    // HELPERS
    // =========================================================================

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[SiteTransfer]');
        console.log.apply(console, args);
    }

    function warn() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[SiteTransfer]');
        console.warn.apply(console, args);
    }

    function getActiveSiteId() {
        var SM = global.GAIP_SampleManager;
        if (SM && typeof SM.getActiveSiteId === 'function') return SM.getActiveSiteId();
        return 'default';
    }

    function getActiveSiteLabel() {
        var SM = global.GAIP_SampleManager;
        if (!SM || typeof SM.getSiteList !== 'function') return 'Site';
        var list = SM.getSiteList();
        var siteId = getActiveSiteId();
        var match = list.find(function (s) { return s.id === siteId; });
        return match ? match.label : siteId;
    }

    function slugify(str) {
        return (str || 'site').toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
    }

    function showToast(msg, isError) {
        var el = document.createElement('div');
        el.textContent = msg;
        el.style.cssText = [
            'position:fixed', 'bottom:24px', 'right:24px',
            'padding:12px 20px', 'border-radius:8px',
            'font-size:14px', 'font-weight:600',
            'z-index:99999', 'box-shadow:0 4px 12px rgba(0,0,0,0.15)',
            isError
                ? 'background:#dc3545;color:var(--gaip-surface)'
                : 'background:#2c5f2d;color:var(--gaip-surface)'
        ].join(';');
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 3500);
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    function exportSite() {
        var SM = global.GAIP_SampleManager;
        if (!SM || typeof SM.getAllSamples !== 'function') {
            showToast('⚠ Sample manager not ready', true);
            return;
        }

        var siteId    = getActiveSiteId();
        var siteLabel = getActiveSiteLabel();

        // --- Samples: extract only the active site's data ---
        var all = SM.getAllSamples();
        var siteSamples = {
            allSites:  {},
            allActive: {},
            allMeta:   {},
            sites:     {},
            currentSite: siteId
        };

        if (all.allSites  && all.allSites[siteId])  siteSamples.allSites[siteId]  = all.allSites[siteId];
        if (all.allActive && all.allActive[siteId]) siteSamples.allActive[siteId] = all.allActive[siteId];
        if (all.allMeta   && all.allMeta[siteId])   siteSamples.allMeta[siteId]   = all.allMeta[siteId];
        if (all.sites     && all.sites[siteId])     siteSamples.sites[siteId]     = all.sites[siteId];

        // --- Site config (turf, location, schedule) ---
        var siteConfig = null;
        try {
            var configs = JSON.parse(_ls.getItem('gilba_hub_site_configs') || '{}');
            siteConfig = configs[siteId] || null;
        } catch (e) { warn('Could not read site config:', e); }

        // --- Turf profile (saved profile object for this site) ---
        var turfProfile = null;
        try {
            var profilesKey  = 'gilba_turf_profiles';
            var lastKey      = 'gilba_turf_profiles_last';
            var profiles     = JSON.parse(_ls.getItem(profilesKey) || '{}');
            var lastName     = _ls.getItem(lastKey);
            // Try matching by site label or last-used profile name
            var profileName  = null;
            if (lastName && profiles[lastName]) {
                profileName = lastName;
            } else {
                // Fall back: find a profile whose name contains the site label
                var labelLower = siteLabel.toLowerCase();
                profileName = Object.keys(profiles).find(function (k) {
                    return k.toLowerCase().indexOf(labelLower) !== -1 ||
                           labelLower.indexOf(k.toLowerCase()) !== -1;
                }) || null;
            }
            if (profileName) {
                turfProfile = { name: profileName, data: profiles[profileName] };
            }
        } catch (e) { warn('Could not read turf profile:', e); }

        // --- Sensor mappings for this site ---
        var sensorMapping = null;
        try {
            var mappings = JSON.parse(_ls.getItem('gilba_sensor_mappings') || '{}');
            if (mappings[siteId]) sensorMapping = mappings[siteId];
        } catch (e) { /* non-fatal */ }

        // --- Assemble bundle ---
        var bundle = {
            version:    BUNDLE_VERSION,
            exportedAt: new Date().toISOString(),
            exportedBy: 'Gilba Hub ' + VERSION,
            site: {
                id:    siteId,
                label: siteLabel
            },
            samples:       siteSamples,
            siteConfig:    siteConfig,
            turfProfile:   turfProfile,
            sensorMapping: sensorMapping,
            // Forward-compatibility stub for multi-area support (post-launch).
            // When areas are implemented, each entry will carry:
            //   { label, profileOverride?, sensor? }
            // Importer versions that don't understand areas will ignore this field.
            areas: {}
        };

        // Count samples for feedback
        var sampleCount = 0;
        var types = ['soil', 'water', 'tissue', 'loi'];
        var store = siteSamples.allSites[siteId] || {};
        types.forEach(function (t) {
            if (store[t]) sampleCount += Object.keys(store[t]).length;
        });

        // --- Download ---
        var filename = slugify(siteLabel) + '_gilba_' +
            new Date().toISOString().slice(0, 10) + '.json';
        var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        log('Exported', siteLabel, '-', sampleCount, 'samples →', filename);
        showToast('✓ Exported ' + sampleCount + ' samples for ' + siteLabel);
    }

    // =========================================================================
    // IMPORT
    // =========================================================================

    function importSite(file) {
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (e) {
            var bundle;
            try {
                bundle = JSON.parse(e.target.result);
            } catch (err) {
                showToast('⚠ Invalid file, not a Gilba Hub export', true);
                return;
            }

            // Basic validation
            if (!bundle.version || !bundle.site || !bundle.samples) {
                showToast('⚠ File format not recognised, was it exported from the Gilba Hub?', true);
                return;
            }

            var incomingSiteId    = bundle.site.id;
            var incomingSiteLabel = bundle.site.label;

            // --- Merge samples ---
            var SM = global.GAIP_SampleManager;
            if (SM && typeof SM.getAllSamples === 'function') {
                try {
                    var existing = SM.getAllSamples();

                    // Merge the incoming site into existing data
                    if (!existing.allSites)  existing.allSites  = {};
                    if (!existing.allActive) existing.allActive = {};
                    if (!existing.allMeta)   existing.allMeta   = {};
                    if (!existing.sites)     existing.sites     = {};

                    if (bundle.samples.allSites[incomingSiteId]) {
                        existing.allSites[incomingSiteId]  = bundle.samples.allSites[incomingSiteId];
                    }
                    if (bundle.samples.allActive[incomingSiteId]) {
                        existing.allActive[incomingSiteId] = bundle.samples.allActive[incomingSiteId];
                    }
                    if (bundle.samples.allMeta[incomingSiteId]) {
                        existing.allMeta[incomingSiteId]   = bundle.samples.allMeta[incomingSiteId];
                    }
                    if (bundle.samples.sites[incomingSiteId]) {
                        existing.sites[incomingSiteId]     = bundle.samples.sites[incomingSiteId];
                    } else {
                        // Create minimal site entry if missing
                        existing.sites[incomingSiteId] = {
                            label:     incomingSiteLabel,
                            createdAt: new Date().toISOString()
                        };
                    }

                    SM.restoreFromPersistence(existing);
                    log('Samples merged for site:', incomingSiteId);
                } catch (err) {
                    warn('Sample merge failed:', err);
                }
            }

            // --- Merge site config ---
            if (bundle.siteConfig) {
                try {
                    var configs = JSON.parse(_ls.getItem('gilba_hub_site_configs') || '{}');
                    configs[incomingSiteId] = bundle.siteConfig;
                    _ls.setItem('gilba_hub_site_configs', JSON.stringify(configs));
                    log('Site config restored for:', incomingSiteId);
                } catch (err) {
                    warn('Site config merge failed:', err);
                }

                // Save location to DB so the analysis engine uses correct coordinates.
                // localStorage-only import leaves the DB with stale coordinates, causing
                // the old hub iframe to fetch weather for the wrong location on re-run.
                var _loc = bundle.siteConfig.location;
                if (_loc && _loc.lat && _loc.lon && typeof fetch !== 'undefined') {
                    var _siteTarget = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId) || incomingSiteId;
                    var _apiBase    = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.restUrl) || '/api/';
                    var _csrf       = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
                    fetch(_apiBase.replace(/\/?$/, '/') + 'sites/' + encodeURIComponent(_siteTarget), {
                        method:  'PATCH',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': _csrf },
                        body:    JSON.stringify({
                            location_name: _loc.name || '',
                            latitude:      _loc.lat,
                            longitude:     _loc.lon
                        })
                    }).then(function() {
                        log('Location saved to DB for', _siteTarget, ':', _loc.lat, _loc.lon);
                    }).catch(function() { /* non-fatal */ });
                }
            }

            // --- Merge turf profile ---
            if (bundle.turfProfile && bundle.turfProfile.name && bundle.turfProfile.data) {
                try {
                    var profilesKey = 'gilba_turf_profiles';
                    var profiles    = JSON.parse(_ls.getItem(profilesKey) || '{}');
                    profiles[bundle.turfProfile.name] = bundle.turfProfile.data;
                    _ls.setItem(profilesKey, JSON.stringify(profiles));
                    log('Turf profile restored:', bundle.turfProfile.name);
                } catch (err) {
                    warn('Turf profile merge failed:', err);
                }
            }

            // --- Merge sensor mapping ---
            if (bundle.sensorMapping) {
                try {
                    var mappings = JSON.parse(_ls.getItem('gilba_sensor_mappings') || '{}');
                    mappings[incomingSiteId] = bundle.sensorMapping;
                    _ls.setItem('gilba_sensor_mappings', JSON.stringify(mappings));
                    log('Sensor mapping restored for:', incomingSiteId);
                } catch (err) { /* non-fatal */ }
            }

            // Count what came in
            var sampleCount = 0;
            var types = ['soil', 'water', 'tissue', 'loi'];
            var store = (bundle.samples.allSites || {})[incomingSiteId] || {};
            types.forEach(function (t) {
                if (store[t]) sampleCount += Object.keys(store[t]).length;
            });

            log('Import complete,', incomingSiteLabel, ':', sampleCount, 'samples');

            // Switch to the imported site and reload
            setTimeout(function () {
                var SM2 = global.GAIP_SampleManager;
                if (SM2 && typeof SM2.setActiveSite === 'function') {
                    SM2.setActiveSite(incomingSiteId);
                }
                showToast('✓ Imported ' + sampleCount + ' samples for ' + incomingSiteLabel + ', reloading…');
                setTimeout(function () { location.reload(); }, 1200);
            }, 300);
        };

        reader.readAsText(file);
    }

    // =========================================================================
    // UI INJECTION
    // =========================================================================

    function injectButtons() {
        var bar = document.getElementById('gaip-site-selector-top');
        if (!bar) return;

        // Don't inject twice
        if (document.getElementById('gaip-site-export-btn')) return;

        var statusSpan = document.getElementById('gaip-site-status-top');

        // Export button
        var exportBtn = document.createElement('button');
        exportBtn.type      = 'button';
        exportBtn.id        = 'gaip-site-export-btn';
        exportBtn.title     = 'Export this site\'s data to a file you can send to your client';
        exportBtn.innerHTML = '📤 Export';
        exportBtn.style.cssText = [
            'padding:6px 12px',
            'border:1px solid #17a2b8',
            'border-radius:6px',
            'background:var(--gaip-surface)',
            'color:#17a2b8',
            'cursor:pointer',
            'font-size:13px',
            'font-weight:600'
        ].join(';');
        exportBtn.addEventListener('click', function () { exportSite(); });

        // Import button + hidden file input
        var importBtn = document.createElement('button');
        importBtn.type      = 'button';
        importBtn.id        = 'gaip-site-import-btn';
        importBtn.title     = 'Import a site data file sent to you by your agronomist';
        importBtn.innerHTML = '📥 Import';
        importBtn.style.cssText = [
            'padding:6px 12px',
            'border:1px solid #6f42c1',
            'border-radius:6px',
            'background:var(--gaip-surface)',
            'color:#6f42c1',
            'cursor:pointer',
            'font-size:13px',
            'font-weight:600'
        ].join(';');

        var fileInput = document.createElement('input');
        fileInput.type   = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.id    = 'gaip-site-import-file';
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) {
                importSite(fileInput.files[0]);
                fileInput.value = ''; // reset so same file can be re-imported
            }
        });

        importBtn.addEventListener('click', function () { fileInput.click(); });

        // Insert before the status span (or at end of bar)
        if (statusSpan && statusSpan.parentNode === bar) {
            bar.insertBefore(exportBtn, statusSpan);
            bar.insertBefore(importBtn, statusSpan);
            bar.insertBefore(fileInput, statusSpan);
        } else {
            bar.appendChild(exportBtn);
            bar.appendChild(importBtn);
            bar.appendChild(fileInput);
        }

        log('v' + VERSION + ' ready, Export/Import buttons injected');
    }

    // =========================================================================
    // INIT
    // =========================================================================

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectButtons);
        } else {
            // DOM ready — but site selector may not be rendered yet (WP shortcode renders)
            // Wait for the bar to appear
            var attempts = 0;
            var interval = setInterval(function () {
                attempts++;
                if (document.getElementById('gaip-site-selector-top')) {
                    clearInterval(interval);
                    injectButtons();
                } else if (attempts > 20) {
                    clearInterval(interval);
                    warn('Site selector bar not found after 10s, buttons not injected');
                }
            }, 500);
        }
    }

    init();

})(typeof window !== 'undefined' ? window : this);
