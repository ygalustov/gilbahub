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

        // --- Site config: NOT exported, and the bundle says so ---
        //
        // GH-625, the other half of the same dead link. This read
        // `gilba_hub_site_configs`, which `site-config-persistence.js` clears
        // unconditionally in its `init()` — so the key is empty by the time any
        // page can call this, and the bundle has been carrying `null` here for
        // as long as that has been true. Reading it back was the import side,
        // removed above.
        //
        // The config lives on the server now (GH-441). Exporting it would mean
        // taking a browser-held copy and writing it into a file that another
        // machine would push back — the shape the project's rule forbids, and
        // the one GH-439 was opened for.
        var siteConfig = null;

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

    // GH-750 (queue item 3bg): THE IMPORT IS GONE. Its one write to the server PATCHed the
    // file's coordinates into the site the PAGE had open (`GAIP_HUB_CONFIG.activeSiteId`), not
    // the site the file described -- the class of GH-459. Without that write it would only have
    // put the file's turf profiles into localStorage and merged its samples into the sample
    // manager, which is a browser copy the project rule forbids. A control with no rightful
    // write path is removed rather than repaired. Its button lived only in the /hub markup,
    // which no client opens; the export, which only downloads a file, stays.

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

        // Insert before the status span (or at end of bar)
        if (statusSpan && statusSpan.parentNode === bar) {
            bar.insertBefore(exportBtn, statusSpan);
        } else {
            bar.appendChild(exportBtn);
        }

        log('v' + VERSION + ' ready, Export button injected');
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
