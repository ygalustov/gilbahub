/**
 * =============================================================================
 * Gilba Hub — Site ↔ Profile Bridge
 * =============================================================================
 * 
 * Problem:
 *   Three independent storage systems exist:
 *   1. SiteSelectorUI (top bar) — saves sites via WP backend + SampleManager
 *   2. SiteConfigPersistence — saves turf config per siteId in localStorage
 *      key: 'gilba_hub_site_configs'
 *   3. TurfProfileController — saves named profiles in localStorage
 *      key: 'gaip_turf_profiles'
 *
 *   When a user saves "Christchurch Golf Club" via the Site Selector top bar,
 *   TurfProfileController's Saved Profiles dropdown never gets updated.
 *   The Site Settings modal reads from TurfProfileController, so the site
 *   name never appears there.
 *
 * Fix:
 *   This bridge listens for site save/switch events and ensures:
 *   a) When a site is saved via the top bar "Save Site", a matching profile
 *      is created/updated in TurfProfileController's store
 *   b) When SiteConfigPersistence restores a config on site switch, the
 *      Saved Profiles dropdown is refreshed
 *   c) The Site Settings panel dropdown stays in sync
 *
 * Dependencies: site-selector-ui.js, site-config-persistence.js,
 *               turf-profile-controller.js, site-settings-panel.js (optional)
 * @version 1.0.0
 * =============================================================================
 */
