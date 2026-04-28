/**
 * Site Switch Cleanup
 * v1.0.0
 * 
 * Clears stale module-level globals when the active site changes.
 * Without this, globals like GAIP_NUTRITION_PROGRAM persist across
 * site switches and contaminate exports with data from the wrong site.
 * 
 * Listens: gaip:site-changed
 * Clears:  All GAIP_*_RESULT globals and module outputs
 * 
 * Load order: After sample-manager.js, before consumer modules.
 */
(function(global) {
    'use strict';

    const MODULE = '[SiteSwitchCleanup]';

    /**
     * Globals that hold per-site analysis results.
     * Each entry: [globalName, clearValue]
     * clearValue is what to set (null to clear, or a sentinel object)
     */
    const SITE_SCOPED_GLOBALS = [
        // Nutrition program (Prebble NZ / AU fertiliser integration)
        ['GAIP_NUTRITION_PROGRAM', null],

        // Engine results that depend on location/climate/species
        ['GAIP_DISEASE_RESULT', null],
        ['GAIP_COMPANION_DISEASE_RESULT', null],
        ['GAIP_DEW_RESULT', null],
        ['GAIP_SHADE_RESULT', null],
        ['GAIP_PGR_RESULT', null],
        ['GAIP_CLIMATE_V2_RESULT', null],
        ['GAIP_IRRIGATION_RESULT', null],
        ['GAIP_SALINITY_RESULT', null],
        ['GAIP_TISSUE_RESULT', null],
        ['GAIP_MLSN_RESULT', null],
        ['GAIP_DMI_RESULT', null],
        ['GAIP_PHYTOTOXICITY_RESULT', null],
        ['GAIP_NUTRIENT_DEMAND_RESULT', null],
        ['GAIP_SOIL_TEMP', null],
        ['GAIP_PRE_EMERGENT_RESULT', null],   // b35fix236: was missing — caused stale pre-emergent panel on site-switch

        // Climate metrics (recalculated per location)
        ['climateMetrics', null],

        // Raw weather forecast data — must be cleared so disease/Fusarium
        // engines don't use stale forecast from previous site while new
        // weather fetch is in flight.
        ['rawWeatherData', null],
        ['GAIP_WEATHER_DATA', null],

        // Canonical state — rebuilt at start of every orchestrator run, but
        // stale coords are used as fallback if new site has no location yet.
        ['GAIP_CANONICAL_STATE', null],

        // Ambient DLI cache — explicitly read as cache (hub-orchestrator.js).
        // If site B weather hasn't loaded yet, site A's DLI is used silently.
        ['gaip_currentAmbientDLI', null],

    ];

    /**
     * Clear all site-scoped globals.
     * Called on site switch BEFORE the new site's analysis runs.
     */
    function clearSiteGlobals(fromSite, toSite) {
        let cleared = 0;
        SITE_SCOPED_GLOBALS.forEach(function(entry) {
            var name = entry[0];
            var clearVal = entry[1];
            if (global[name] != null) {
                global[name] = clearVal;
                cleared++;
            }
        });

        if (cleared > 0) {
            console.log(MODULE, 'Cleared', cleared, 'stale globals for site switch:',
                fromSite || '?', '->', toSite || '?');
        }
    }

    /**
     * Notify UI modules that site data has been invalidated.
     * Modules should show loading/empty state until analysis re-runs.
     */
    function notifyInvalidation(toSite) {
        document.dispatchEvent(new CustomEvent('gaip:site-data-invalidated', {
            detail: { siteId: toSite, timestamp: Date.now() }
        }));
    }

    // =========================================================================
    // WIRE UP
    // =========================================================================

    var _previousSiteId = null;

    document.addEventListener('gaip:site-changed', function(e) {
        var newSiteId = (e.detail && e.detail.siteId) || null;
        
        // Only clear if actually switching (not initial load to same site)
        if (_previousSiteId && _previousSiteId !== newSiteId) {
            clearSiteGlobals(_previousSiteId, newSiteId);
            notifyInvalidation(newSiteId);
        }
        
        _previousSiteId = newSiteId;
    });

    // Also listen for profile loads (which trigger site creation + switch)
    document.addEventListener('gaip:profile-loaded', function(e) {
        var siteId = (e.detail && e.detail.siteId) || null;
        if (_previousSiteId && _previousSiteId !== siteId) {
            clearSiteGlobals(_previousSiteId, siteId);
            notifyInvalidation(siteId);
        }
        _previousSiteId = siteId;
    });

    // Export for testing
    global.GAIP_SiteSwitchCleanup = {
        version: '1.0.0',
        clearSiteGlobals: clearSiteGlobals,
        SITE_SCOPED_GLOBALS: SITE_SCOPED_GLOBALS
    };

    console.log('✅ Site Switch Cleanup v1.0.0 loaded —', 
        SITE_SCOPED_GLOBALS.length, 'globals tracked');

})(window);
