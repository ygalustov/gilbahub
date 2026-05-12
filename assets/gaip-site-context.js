/**
 * gaip-site-context.js — v1.0.0
 *
 * Single source of truth for the active site/venue ID across all modules.
 *
 * Problem this solves:
 *   Every module was doing its own ad-hoc site ID resolution using a mix of
 *   GSSH_UnifiedVenueSelector.getCurrentVenueId(), GAIP_SampleManager.getActiveSiteId(),
 *   and GAIP_STATE.site.id — with no consistent rule for which takes priority on
 *   which page type. This caused cross-site and cross-mode data bleed (GAIP↔GSSH):
 *   - Spray log context (DMI fungicides) fetched for wrong site
 *   - Site config snapshots written to wrong site keys
 *   - Location names bleeding between sites
 *
 * Rule:
 *   - On GSSH pages (GILBA_PLUGIN_NS === 'gssh'): venue ID is authoritative
 *   - On GAIP pages (GILBA_PLUGIN_NS === 'gaip'): SampleManager active site is authoritative
 *   - GSSH venue selector is NEVER used as a site ID source on GAIP pages
 *
 * GILBA_PLUGIN_NS is injected by PHP (wp_add_inline_script) before any JS loads:
 *   GAIP: window.GILBA_PLUGIN_NS = "gaip"
 *   GSSH: window.GILBA_PLUGIN_NS = "gssh"
 *
 * Usage:
 *   var siteId = window.GAIP_SiteContext.getSiteId();
 *   var isGSSH = window.GAIP_SiteContext.isGSSH();
 *
 * @author  Gilba Solutions
 * @version 1.0.0 (b35fix271)
 */
(function(global) {
    'use strict';

    function isGSSH() {
        return global.GILBA_PLUGIN_NS === 'gssh';
    }

    function isGAIP() {
        return global.GILBA_PLUGIN_NS === 'gaip' || !isGSSH();
    }

    /**
     * Returns the authoritative site/venue ID for the current page and mode.
     *
     * On GSSH pages: returns the selected venue ID from GSSH_UnifiedVenueSelector.
     * On GAIP pages: returns the active site ID from GAIP_SampleManager.
     * Falls back through GAIP_STATE.site.id if SampleManager unavailable.
     * Returns null if no site can be determined.
     */
    function getSiteId() {
        // GSSH path — venue selector is authoritative
        if (isGSSH()) {
            var uvs = global.GSSH_UnifiedVenueSelector;
            if (uvs && typeof uvs.getCurrentVenueId === 'function') {
                var venueId = uvs.getCurrentVenueId();
                if (venueId) return venueId;
            }
            // GSSH fallback: URL param (venue not yet selected via selector)
            if (global.location && global.location.search) {
                var m = global.location.search.match(/gssh_venue=([^&]+)/);
                if (m && m[1]) return m[1];
            }
        }

        // GAIP path — SampleManager is authoritative
        var SM = global.GAIP_SampleManager;
        if (SM && typeof SM.getActiveSiteId === 'function') {
            var smId = SM.getActiveSiteId();
            if (smId) return smId;
        }

        // Last resort: canonical state
        if (global.GAIP_STATE && global.GAIP_STATE.site && global.GAIP_STATE.site.id) {
            return global.GAIP_STATE.site.id;
        }

        return null;
    }

    /**
     * Returns a human-readable label for the current site/venue.
     */
    function getSiteLabel() {
        if (isGSSH()) {
            var uvs = global.GSSH_UnifiedVenueSelector;
            if (uvs && typeof uvs.getCurrentVenueName === 'function') {
                return uvs.getCurrentVenueName() || getSiteId();
            }
        }
        var SM = global.GAIP_SampleManager;
        if (SM && typeof SM.getActiveSiteLabel === 'function') {
            return SM.getActiveSiteLabel() || getSiteId();
        }
        return getSiteId();
    }

    global.GAIP_SiteContext = {
        version:      '1.0.0',
        getSiteId:    getSiteId,
        getSiteLabel: getSiteLabel,
        isGSSH:       isGSSH,
        isGAIP:       isGAIP,
    };

    console.log('[GAIP_SiteContext] v1.0.0 loaded, mode:', global.GILBA_PLUGIN_NS || 'unknown');

})(typeof window !== 'undefined' ? window : this);
