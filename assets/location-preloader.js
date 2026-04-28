/**
 * Location Preloader v1.0.0
 * 
 * Runs BEFORE TurfProfileController to ensure the correct per-site location
 * is in the DOM inputs. Without this, TurfProfile reads PHP-injected coords
 * from WP user_meta (which may be a different site's location) and does region
 * detection on the wrong coordinates.
 *
 * Reads: gilba_hub_site_configs (localStorage) + gilba_hub_samples_{userId} (localStorage)
 * Writes: .gaip-lat, .gaip-lon, #gaip-location-search DOM inputs
 */
(function() {
    'use strict';

    // Namespaced localStorage shim — isolates keys per plugin instance (GAIP vs GSSH).
    var _ls = (window.GilbaStorageNS && window.GilbaStorageNS.get) ? window.GilbaStorageNS.get() : localStorage;

    try {
        // 1. Determine active site from SampleManager's persisted state
        var userId = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.userId) || 0;
        var samplesKey = 'gilba_hub_samples' + (userId ? '_' + userId : '');
        var samplesRaw = _ls.getItem(samplesKey);
        var activeSiteId = 'default';

        if (samplesRaw) {
            try {
                var samples = JSON.parse(samplesRaw);
                if (samples.currentSite) activeSiteId = samples.currentSite;
            } catch (e) { /* ignore parse errors */ }
        }

        // 2. Read the site's saved config from SiteConfigPersistence
        var configsRaw = _ls.getItem('gilba_hub_site_configs');
        if (!configsRaw) return;

        var configs = JSON.parse(configsRaw);
        var siteConfig = configs[activeSiteId];
        if (!siteConfig || !siteConfig.location) return;

        var loc = siteConfig.location;
        if (!loc.lat || !loc.lon) return;

        // 3. Overwrite the PHP-injected DOM values
        //    These inputs may not exist yet if this runs in <head>, so we need
        //    to either run after DOM or use a DOMContentLoaded listener.
        function applyLocation() {
            var latInput = document.querySelector('.gaip-lat');
            var lonInput = document.querySelector('.gaip-lon');
            var locSearch = document.getElementById('gaip-location-search');

            if (!latInput || !lonInput) return false;

            // Only overwrite if the values are different (avoid unnecessary changes)
            var currentLat = parseFloat(latInput.value) || 0;
            var currentLon = parseFloat(lonInput.value) || 0;
            
            if (Math.abs(currentLat - loc.lat) > 0.001 || Math.abs(currentLon - loc.lon) > 0.001) {
                latInput.value = loc.lat;
                lonInput.value = loc.lon;
                if (locSearch && loc.name) locSearch.value = loc.name;
                console.log('[LocationPreloader] Corrected location for site "' + activeSiteId + '": ' + 
                    loc.lat + ', ' + loc.lon + (loc.name ? ' (' + loc.name + ')' : ''));
            }
            return true;
        }

        // Try immediately (script is in footer after DOM inputs)
        if (document.readyState !== 'loading') {
            applyLocation();
        } else {
            // DOM not ready yet — wait, but fire BEFORE other DOMContentLoaded listeners
            // by using { capture: true } to get priority
            document.addEventListener('DOMContentLoaded', applyLocation, { capture: true, once: true });
        }

    } catch (e) {
        console.warn('[LocationPreloader] Error:', e.message);
    }
})();