(function(global) {
    'use strict';

    var VERSION = '1.1.0';
    var TURF_PROFILES_KEY = 'gaip_turf_profiles';
    var SITE_CONFIGS_KEY  = 'gilba_hub_site_configs';
    var DELETED_PROFILES_KEY = 'gilba_hub_deleted_profiles';
    var DEBUG = false;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log() {
        if (!DEBUG) return;
        var args = ['[ProfileBridge]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function warn() {
        var args = ['[ProfileBridge]'].concat(Array.prototype.slice.call(arguments));
        console.warn.apply(console, args);
    }

    // =========================================================================
    // STORAGE HELPERS
    // =========================================================================

    /**
     * Read TurfProfileController's saved profiles from localStorage
     */
    function getTurfProfiles() {
        try {
            var raw = localStorage.getItem(TURF_PROFILES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            warn('Failed to read turf profiles:', e);
            return {};
        }
    }

    /**
     * Write TurfProfileController's saved profiles to localStorage
     */
    function setTurfProfiles(profiles) {
        try {
            localStorage.setItem(TURF_PROFILES_KEY, JSON.stringify(profiles));
            return true;
        } catch (e) {
            warn('Failed to write turf profiles:', e);
            return false;
        }
    }

    /**
     * Read SiteConfigPersistence's configs from localStorage
     */
    function getSiteConfigs() {
        try {
            var raw = localStorage.getItem(SITE_CONFIGS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            warn('Failed to read site configs:', e);
            return {};
        }
    }

    /**
     * Track profiles the user explicitly deleted (so backfill doesn't recreate them)
     */
    function getDeletedProfiles() {
        try {
            var raw = localStorage.getItem(DELETED_PROFILES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function markProfileDeleted(name) {
        var deleted = getDeletedProfiles();
        deleted[name] = Date.now();
        try { localStorage.setItem(DELETED_PROFILES_KEY, JSON.stringify(deleted)); } catch(e) {}
    }

    function wasExplicitlyDeleted(name) {
        var deleted = getDeletedProfiles();
        return !!deleted[name];
    }

    function unmarkDeleted(name) {
        var deleted = getDeletedProfiles();
        if (deleted[name]) {
            delete deleted[name];
            try { localStorage.setItem(DELETED_PROFILES_KEY, JSON.stringify(deleted)); } catch(e) {}
        }
    }

    /**
     * Get the current site name from SampleManager or SiteSelector
     */
    function getCurrentSiteName() {
        // Try SampleManager public API
        var sm = global.GAIP_SampleManager;
        if (sm) {
            var label = sm.getActiveSiteLabel ? sm.getActiveSiteLabel() : null;
            if (label && label !== 'default' && label !== 'Default Site') {
                return label;
            }
        }

        // Try reading from the site selector dropdown
        var dropdown = document.querySelector('.gaip-site-select, #gaip-site-dropdown');
        if (dropdown && dropdown.options && dropdown.selectedIndex >= 0) {
            return dropdown.options[dropdown.selectedIndex].text || '';
        }

        return '';
    }

    /**
     * Get the current site ID from SampleManager
     */
    function getCurrentSiteId() {
        var sm = global.GAIP_SampleManager;
        if (sm && sm.getActiveSiteId) return sm.getActiveSiteId();
        return 'default';
    }

    /**
     * Snapshot the current turf profile state from DOM or GaipTurfProfile
     */
    function snapshotTurfState() {
        var tp = global.GaipTurfProfile;

        // Capture location regardless of which path we take
        var latEl = document.querySelector('.gaip-lat');
        var lonEl = document.querySelector('.gaip-lon');
        var nameEl = document.getElementById('gaip-location-search');
        var location = {
            lat: latEl ? parseFloat(latEl.value) || null : null,
            lon: lonEl ? parseFloat(lonEl.value) || null : null,
            name: nameEl ? nameEl.value || '' : ''
        };

        if (tp && tp.state) {
            return {
                turfType:     tp.state.turfType     || '',
                subCategory:  tp.state.subCategory  || '',
                species:      tp.state.species       || '',
                variety:      tp.state.variety        || '',
                construction: tp.state.construction   || '',
                drainage:     tp.state.drainage       || '',
                hoc:          tp.state.hoc            || '',
                nProgram:     tp.state.nProgram       || '',
                methodology:  tp.state.methodology    || '',
                overseed:     tp.state.overseed       || false,
                location:     location,
                savedAt:      new Date().toISOString()
            };
        }

        // Fallback: read from DOM
        function domVal(sel) {
            var el = document.querySelector(sel);
            return el ? (el.value || '') : '';
        }

        return {
            turfType:     domVal('.gaip-turf-type'),
            subCategory:  domVal('.gaip-sub-category'),
            species:      domVal('.gaip-species'),
            variety:      domVal('.gaip-variety'),
            construction: domVal('.gaip-construction'),
            drainage:     domVal('.gaip-drainage'),
            hoc:          domVal('.gaip-hoc'),
            nProgram:     domVal('.gaip-n-program'),
            methodology:  domVal('[name="soil-methodology"]:checked') ||
                          domVal('.gaip-methodology'),
            overseed:     false,
            location:     location,
            savedAt:      new Date().toISOString()
        };
    }

    // =========================================================================
    // PROFILE SYNC
    // =========================================================================

    /**
     * Create or update a named profile in TurfProfileController's store
     * using the current turf state. This is the core bridge function.
     */
    function syncSiteToProfile(siteName, siteId) {
        if (!siteName || siteName === '-- Saved Profiles --') return;

        // Don't snapshot during page-load site-config restore — turf state is stale/transitional
        if (global.GAIP_SITE_CONFIG_PENDING === true) {
            log('Skipping sync for "' + siteName + '" — site-config restore pending');
            return;
        }
        // Also check the public API if available
        if (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.isRestoring === 'function' &&
            global.GAIP_SiteConfig.isRestoring()) {
            log('Skipping sync for "' + siteName + '" — site-config isRestoring()');
            return;
        }

        // Don't recreate profiles the user explicitly deleted
        if (wasExplicitlyDeleted(siteName)) {
            log('Skipping sync for "' + siteName + '" — user deleted this profile');
            return;
        }

        var profiles = getTurfProfiles();
        var state = snapshotTurfState();

        // Store with the site name as key (what the user sees)
        state._siteId = siteId || getCurrentSiteId();
        profiles[siteName] = state;

        if (setTurfProfiles(profiles)) {
            log('Synced site "' + siteName + '" → Saved Profiles');
            refreshProfileDropdowns();
        }
    }

    /**
     * Sync ALL known sites from SiteConfigPersistence into TurfProfileController
     * Called on init to backfill any sites that were created before this bridge existed.
     */
    function syncAllSitesToProfiles() {
        var siteConfigs = getSiteConfigs();
        var profiles = getTurfProfiles();
        var sm = global.GAIP_SampleManager;
        var synced = 0;

        // Build a siteId → displayName map from SampleManager
        var nameMap = {};
        if (sm && sm.getSiteList) {
            var siteList = sm.getSiteList();
            for (var s = 0; s < siteList.length; s++) {
                nameMap[siteList[s].id] = siteList[s].label;
            }
        }

        // Also check the site selector dropdown for display names
        var opts = document.querySelectorAll('.gaip-site-select option, #gaip-site-dropdown option');
        for (var i = 0; i < opts.length; i++) {
            var opt = opts[i];
            if (opt.value && opt.text) {
                nameMap[opt.value] = opt.text;
            }
        }

        // For each siteConfig, ensure a matching profile exists
        for (var siteId in siteConfigs) {
            if (!siteConfigs.hasOwnProperty(siteId)) continue;

            var config = siteConfigs[siteId];
            var displayName = nameMap[siteId] || siteId;

            // Don't recreate profiles the user explicitly deleted
            if (wasExplicitlyDeleted(displayName)) continue;

            // Backfill-only: never overwrite an existing profile.
            // Profiles are written by explicit user saves or syncSiteToProfile (guarded).
            // Overwriting here risks poisoning correct profiles with stale siteConfig data.
            if (profiles[displayName]) {
                continue;
            }

            // Build profile from siteConfig
            var turf = config.turf || config;
            profiles[displayName] = {
                turfType:     turf.turfType     || '',
                subCategory:  turf.subCategory  || '',
                species:      turf.species       || '',
                variety:      turf.variety        || '',
                construction: turf.construction   || '',
                drainage:     turf.drainage       || '',
                hoc:          turf.hoc            || '',
                nProgram:     turf.nProgram       || '',
                methodology:  turf.methodology    || '',
                overseed:     turf.overseed       || false,
                _siteId:      siteId,
                savedAt:      config.savedAt || new Date().toISOString()
            };
            synced++;
        }

        if (synced > 0) {
            setTurfProfiles(profiles);
            log('Backfilled', synced, 'site(s) into Saved Profiles');
            refreshProfileDropdowns();
        }
    }

    // =========================================================================
    // DROPDOWN REFRESH
    // =========================================================================

    /**
     * Refresh both the Turf Profile card dropdown and the Site Settings panel dropdown
     */
    function refreshProfileDropdowns() {
        var profiles = getTurfProfiles();
        var names = Object.keys(profiles).sort();

        // 1. Turf Profile card dropdown (real DOM select)
        refreshDropdown(
            document.getElementById('gaip-profile-select'),
            names
        );

        // 2. Site Settings panel dropdown (slide-over)
        refreshDropdown(
            document.getElementById('gaip-sp-profile-select'),
            names
        );

        // 3. If TurfProfileController has an updateProfileSelect method, call it
        var tp = global.GaipTurfProfile;
        if (tp && typeof tp.updateProfileSelect === 'function') {
            try { tp.updateProfileSelect(); } catch (e) { /* ignore */ }
        }

        log('Refreshed profile dropdowns with', names.length, 'profiles');
    }

    function refreshDropdown(select, names) {
        if (!select) return;

        var currentVal = select.value;

        select.innerHTML = '<option value="">-- Saved Profiles --</option>';
        for (var i = 0; i < names.length; i++) {
            var opt = document.createElement('option');
            opt.value = names[i];
            opt.textContent = names[i];
            select.appendChild(opt);
        }

        // Restore previous selection if still present
        if (currentVal) {
            select.value = currentVal;
        }
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    function init() {
        log('v' + VERSION + ' initializing');

        // =====================================================================
        // 1. Listen for "Save Site" clicks on the top bar
        // =====================================================================
        // The SiteSelectorUI fires a custom event or we can intercept the button
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('.gaip-save-site-btn, .gaip-site-save-btn, .gaip-site-save, .gaip-site-btn-save, [data-action="save-site"]');
            // Also match by button text content as fallback
            if (!btn && e.target.tagName === 'BUTTON' && e.target.textContent.indexOf('Save Site') !== -1) {
                btn = e.target;
            }
            if (!btn) return;

            // Delay slightly to let SiteSelectorUI finish its save
            setTimeout(function() {
                var siteName = getCurrentSiteName();
                var siteId   = getCurrentSiteId();
                if (siteName) {
                    syncSiteToProfile(siteName, siteId);
                }
            }, 500);
        });

        // =====================================================================
        // 2. Listen for site switch events (from site-config-persistence.js)
        // =====================================================================
        document.addEventListener('gaip:site-config-applied', function() {
            // After a site config is restored, refresh the dropdowns
            setTimeout(refreshProfileDropdowns, 300);
        });

        // =====================================================================
        // 3. Listen for site changed events (kebab-case, from sample-manager.js)
        // =====================================================================
        document.addEventListener('gaip:site-changed', function(e) {
            var detail = e.detail || {};
            // When arriving at a site, sync its current state to profiles
            setTimeout(function() {
                var siteName = detail.label || getCurrentSiteName();
                var siteId   = detail.siteId || getCurrentSiteId();
                if (siteName) {
                    syncSiteToProfile(siteName, siteId);
                }
            }, 1000); // Wait for config restore to complete
        });

        // =====================================================================
        // 4. Listen for turf profile changes and auto-update the active site's profile
        // =====================================================================
        document.addEventListener('gaip:turf-profile-change', function() {
            // Don't snapshot during page-load restore — state is transitional
            if (global.GAIP_SITE_CONFIG_PENDING === true) return;
            if (global.GAIP_SiteConfig && typeof global.GAIP_SiteConfig.isRestoring === 'function' &&
                global.GAIP_SiteConfig.isRestoring()) return;
            var siteName = getCurrentSiteName();
            if (siteName) {
                syncSiteToProfile(siteName, getCurrentSiteId());
            }
        });

        // =====================================================================
        // 5. Listen for site create/add events (kebab-case)
        // =====================================================================
        document.addEventListener('gaip:site-added', function(e) {
            var detail = e.detail || {};
            var name = detail.label || detail.siteName || '';
            var id   = detail.siteId || '';
            if (name) {
                // User explicitly created this site, so allow syncing even if previously deleted
                unmarkDeleted(name);
                setTimeout(function() {
                    syncSiteToProfile(name, id);
                }, 500);
            }
        });

        // =====================================================================
        // 5b. Remove profile when site is deleted
        // =====================================================================
        document.addEventListener('gaip:site-removed', function(e) {
            var detail = e.detail || {};
            var siteId = detail.siteId;
            if (!siteId) return;

            var profiles = getTurfProfiles();
            var removed = 0;
            
            // Find and remove profile(s) matching this siteId
            for (var name in profiles) {
                if (profiles.hasOwnProperty(name) && profiles[name]._siteId === siteId) {
                    log('Removing profile "' + name + '" for deleted site:', siteId);
                    delete profiles[name];
                    markProfileDeleted(name);
                    removed++;
                }
            }
            
            if (removed > 0) {
                setTurfProfiles(profiles);
                refreshProfileDropdowns();
                log('Removed', removed, 'profile(s) for deleted site:', siteId);
            }
        });

        // =====================================================================
        // 5c. Track when user explicitly deletes a profile via UI
        // =====================================================================
        document.addEventListener('gaip:profile-deleted', function(e) {
            var detail = e.detail || {};
            var profileName = detail.profileName;
            if (profileName) {
                markProfileDeleted(profileName);
                log('Tracked explicit deletion of profile:', profileName);
                refreshProfileDropdowns();
            }
        });

        // =====================================================================
        // 6. On init, backfill any existing sites that predate this bridge
        //    AND remove orphaned profiles whose sites no longer exist
        // =====================================================================
        setTimeout(function() {
            syncAllSitesToProfiles();
            
            // Clean up orphaned profiles (profiles whose _siteId no longer exists)
            var sm = global.GAIP_SampleManager;
            if (sm && sm.getSiteList) {
                var siteList = sm.getSiteList();
                var siteIds = {};
                for (var i = 0; i < siteList.length; i++) {
                    siteIds[siteList[i].id] = true;
                }
                
                var profiles = getTurfProfiles();
                var orphaned = 0;
                for (var name in profiles) {
                    if (profiles.hasOwnProperty(name) && profiles[name]._siteId) {
                        if (!siteIds[profiles[name]._siteId]) {
                            log('Removing orphaned profile "' + name + '" (site ' + profiles[name]._siteId + ' no longer exists)');
                            delete profiles[name];
                            orphaned++;
                        }
                    }
                }
                if (orphaned > 0) {
                    setTurfProfiles(profiles);
                    refreshProfileDropdowns();
                    log('Cleaned up', orphaned, 'orphaned profile(s)');
                }
            }
        }, 3000); // Wait for all systems to settle

        log('v' + VERSION + ' ready — bridging Site Selector ↔ Saved Profiles');
    }

    // =========================================================================
    // EXPOSE API
    // =========================================================================

    global.GilbaProfileBridge = {
        version: VERSION,
        syncSiteToProfile: syncSiteToProfile,
        syncAllSitesToProfiles: syncAllSitesToProfiles,
        refreshProfileDropdowns: refreshProfileDropdowns,
        getCurrentSiteName: getCurrentSiteName
    };

    // =========================================================================
    // BOOT
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 1500);
        });
    } else {
        setTimeout(init, 1500);
    }

})(window);
