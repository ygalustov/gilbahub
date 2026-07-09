/**
 * Site Switch Cleanup
 * v1.1.0
 *
 * Clears stale module-level globals AND stale turf identity slots when the
 * active site changes. Without this, globals like GAIP_NUTRITION_PROGRAM
 * persist across site switches and contaminate exports with data from the
 * wrong site, AND turf identity slots like effectiveSpecies / grassSpecies
 * carry over because the canonical writer at hub-orchestrator.js:4215-4220
 * uses a CONDITIONAL write pattern that fails to overwrite when the new
 * site's compute hasn't yet derived a value.
 *
 * Listens: gaip:site-changed, gaip:profile-loaded
 * Clears:  All GAIP_*_RESULT globals AND inputs.turf identity slots
 *          (effectiveSpecies, grassSpecies, coolOverseed, warmBase)
 *
 * Load order: After sample-manager.js, before consumer modules.
 *
 * b35fix401 (C16): added clearTurfIdentity() to address the documented
 * stale-effectiveSpecies bug. Production evidence: Rockingham GC log
 * gilbasolutions_com-1777619890653.log lines 281, 379, 383 — disease engine
 * ran with speciesForDisease: "browntopBent" carried over from prior cotula
 * site. Pattern matches b35fix388/394 cotula clearBowlsState contract:
 * read existing inputs.turf, spread, delete identity keys, write back via
 * routed-write contract (window.GAIP_STATE = { inputs: { turf: cleared } }).
 *
 * Identity-key partition: this function clears effectiveSpecies, grassSpecies,
 * coolOverseed, warmBase. The keys turfType, surfaceType, speciesKey, cotula,
 * physiology are owned by clearBowlsState (cotula-bowling-green.js, b35fix394)
 * and intentionally NOT touched here.
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

    /**
     * Clear stale turf identity slots from inputs.turf via routed write.
     *
     * b35fix401 (C16). Companion to clearSiteGlobals; both fire on site-change.
     *
     * The hub-store proxy (gilba-hub-v2.js ~1393) replaces inputs.turf wholesale
     * on each routed write, so we must read existing inputs.turf, spread it,
     * delete the identity keys, and write back the merged object. Direct
     * property writes (window.GAIP_STATE.inputs.turf.effectiveSpecies = null)
     * land on the synthesised getter view and are silently dropped (same bug
     * class as b35fix386/388/393/394).
     *
     * Keys cleared:
     *   - effectiveSpecies  (canonical writer hub-orchestrator.js:4216)
     *   - grassSpecies      (canonical writer hub-orchestrator.js:4219)
     *   - coolOverseed      (overseed flag; sticky if site A overseeds and B doesn't)
     *   - warmBase          (warm-base species fallback at hub-tissue-v3.js:1279)
     *   - turfType          (b35fix444 / C48b: was claimed to be owned by
     *                        clearBowlsState, but clearBowlsState only strips
     *                        turfType when it equals 'bowls', so non-bowls
     *                        site-switches like sports->golf left the stale
     *                        value in place. Symptom: Rockingham GC golf-greens
     *                        site rendered Turf Type: Sports Field in the docx
     *                        Site Profile because the prior site was hagley_oval
     *                        sports. Production verified 2026-05-05 via
     *                        gilbasolutions_com-1777964001383.log lines 955-2779.
     *                        TPC writes turfType to tp.state per site, but no
     *                        writer routes it back to GAIP_STATE.inputs.turf
     *                        until hub-tissue-v3.js:6960 analysis-end merge,
     *                        which carries the stale value forward. Clearing
     *                        unconditionally on site-switch lets the new site's
     *                        TPC dispatch + analysis run populate the correct
     *                        value cleanly.)
     *   - subCategory       (b35fix444 / C48b: paired with turfType for golf,
     *                        greens / fairways / tees / rough. Same defect
     *                        class; null on hagley_oval persisted as null on
     *                        rockingham, defeating the golf-class composition
     *                        branch at word-export.js:7371.)
     *   - surfaceType       (b35fix444 / C48b: per-zone surface set by
     *                        sample-manager / cotula. Same defect class.)
     *
     * Keys NOT cleared (owned by clearBowlsState, b35fix394; only relevant
     * for bowls site-switches; clearBowlsState fires alongside this clear
     * on bowls transitions):
     *   speciesKey, cotula, physiology
     */
    function clearTurfIdentity(fromSite, toSite) {
        try {
            var existingTurf = (global.GAIP_STATE && global.GAIP_STATE.inputs && global.GAIP_STATE.inputs.turf)
                            || (global.GAIP_STATE && global.GAIP_STATE.turf)
                            || {};
            var cleared = Object.assign({}, existingTurf);
            delete cleared.effectiveSpecies;
            delete cleared.grassSpecies;
            delete cleared.coolOverseed;
            delete cleared.warmBase;
            // b35fix444 (C48b): clear turfType/subCategory/surfaceType unconditionally.
            // Pre-fix these survived non-bowls site-switches and propagated stale
            // values into the docx Site Profile label and SLAN amendment surface
            // routing in _computeAmendmentDecision.
            delete cleared.turfType;
            delete cleared.subCategory;
            delete cleared.surfaceType;
            global.GAIP_STATE = { inputs: { turf: cleared } };
            // Also clear GaipTurfProfile controller state so that word-export.js
            // does not read stale turfType/subCategory from the previous site.
            // site-config-persistence.restoreNewSiteConfig calls selectTurfType +
            // selectSubCategory ~300ms later, which re-populates these slots.
            // Without this clear, the docx Site Profile reads GaipTurfProfile.state
            // (the b35fix438 fallback) and gets the old site's type — same defect
            // class as b35fix444 but via the controller state rather than GAIP_STATE.
            var _tp = global.GaipTurfProfile;
            if (_tp && _tp.state) {
                _tp.state.turfType   = null;
                _tp.state.subCategory = null;
                _tp.state.species    = null;
            }
            console.log(MODULE, 'Cleared turf identity slots for site switch:',
                fromSite || '?', '->', toSite || '?');
        } catch (e) {
            console.warn(MODULE, 'clearTurfIdentity failed:', e && e.message);
        }
    }

    // =========================================================================
    // WIRE UP
    // =========================================================================

    var _previousSiteId = null;

    document.addEventListener('gaip:site-changed', function(e) {
        var newSiteId = (e.detail && e.detail.siteId) || null;

        // Only clear if actually switching (not initial load to same site)
        if (_previousSiteId && _previousSiteId !== newSiteId) {
            clearTurfIdentity(_previousSiteId, newSiteId);
            clearSiteGlobals(_previousSiteId, newSiteId);
            notifyInvalidation(newSiteId);
        }

        _previousSiteId = newSiteId;
    });

    // Also listen for profile loads (which trigger site creation + switch)
    document.addEventListener('gaip:profile-loaded', function(e) {
        var siteId = (e.detail && e.detail.siteId) || null;
        if (_previousSiteId && _previousSiteId !== siteId) {
            clearTurfIdentity(_previousSiteId, siteId);
            clearSiteGlobals(_previousSiteId, siteId);
            notifyInvalidation(siteId);
        }
        _previousSiteId = siteId;
    });

    // Export for testing
    global.GAIP_SiteSwitchCleanup = {
        version: '1.1.0',
        clearSiteGlobals: clearSiteGlobals,
        clearTurfIdentity: clearTurfIdentity,
        SITE_SCOPED_GLOBALS: SITE_SCOPED_GLOBALS
    };

    console.log('✅ Site Switch Cleanup v1.1.0 loaded,',
        SITE_SCOPED_GLOBALS.length, 'globals tracked + 4 turf identity slots');

})(window);
