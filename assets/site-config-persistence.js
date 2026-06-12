/**
 * =============================================================================
 * GILBA SITE CONFIG PERSISTENCE v1.0.0
 * =============================================================================
 *
 * Saves and restores per-site configuration (turf profile, location, climate
 * settings) when the user switches between sites. Without this, switching sites
 * only changes the soil/water/tissue samples but leaves the turf type, species,
 * variety, HOC, etc. stuck on the previous site's settings.
 *
 * Architecture:
 *   - Hooks into gaip:siteChanged (dispatched AFTER _currentSite updates)
 *   - BEFORE the switch: snapshots current turf/location config
 *   - AFTER the switch: restores the target site's saved config (if any)
 *   - Persists via localStorage alongside existing hub state
 *
 * Storage key: gilba_hub_site_configs
 * Structure:  { siteId: { turf: {...}, location: {...}, savedAt: ISO } }
 *
 * Dependencies: site-selector-ui.js, sample-manager.js
 * Optional:     turf-profile-controller.js (GaipTurfProfile),
 *               site-settings-panel.js (for snapshot/restore patterns)
 * =============================================================================
 */
(function(global) {
    'use strict';

    // b35fix274: namespaced storage adapter — all reads/writes go through this
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;

    // Set immediately at script-parse time — before TurfProfile.init() runs.
    // TurfProfile.loadProfile() checks this flag and skips applying species/identity
    // if site-config-persistence is about to restore the correct per-site species.
    // Cleared after the page-load restore cascade completes.
    global.GAIP_SITE_CONFIG_PENDING = true;

    var VERSION = '1.0.0';
    var STORAGE_KEY = 'gilba_hub_site_configs';
    var DEBUG = false;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log() {
        if (!DEBUG) return;
        var args = ['[SiteConfig]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function warn() {
        var args = ['[SiteConfig]'].concat(Array.prototype.slice.call(arguments));
        console.warn.apply(console, args);
    }

    function getApiBaseUrl() {
        var cfg = global.GAIP_HUB_CONFIG || global.GAIP_FIELD_LOG_CONFIG || {};
        return cfg.restUrl || '/api/';
    }

    function getCsrfToken() {
        var cfg = global.GAIP_HUB_CONFIG || global.GAIP_FIELD_LOG_CONFIG || {};
        return cfg.csrfToken || cfg.restNonce || cfg.nonce || '';
    }

    function apiFetchJson(url, options) {
        var headers = Object.assign({
            'Accept': 'application/json'
        }, (options && options.headers) || {});
        var token = getCsrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;

        return fetch(url, Object.assign({ credentials: 'same-origin', headers: headers }, options || {}))
            .then(function(r) {
                return r.text().then(function(text) {
                    var data = null;
                    if (text) {
                        try {
                            data = JSON.parse(text);
                        } catch (_e) {
                            data = null;
                        }
                    }
                    if (!r.ok) {
                        var err = new Error((data && data.message) || (text && text.trim().slice(0, 160)) || ('HTTP ' + r.status));
                        err.status = r.status;
                        err.responseText = text;
                        throw err;
                    }
                    return data || {};
                });
            });
    }

    function getLiveSiteIdMap() {
        var live = { 'default': true };
        var SM = global.GAIP_SampleManager;
        var siteList = SM && typeof SM.getSiteList === 'function' ? SM.getSiteList() : [];
        for (var i = 0; i < siteList.length; i++) {
            if (siteList[i] && siteList[i].id) {
                live[siteList[i].id] = true;
            }
        }
        return live;
    }

    function pruneConfigKeys(liveSiteIds) {
        if (!liveSiteIds) return 0;
        var pruned = 0;
        Object.keys(_configs).forEach(function(siteId) {
            if (siteId !== 'default' && !liveSiteIds[siteId]) {
                delete _configs[siteId];
                pruned++;
            }
        });
        if (pruned > 0) {
            saveToStorage();
            log('Pruned stale site config key(s):', pruned);
        }
        return pruned;
    }

    function syncSiteRegistryToServer(siteIds) {
        var base = getApiBaseUrl();
        var SM = global.GAIP_SampleManager;
        if (!base || typeof fetch === 'undefined' || !SM || !siteIds || !siteIds.length) {
            return Promise.resolve(false);
        }

        var siteList = typeof SM.getSiteList === 'function' ? SM.getSiteList() : [];
        var byId = {};
        for (var i = 0; i < siteList.length; i++) {
            if (siteList[i] && siteList[i].id) byId[siteList[i].id] = siteList[i];
        }

        var payloadSites = {};
        siteIds.forEach(function(siteId) {
            if (siteId === 'default') return;
            var site = byId[siteId];
            if (!site) return;
            var _rawLabel = site.label || site.name || '';
            payloadSites[siteId] = {
                label: _rawLabel === siteId ? '' : _rawLabel
            };
        });

        if (Object.keys(payloadSites).length === 0) {
            return Promise.resolve(false);
        }

        return apiFetchJson(base.replace(/\/?$/, '/') + 'sites/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sites: payloadSites })
        }).then(function() {
            return true;
        });
    }

    function saveLocationToServer(siteId, location) {
        // DB is the source of truth for coordinates. Never overwrite from localStorage
        // when running inside a re-run iframe — the iframe restores stale localStorage
        // values that may differ from what the user saved via the new hub's site-setup-wizard.
        if (window.parent !== window) return;
        var base = getApiBaseUrl();
        if (!base || !siteId || siteId === 'default' || !location || !location.lat || !location.lon || typeof fetch === 'undefined') {
            return;
        }

        apiFetchJson(base.replace(/\/?$/, '/') + 'sites/' + encodeURIComponent(siteId), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location_name: location.name || '',
                latitude: location.lat,
                longitude: location.lon
            })
        }).catch(function(err) {
            warn('Location sync failed:', err.message);
        });
    }

    // =========================================================================
    // STORAGE
    // =========================================================================

    var _configs = {};  // { siteId: { turf, location, savedAt } }
    var _previousSiteId = null;

    function loadFromStorage() {
        try {
            var raw = _ls.getItem(STORAGE_KEY);
            if (raw) {
                _configs = JSON.parse(raw);
                log('Loaded configs for', Object.keys(_configs).length, 'sites');
            }
        } catch (e) {
            warn('Failed to load site configs:', e);
            _configs = {};
        }
    }

    // b35fix268: One-time cleanup — remove corrupted location.name values caused by
    // GSSH venue ID bleed into GAIP site configs (race condition in gaip:turf-profile-change).
    // Symptom: all GAIP site cards showing "Campbelltown Stadium, Pembroke Road".
    // Strategy: for each site config, if location.name contains a known bleed value
    // AND the site ID does not match that venue, clear the location name.
    // The user will re-enter correct addresses; lat/lon (used for weather) are preserved.
    // Keyed by a localStorage flag so it runs once per device.
    function _cleanupLocationBleed() {
        var cleanupKey = 'gilba_location_bleed_cleanup_b35fix268';
        try {
            if (_ls.getItem(cleanupKey)) return;
            var BLEED_STRINGS = [
                'campbelltown', 'pembroke road', 'gtech community', 'brentford community'
            ];
            var cleaned = 0;
            Object.keys(_configs).forEach(function(siteId) {
                var cfg = _configs[siteId];
                if (!cfg || !cfg.location || !cfg.location.name) return;
                var nameLower = cfg.location.name.toLowerCase();
                var isBleed = BLEED_STRINGS.some(function(s) { return nameLower.indexOf(s) !== -1; });
                // Only clear if the site ID doesn't match the bleed source
                var siteIdLower = siteId.toLowerCase();
                var isOwner = BLEED_STRINGS.some(function(s) { return siteIdLower.indexOf(s.split(' ')[0]) !== -1; });
                if (isBleed && !isOwner) {
                    log('b35fix268: clearing corrupted location.name for', siteId, '(was:', cfg.location.name + ')');
                    cfg.location.name = '';
                    cleaned++;
                }
            });
            if (cleaned > 0) {
                saveToStorage();
                log('b35fix268: location bleed cleanup — cleared', cleaned, 'corrupted site configs');
            }
            _ls.setItem(cleanupKey, '1');
        } catch(e) {
            warn('b35fix268: location bleed cleanup failed:', e);
        }
    }

    function saveToStorage() {
        try {
            _ls.setItem(STORAGE_KEY, JSON.stringify(_configs));
        } catch (e) {
            warn('Failed to save site configs:', e);
        }
    }

    // =========================================================================
    // SERVER SYNC — push/pull full site configs to/from Laravel/MySQL
    // Enables cross-device species and profile consistency.
    // Push: called after every saveToStorage().
    // Pull: called once on init when localStorage is empty or stale.
    // =========================================================================

    var _serverSyncPending = false;
    var _serverSyncTimer = null;
    // b35fix179a: companion species value to apply once #gaip-companion-species
    // exists. Set by restoreConfig() when the element is absent at restore time
    // (element is injected by daily-dashboard after orchestrator-complete, which
    // fires after the 300ms site-switch restore window).
    var _pendingCompanionRestore = null;

    /**
     * Push current _configs to server (debounced 2s to batch rapid switches).
     */
    function pushConfigsToServer() {
        // Never push from an iframe context — the parent page owns the authoritative
        // localStorage and server state. Pushing from an iframe (e.g. post-import
        // analysis trigger) causes location bleed: all sites get the active site's
        // location overwritten in the DB.
        if (window !== window.top) return;
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') return;
        if (Object.keys(_configs).length === 0) return;

        clearTimeout(_serverSyncTimer);
        _serverSyncTimer = setTimeout(function() {
            var liveSiteIds = getLiveSiteIdMap();
            pruneConfigKeys(liveSiteIds);

            var keys = Object.keys(_configs).filter(function(siteId) {
                return siteId && siteId !== 'default' && _configs[siteId];
            }).filter(function(siteId) {
                return !!liveSiteIds[siteId];
            });
            if (keys.length === 0) return;

            syncSiteRegistryToServer(keys)
            .then(function() {
                return Promise.all(keys.map(function(siteId) {
                    return apiFetchJson(base.replace(/\/?$/, '/') + 'sites/' + encodeURIComponent(siteId) + '/config/gaip', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ config: _configs[siteId] })
                    });
                }));
            })
                .then(function() {
                    log('Site configs synced to MySQL (' + keys.length + ' sites)');
                })
                .catch(function(err) {
                    warn('Server config sync failed:', err.message);
                });
        }, 2000);
    }

    /**
     * Pull site configs from server and merge into localStorage.
     * Server wins for turf identity fields (species, turfType, variety, subCategory).
     * Called once on init when localStorage has no configs or is missing a site.
     * @param {function} onComplete  called when done
     */
    function pullConfigsFromServer(onComplete) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') {
            if (onComplete) onComplete(false);
            return;
        }

        apiFetchJson(base.replace(/\/?$/, '/') + 'sites')
            .then(function(data) {
                var rows = (data && data.data) || [];
                if (!rows.length) {
                    if (onComplete) onComplete(false);
                    return;
                }

                var serverConfigs = {};
                rows.forEach(function(site) {
                    var config = site && site.configs && site.configs.gaip && site.configs.gaip.config;
                    if (site && site.id && config) serverConfigs[site.id] = config;
                });

                var count = Object.keys(serverConfigs).length;
                if (count === 0) {
                    if (onComplete) onComplete(false);
                    return;
                }

                var identityFields = ['turfType', 'subCategory', 'species', 'variety', 'grassSpecies', 'companionSpecies'];
                var merged = 0;
                Object.keys(serverConfigs).forEach(function(siteId) {
                    var serverCfg = serverConfigs[siteId];
                    if (!serverCfg || !serverCfg.turf) return;
                    if (!_configs[siteId]) {
                        // Site not in localStorage at all — take server version wholesale
                        _configs[siteId] = serverCfg;
                        merged++;
                    } else {
                        // Site exists locally — server wins for identity fields only
                        var local = _configs[siteId];
                        var serverSavedAt = serverCfg.savedAt ? new Date(serverCfg.savedAt).getTime() : 0;
                        var localSavedAt  = local.savedAt     ? new Date(local.savedAt).getTime()     : 0;
                        if (serverSavedAt > localSavedAt) {
                            // Server is newer — overwrite identity fields
                            identityFields.forEach(function(f) {
                                if (serverCfg.turf[f] !== undefined) {
                                    local.turf[f] = serverCfg.turf[f];
                                }
                            });
                            merged++;
                        }
                    }
                });

                if (merged > 0) {
                    saveToStorage();
                    log('Pulled ' + merged + ' updated site configs from server');
                }
                if (onComplete) onComplete(merged > 0);
            })
            .catch(function() {
                if (onComplete) onComplete(false);
            });
    }

    // =========================================================================
    // DOM HELPERS
    // =========================================================================

    function domVal(selector) {
        var el = document.querySelector(selector);
        return el ? (el.value || '') : '';
    }

    function setDomVal(selector, value) {
        var el = document.querySelector(selector);
        if (!el || value === undefined || value === null) return false;
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function isChecked(selector) {
        var el = document.querySelector(selector);
        return el ? el.checked : false;
    }

    function setChecked(selector, val) {
        var el = document.querySelector(selector);
        if (!el) return;
        el.checked = !!val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // =========================================================================
    // SNAPSHOT: capture current turf + location config from DOM
    // =========================================================================

    function snapshotConfig() {
        var tp = global.GaipTurfProfile;
        var tpState = (tp && tp.state) ? tp.state : {};

        var turf = {
            turfType:       tpState.turfType || getSelectedTurfType(),
            subCategory:    tpState.subCategory || getSelectedSubCategory(),
            species:        domVal('.gaip-species'),
            variety:        domVal('.gaip-variety'),
            construction:   domVal('.gaip-construction'),
            drainage:       domVal('.gaip-drainage'),
            hoc:            domVal('.gaip-hoc'),
            nProgram:       domVal('.gaip-n-program'),
            methodology:    domVal('.gaip-soil-methodology'),
            overseedSpecies:  domVal('.gaip-cool-overseed'),
            overseedVariety:  domVal('.gaip-overseed-variety'),
            overseedStatus:   domVal('.gaip-overseed-status'),
            summerIntent:     domVal('.gaip-overseed-summer-intent'),
            c3Cover:          domVal('.gaip-c3-cover'),
            yearsEstablished: domVal('.gaip-years-established'),
            thatchDepth:      domVal('.gaip-thatch-depth'),
            winterMinTemp:    domVal('.gaip-winter-min-temp'),
            poaPercent:       domVal('.gaip-poa-percent'),
            aaTexture:        domVal('.gaip-aa-soil-texture'),
            // Traffic/wear settings
            trafficEnabled:   isChecked('.gaip-enable-turf-traffic'),
            trafficLevel:     domVal('.gaip-traffic-level'),
            eventsPerWeek:    domVal('.gaip-events-per-week'),
            // Companion surface (golf greens only — fairway/tee species for parallel disease analysis)
            // b35fix230: Only snapshot if element exists — selector is injected 350ms after
            // gaip:analysis-complete, so it's absent on the first auto-save. Don't overwrite
            // a previously saved value with empty string when the element hasn't rendered yet.
            companionSpecies: document.getElementById('gaip-companion-species')
              ? (domVal('#gaip-companion-species') || '')
              : undefined
        };

        var location = {
            lat:  parseFloat(domVal('.gaip-lat')) || null,
            lon:  parseFloat(domVal('.gaip-lon')) || null,
            name: (document.getElementById('gaip-location-search') || {}).value || ''
        };

        // b35fix210: PGR product, date, and rate are owned by the spray log cascade —
        // site-config-persistence must not snapshot or restore them. The spray log
        // is the authoritative record of what was applied. Persisting DOM values here
        // caused stale product codes (e.g. PBZ200 from a testing session) to survive
        // indefinitely and override correct spray log autofill on every page load.
        // Only GDD threshold override and base temp are persisted here (user settings,
        // not application records). enabled flag retained for the checkbox UI.
        var pgrEnabled = isChecked('.gaip-enable-pgr');
        var SM_snap = global.GAIP_SampleManager;
        var _snapSiteId = SM_snap && typeof SM_snap.getActiveSiteId === 'function'
            ? SM_snap.getActiveSiteId() : null;
        var pgr = {
            enabled:         pgrEnabled,
            productType:     null,          // NOT persisted — spray log owns this
            applicationDate: null,          // NOT persisted — spray log owns this
            rateLperHa:      null,          // NOT persisted — spray log owns this
            // Persist GDD threshold override only if user has manually entered one
            gddThreshold:    domVal('.gaip-pgr-gdd') || null,
            _savedForSite:   _snapSiteId || null
        };

        // Preserve settings-form fields that have no hub DOM element.
        // Without this, every hub analysis sync erases them from the DB.
        (function () {
            var SM_p = global.GAIP_SampleManager;
            var _pSiteId = SM_p && typeof SM_p.getActiveSiteId === 'function' ? SM_p.getActiveSiteId() : null;
            var _pExisting = (_pSiteId && _configs[_pSiteId] && _configs[_pSiteId].turf) || {};
            if (_pExisting.warmBase)    turf.warmBase    = _pExisting.warmBase;
            if (_pExisting.coolOverseed && !turf.coolOverseed) turf.coolOverseed = _pExisting.coolOverseed;
        })();

        return {
            turf: turf,
            location: location,
            pgr: pgr,
            // b35fix369: carry the multi-site turf toggle through snapshotConfig
            // so saveCurrentSiteConfig's `_configs[siteId] = freshSnap` rewrite
            // doesn't wipe it. Reads from the existing _configs entry of the
            // active site (the toggle is set via setMultiSiteTurfEnabled and
            // lives at top-level on the config — it's never rebuilt from DOM).
            //
            // Asymmetric-writers class: the setter wrote to _configs[siteId],
            // but the saveCurrentSiteConfig path REPLACED _configs[siteId]
            // with a fresh shape that didn't include the field. Two writers,
            // mismatched shapes — pre-b35fix369 the second writer silently
            // dropped the flag every time the user switched sites or any
            // code triggered a snapshot.
            multiSiteTurf: (function () {
                var SM_snap2 = global.GAIP_SampleManager;
                var siteId = SM_snap2 && typeof SM_snap2.getActiveSiteId === 'function'
                    ? SM_snap2.getActiveSiteId() : null;
                if (!siteId) return false;
                var existing = _configs[siteId];
                return !!(existing && existing.multiSiteTurf === true);
            })(),
            savedAt: new Date().toISOString()
        };
    }

    function getSelectedTurfType() {
        var selected = document.querySelector('.gaip-turf-type-option.selected, .gaip-turf-type-option.active');
        return selected ? (selected.dataset.type || '') : '';
    }

    function getSelectedSubCategory() {
        var selected = document.querySelector('.gaip-subcategory-option.selected, .gaip-subcategory-option.active');
        return selected ? (selected.dataset.surface || selected.dataset.sport || '') : '';
    }

    // =========================================================================
    // RESTORE: apply saved config to DOM
    // =========================================================================

    function restoreConfig(config) {
        if (!config) return;
        _isRestoring = true;

        var turf = config.turf || {};
        var location = config.location || {};
        var tp = global.GaipTurfProfile;

        // b35fix154b: On GSSH venue pages the venue selector is the authoritative
        // source for turfType and species — the saved GAIP site config (which may
        // have been saved with wrong turfType, e.g. 'lawns') must not overwrite it.
        // Skip only the turf identity restore (turfType/species/variety).
        // Location, water, soil, and other config are unaffected.
        var _isGSSHPage = !!(
            document.getElementById('gssh-venue-readiness') ||
            (global.location && global.location.search && global.location.search.indexOf('gssh_venue') !== -1)
        );
        var skipTurfIdentity = _isGSSHPage;
        if (_isGSSHPage) {
            log('GSSH page — skipping turf identity restore (venue selector is authority)');
        }

        // --- Restore turf type (triggers species dropdown population) ---
        if (!skipTurfIdentity && turf.turfType && tp) {
            tp.selectTurfType(turf.turfType);

            // Bowls/cotula: fire handleBowlsSelection to restore AA methodology,
            // species, and GAIP_STATE.turf.cotula flag
            if (turf.turfType === 'bowls' && global.GAIP_CotulaBowling) {
                global.GAIP_CotulaBowling.handleBowlsSelection();
            } else if (turf.turfType !== 'bowls' && global.GAIP_CotulaBowling
                       && typeof global.GAIP_CotulaBowling.clearBowlsState === 'function') {
                // b35fix394: when restoring a non-bowls site, strip any lingering
                // cotula identity keys from inputs.turf. Without this, switching
                // from a bowls site (e.g. X Cotula BC) to a non-bowls site
                // (e.g. Canturf, Australia, tall fescue) leaves cotula:true,
                // speciesKey:cotula, surfaceType:cotula_bowling_green in the
                // canonical state — production-confirmed via Canturf combined
                // export 2026-04-29 rendering Species:cotula and Turf Type:bowls
                // on every tall-fescue sample. The bug compounds with b35fix391's
                // fresh-wins merge, which preserves stale cotula keys across
                // analysis runs once they're in inputs.turf.
                global.GAIP_CotulaBowling.clearBowlsState();
            }
        }

        // Sub-category needs a small delay (DOM updates after turfType selection)
        setTimeout(function() {
            if (!skipTurfIdentity && turf.subCategory && tp && tp.selectSubCategory) {
                tp.selectSubCategory(turf.subCategory);
            }

            // Species and variety need delay for dropdown to populate
            setTimeout(function() {
                if (!skipTurfIdentity && turf.species) {
                    setDomVal('.gaip-species', turf.species);
                    if (tp && tp.selectSpecies) tp.selectSpecies(turf.species);
                }

                // Variety dropdown populates after species selection
                setTimeout(function() {
                    if (!skipTurfIdentity && turf.variety) {
                        setDomVal('.gaip-variety', turf.variety);
                    }

                    // Overseed species/variety — skip on GSSH pages (venue data is authority)
                    // coolOverseed is the settings-form key; overseedSpecies is the hub key — accept either.
                    var _overseedVal = turf.overseedSpecies || turf.coolOverseed || '';
                    if (!skipTurfIdentity && _overseedVal) setDomVal('.gaip-cool-overseed', _overseedVal);
                    setTimeout(function() {
                        if (!skipTurfIdentity && turf.overseedVariety) setDomVal('.gaip-overseed-variety', turf.overseedVariety);
                        
                        // v10.9.9: Keep _isRestoring true until the FULL cascade is done.
                        // This prevents auto-save from overwriting config with partial state.
                        setTimeout(function() {
                            _isRestoring = false;
                            _isSiteSwitch = false;  // Clear here — after full cascade, not before
                            var finalSpecies = skipTurfIdentity ? (tp.state && tp.state.species || '(from profile)') : turf.species;
                            log('Restore cascade complete for', skipTurfIdentity ? tp.state.turfType : turf.turfType, finalSpecies);

                            // Sync corrected species/turfType back into the last-loaded saved profile.
                            // Without this, loadLastProfile() on the next page load reads stale species
                            // (e.g. Perennial Ryegrass) and dispatches it before site-config restores.
                            // ONLY run on page-load restore — on site-switch, lastProfileName reflects
                            // the PREVIOUS site's profile and would corrupt it with the new site's species.
                            try {
                                if (!_isSiteSwitch) {
                                var tp2 = global.GaipTurfProfile;
                                var lastKey = tp2 && tp2.STORAGE_KEY ? tp2.STORAGE_KEY + '_last' : 'gilba_turf_profiles_last';
                                var profilesKey = tp2 && tp2.STORAGE_KEY ? tp2.STORAGE_KEY : 'gilba_turf_profiles';
                                var lastProfileName = _ls.getItem(lastKey);
                                if (lastProfileName) {
                                    var profiles = JSON.parse(_ls.getItem(profilesKey) || '{}');
                                    if (profiles[lastProfileName]) {
                                        var p = profiles[lastProfileName];
                                        if (!skipTurfIdentity && turf.turfType)  p.turfType  = turf.turfType;
                                        if (!skipTurfIdentity && turf.subCategory !== undefined) p.subCategory = turf.subCategory;
                                        if (!skipTurfIdentity && turf.species)   p.species   = turf.species;
                                        if (!skipTurfIdentity && turf.variety)   p.variety   = turf.variety;
                                        _ls.setItem(profilesKey, JSON.stringify(profiles));
                                        log('Synced saved profile "' + lastProfileName + '" — species: ' + p.species);
                                    }
                                }
                                }
                            } catch (e) { /* non-fatal */ }
                        }, 500);
                    }, 50);

                }, 200);
            }, 200);
        }, 100);

        // --- Non-cascading fields (can set immediately) ---
        setDomVal('.gaip-construction', turf.construction);
        setDomVal('.gaip-drainage', turf.drainage);
        setDomVal('.gaip-hoc', turf.hoc);
        setDomVal('.gaip-n-program', turf.nProgram);
        setDomVal('.gaip-soil-methodology', turf.methodology);
        setDomVal('.gaip-overseed-summer-intent', turf.summerIntent);
        setDomVal('.gaip-overseed-status', turf.overseedStatus || '');
        if (turf.c3Cover !== undefined) setDomVal('.gaip-c3-cover', turf.c3Cover);
        setDomVal('.gaip-years-established', turf.yearsEstablished);
        setDomVal('.gaip-thatch-depth', turf.thatchDepth);
        setDomVal('.gaip-winter-min-temp', turf.winterMinTemp);
        setDomVal('.gaip-poa-percent', turf.poaPercent);
        setDomVal('.gaip-aa-soil-texture', turf.aaTexture || '');

        // Traffic
        if (turf.trafficEnabled !== undefined) setChecked('.gaip-enable-turf-traffic', turf.trafficEnabled);
        setDomVal('.gaip-traffic-level', turf.trafficLevel || '');
        setDomVal('.gaip-events-per-week', turf.eventsPerWeek || '');

        // Clegg hammer — saved by Plan page traffic form, not in gaip config snapshot
        try {
            var _cleggSid = (global.GAIP_HUB_CONFIG || {}).activeSiteId || 'default';
            var _tst = JSON.parse(localStorage.getItem('gilba_traffic_state_' + _cleggSid) || '{}');
            if (_tst.cleggMean) setDomVal('.gaip-clegg-hammer', _tst.cleggMean);
            if (_tst.cleggHard) setDomVal('.gaip-clegg-max',    _tst.cleggHard);
            if (_tst.cleggSoft) setDomVal('.gaip-clegg-min',    _tst.cleggSoft);
        } catch(_) {}

        // Companion surface species (golf greens only)
        // b35fix179a: element may not exist yet — injected by daily-dashboard
        // after gaip:orchestrator-complete, which fires after this restore runs.
        // Write now if present; otherwise park the value in _pendingCompanionRestore
        // and apply it on the next orchestrator-complete (one-shot).
        if (turf.companionSpecies !== undefined) {
            var compEl = document.getElementById('gaip-companion-species');
            if (compEl) {
                compEl.value = turf.companionSpecies || '';
            } else {
                _pendingCompanionRestore = turf.companionSpecies || '';
                document.addEventListener('gaip:orchestrator-complete', function _applyPendingCompanion() {
                    document.removeEventListener('gaip:orchestrator-complete', _applyPendingCompanion);
                    var el = document.getElementById('gaip-companion-species');
                    if (el && _pendingCompanionRestore !== null) {
                        el.value = _pendingCompanionRestore;
                        log('Companion restore (deferred): applied "' + _pendingCompanionRestore + '"');
                        _pendingCompanionRestore = null;
                    }
                });
                log('Companion restore deferred — element absent, waiting for orchestrator-complete');
            }
        }

        // --- Location ---
        // b35fix227: Always write location when restoring a site config.
        // If the site has no saved location (lat/lon absent), CLEAR the DOM
        // fields so the previous site's coordinates don't bleed into this site's
        // climate fetch. Without this, switching from Federal Golf Club (Bowral)
        // to Shirley Golf Club (Christchurch) left Bowral coords in the DOM,
        // causing the climate engine to fetch weather for the wrong location.
        if (location.lat) {
            setDomVal('.gaip-lat', location.lat);
        } else {
            // No saved location — clear to prevent bleed from previous site
            setDomVal('.gaip-lat', '');
        }
        if (location.lon) {
            setDomVal('.gaip-lon', location.lon);
        } else {
            setDomVal('.gaip-lon', '');
        }
        if (location.name) {
            var locSearch = document.getElementById('gaip-location-search');
            if (locSearch) locSearch.value = location.name;
        } else {
            var locSearch = document.getElementById('gaip-location-search');
            if (locSearch) locSearch.value = '';
        }
        
        // Notify map picker to sync pin/view to restored coordinates
        if (location.lat && location.lon) {
            document.dispatchEvent(new CustomEvent('gaip:location-restored', {
                detail: { lat: location.lat, lon: location.lon, name: location.name || '' }
            }));
            // NOTE: saveLocationToServer intentionally NOT called here.
            // DB (gaip config + site model) is the source of truth for coordinates.
            // Automatically writing localStorage values to DB on every restore
            // causes stale coordinates to overwrite what the user set via the new hub.
            // Location is only synced to DB on explicit user actions (gaip:site-save-requested).
        }

        // Fire state change so engines pick up the new config
        if (tp && tp.dispatchStateChange) {
            setTimeout(function() { tp.dispatchStateChange(); }, 350);
        }

        // --- PGR settings ---
        // b35fix210: product/date/rate NOT restored from config — spray log cascade
        // is the authoritative source and will populate them after analysis-complete.
        // Only restore the GDD threshold override (user setting) and checkbox state.
        var pgr = config.pgr || {};
        var pgrChk = document.querySelector('.gaip-enable-pgr');
        if (pgrChk && pgrChk.type === 'checkbox') {
            pgrChk.checked = pgr.enabled !== undefined ? !!pgr.enabled : false;
        }
        // Restore GDD threshold override if user had set one
        if (pgr.gddThreshold) {
            setDomVal('.gaip-pgr-gdd', pgr.gddThreshold);
        }
        // Explicitly clear product/date/rate so stale values from localStorage
        // don't persist into the new session. The cascade will populate them.
        setDomVal('.gaip-pgr-product', '');
        setDomVal('.gaip-pgr-date',    '');
        setDomVal('.gaip-pgr-rate',    '');

        log('Restored config — turf:', turf.turfType, turf.species, turf.variety || '(no variety)');
    }

    // =========================================================================
    // SITE SWITCH HOOK (event-based)
    // =========================================================================

    /**
     * Save current site config before switching away.
     *
     * IMPORTANT: Do NOT call snapshotConfig() here. The DOM still reflects the
     * OUTGOING site's species/turfType during the transition — snapshotting now
     * would capture the wrong species and overwrite the departing site's correct config.
     * Instead, preserve the existing saved config for the departing site and only
     * update non-identity fields (construction, drainage, hoc etc.) that the user
     * may have changed while on that site.
     */
    function saveCurrentSiteConfig() {
        if (!_previousSiteId) return;

        var existing = _configs[_previousSiteId];
        if (!existing) {
            // No prior config — safe to snapshot everything (first visit)
            var config = snapshotConfig();
            _configs[_previousSiteId] = config;
            saveToStorage();
            pushConfigsToServer();
            log('Saved config for', _previousSiteId, '— turf:', config.turf.turfType, config.turf.species);
            return;
        }

        // Snapshot non-identity fields only (user may have changed HOC, N program etc.)
        // Preserve turf identity (turfType, subCategory, species, variety) from the stored config
        // because the DOM still shows the PREVIOUS site's species during the switch transition.
        // b35fix169 Fix 1: ALWAYS preserve location from stored config — never read lat/lon from
        // DOM during a site switch because those fields already hold the incoming site's coords
        // by the time gaip:site-changed fires.  Location only updates via explicit map pin or
        // location-search events.
        var freshSnap = snapshotConfig();
        var identityFields = ['turfType', 'subCategory', 'species', 'variety', 'companionSpecies'];
        for (var i = 0; i < identityFields.length; i++) {
            var field = identityFields[i];
            if (existing.turf[field]) {
                freshSnap.turf[field] = existing.turf[field];
            }
        }
        // Preserve stored location — DOM coords are unreliable at switch time
        if (existing.location && (existing.location.lat || existing.location.lon)) {
            freshSnap.location = existing.location;
        }
        // b35fix172: preserve companionSpecies — the #gaip-companion-species element
        // survives site-switch but its value is unreliable during the gaip:site-changed
        // transition (the incoming site's restore hasn't run yet).  Always use the stored
        // value for the departing site so it round-trips correctly.
        if (existing.turf.companionSpecies !== undefined) {
            freshSnap.turf.companionSpecies = existing.turf.companionSpecies;
        }
        // b35fix369: preserve multiSiteTurf from existing config. snapshotConfig
        // already carries the flag for the active site (Fix B), but this
        // belt-and-braces preservation guards against the case where
        // _previousSiteId !== active site (the flag is read from the active
        // site by snapshotConfig but should be preserved per-site here).
        if (existing.multiSiteTurf !== undefined) {
            freshSnap.multiSiteTurf = existing.multiSiteTurf;
        }
        _configs[_previousSiteId] = freshSnap;
        saveToStorage();
        pushConfigsToServer();
        log('Saved config for', _previousSiteId, '— turf:', freshSnap.turf.turfType, freshSnap.turf.species, '(identity preserved)');
    }

    /**
     * Restore config for the newly active site.
     */
    function restoreNewSiteConfig(newSiteId) {
        _isSiteSwitch = true;
        var config = _configs[newSiteId];
        if (config) {
            restoreConfig(config);
            log('Restored config for', newSiteId);
        } else {
            // No saved config for this site — clear transient application fields so
            // they don't bleed in from the previously active site. Turf identity
            // fields (species, turfType etc.) are intentionally left for the user
            // to configure, but time-specific inputs must be blank.
            setDomVal('.gaip-pgr-date',  '');
            setDomVal('.gaip-pgr-rate',  '');
            setDomVal('.gaip-pgr-product', '');
            setDomVal('.gaip-dmi-date',  '');
            try { document.querySelector('.gaip-enable-pgr') && (document.querySelector('.gaip-enable-pgr').checked = false); } catch(e) {}
            // b35fix394: also strip lingering cotula identity keys from inputs.turf.
            // First-visit-on-this-device sites don't have a saved config, so
            // restoreConfig() doesn't run and the non-bowls branch above doesn't
            // fire either. Cotula keys persisted from the previous site would
            // otherwise corrupt the first analysis run on the new site. Cleanest
            // invariant: on every site-switch, strip cotula state — if the new
            // site IS a bowls site, the user clicking the bowls tile (or the
            // restored config path on subsequent visits) re-routes the cotula
            // keys back via handleBowlsSelection.
            if (global.GAIP_CotulaBowling
                && typeof global.GAIP_CotulaBowling.clearBowlsState === 'function') {
                global.GAIP_CotulaBowling.clearBowlsState();
            }
            log('No saved config for', newSiteId, '— cleared transient fields (set turf type now to save it)');
        }
        // Dispatch site-config-applied so tissue auto-run uses the event path
        // rather than the 1s fallback timer. Without this, site-switch always
        // produces the wrong GP on first run (42% vs correct value).
        setTimeout(function() {
            document.dispatchEvent(new CustomEvent('gaip:site-config-applied', {
                detail: { siteId: newSiteId, source: 'site-switch' }
            }));
            log('Dispatched gaip:site-config-applied for site switch to', newSiteId);
        }, 150);
    }

    // =========================================================================
    // INIT
    // =========================================================================

    var _initRetries = 0;
    var _isRestoring = false;
    var _isSiteSwitch = false;  // True during site-switch restores — prevents profile name sync
    var _bootCooldown = true;  // Prevent auto-save during page initialization

    function init() {
        loadFromStorage();

        // Seed active site config from server-injected DB config.
        // Prefers the full GAIP_HUB_CONFIG.gaipConfig (all sections: turf, location,
        // traffic, shade, pgr, schedule, etc.) over the legacy siteConfig subset.
        // Runs synchronously so species is available immediately — no race with pullConfigsFromServer.
        // DB wins for identity fields (species, turfType) only when local is empty.
        (function seedFromInjectedConfig() {
            var hubCfg  = global.GAIP_HUB_CONFIG || {};
            var fullCfg = hubCfg.gaipConfig || null;  // full DB config (all sections)
            var injected = fullCfg || hubCfg.siteConfig;  // fallback to legacy subset
            var siteId   = hubCfg.activeSiteId;
            if (!injected || !injected.turf || !injected.turf.species || !siteId) return;
            if (!_configs[siteId]) _configs[siteId] = { turf: {}, location: {} };
            var local = _configs[siteId];
            if (local.turf && local.turf.species) return; // local already has species — don't overwrite
            if (fullCfg) {
                // Full DB config available — seed every section that isn't already saved locally.
                var SKIP_KEYS = { savedAt: true, wizard: true };
                Object.keys(fullCfg).forEach(function(key) {
                    if (SKIP_KEYS[key]) return;
                    if (!local[key]) local[key] = fullCfg[key];
                });
            } else {
                local.turf = Object.assign({}, local.turf || {}, injected.turf);
                if (injected.location && injected.location.lat) {
                    local.location = Object.assign({}, local.location || {}, injected.location);
                }
            }
            saveToStorage();
            log('Seeded site config from GAIP_HUB_CONFIG' + (fullCfg ? '.gaipConfig' : '.siteConfig') + ' — species:', injected.turf.species);
        })();

        _cleanupLocationBleed(); // b35fix268

        // b35fix137: one-time cleanup for pgr bleed introduced by b35fix133/135.
        // If a site config has pgr.productType set but pgr.applicationDate is null,
        // the pgr was bled from another site's DOM state during a stale snapshot.
        // A legitimate pgr entry always has both productType AND applicationDate,
        // or neither. Blank the productType so these sites no longer show phantom PGR.
        // Runs once per device, keyed by a localStorage flag.
        (function pgrBleedCleanup() {
            // b35fix137d: final pass including shared-date detection
            var cleanupKey = 'gilba_pgr_bleed_cleanup_b35fix137d';
            if (_ls.getItem(cleanupKey)) return;
            var dirty = false;
            // Build applicationDate -> siteIds map
            var _dateMap = {};
            Object.keys(_configs).forEach(function(id) {
                var d = _configs[id] && _configs[id].pgr && _configs[id].pgr.applicationDate;
                if (d) { if (!_dateMap[d]) _dateMap[d] = []; _dateMap[d].push(id); }
            });
            Object.keys(_configs).forEach(function(siteId) {
                var cfg = _configs[siteId];
                if (!cfg || !cfg.pgr || !cfg.pgr.productType) return;
                var isBleed = false;
                var reason = '';
                if (!cfg.pgr.applicationDate) { isBleed = true; reason = 'no applicationDate'; }
                if (cfg.pgr._savedForSite && cfg.pgr._savedForSite !== siteId) {
                    isBleed = true; reason = 'savedForSite=' + cfg.pgr._savedForSite;
                }
                var sharedWith = cfg.pgr.applicationDate && _dateMap[cfg.pgr.applicationDate]
                    ? _dateMap[cfg.pgr.applicationDate].filter(function(x) { return x !== siteId; })
                    : [];
                if (sharedWith.length > 0 && (!cfg.pgr._savedForSite || cfg.pgr._savedForSite !== siteId)) {
                    isBleed = true; reason = 'date shared with ' + sharedWith.join(',');
                }
                if (isBleed) {
                    log('PGR bleed cleanup: clearing pgr for', siteId, '(' + reason + ')');
                    cfg.pgr = { productType: '', applicationDate: null, rateLperHa: null, enabled: false };
                    dirty = true;
                }
            });
            if (dirty) saveToStorage();
            else log('PGR bleed cleanup: no bleed found in', Object.keys(_configs).length, 'site configs');
            _ls.setItem(cleanupKey, '1');
        })();

        // b35fix210: one-time migration — clear persisted PGR product/date/rate
        // from all existing site config snapshots. These fields are now owned by
        // the spray log cascade. Stale values (e.g. PBZ200 from a testing session)
        // will no longer survive page reloads.
        (function migrateRemovePGRFromConfig() {
            var migrationKey = 'gilba_pgr_config_migration_b35fix210';
            if (_ls.getItem(migrationKey)) return;
            try {
                Object.keys(_configs).forEach(function(siteId) {
                    if (_configs[siteId] && _configs[siteId].pgr) {
                        _configs[siteId].pgr.productType     = null;
                        _configs[siteId].pgr.applicationDate = null;
                        _configs[siteId].pgr.rateLperHa      = null;
                    }
                });
                saveToStorage();
                _ls.setItem(migrationKey, '1');
                log('b35fix210 migration: cleared PGR product/date/rate from all site configs');
            } catch(e) {
                log('b35fix210 migration failed: ' + e.message);
            }
        })();

        // Pull server configs on init — merges species/profile from other devices.
        // Runs async; page-load restore happens independently via the setTimeout below.
        // If server has newer species for a site, localStorage is updated for next restore.
        pullConfigsFromServer(function(merged) {
            if (merged) {
                log('Server sync on init updated', Object.keys(_configs).length, 'site configs');
            }
        });

        var SM = global.GAIP_SampleManager;
        if (!SM || typeof SM.getActiveSiteId !== 'function') {
            _initRetries = (_initRetries || 0) + 1;
            if (_initRetries > 10) {
                // SampleManager is an old version without getActiveSiteId.
                // Polyfill a minimal fallback so SiteConfig can still function.
                warn('SampleManager missing getActiveSiteId after 10s — applying polyfill');
                if (SM && typeof SM.getActiveSiteId !== 'function') {
                    SM.getActiveSiteId = function() { return 'default'; };
                } else if (!SM) {
                    global.GAIP_SampleManager = { getActiveSiteId: function() { return 'default'; } };
                }
                // Re-run init with polyfill in place
                _initRetries = 0;
                init();
                return;
            }
            warn('SampleManager not ready (getActiveSiteId missing), retrying in 1s... (' + _initRetries + '/10)');
            setTimeout(init, 1000);
            return;
        }

        // Startup prune: remove any siteConfig entries whose siteId no longer exists
        // in SampleManager. Prevents ProfileBridge regenerating orphan profiles on
        // every load from stale gilba_hub_site_configs entries.
        (function pruneStaleConfigs() {
            pruneConfigKeys(getLiveSiteIdMap());
        })();

        // One-time migration: if 'default' site has a real label (was renamed rather
        // than created fresh), promote it to a proper slugged ID so it doesn't
        // collide with the fallback config stored under 'default'.
        (function migrateDefaultSite() {
            var siteList = SM.getSiteList ? SM.getSiteList() : [];
            var defaultSite = siteList.find(function(s) { return s.id === 'default'; });
            if (defaultSite && defaultSite.label && defaultSite.label !== 'Default Site') {
                var alreadyMigrated = _ls.getItem('gaip_default_site_migrated');
                if (!alreadyMigrated && typeof SM.migrateSiteId === 'function') {
                    var newId = SM.migrateSiteId('default', defaultSite.label);
                    if (newId) {
                        // Migrate the saved config from 'default' key to the new ID
                        if (_configs['default']) {
                            _configs[newId] = _configs['default'];
                            delete _configs['default'];
                            saveToStorage();
                        }
                        _ls.setItem('gaip_default_site_migrated', newId);
                        log('Migrated default site to', newId, '— force-saving samples then reloading');

                        // Force synchronous sample save BEFORE reload so the new site ID
                        // is persisted — scheduleSave debounce won't complete in time
                        try {
                            var SM2 = global.GAIP_SampleManager;
                            if (SM2 && typeof SM2.getAllSamples === 'function') {
                                var snap = SM2.getAllSamples();
                                _ls.setItem('gilba_samples', JSON.stringify(snap));
                                log('Force-saved samples snapshot before reload');
                            }
                        } catch(e) {
                            warn('Force-save failed:', e.message);
                        }

                        setTimeout(function() { location.reload(); }, 200);
                    }
                }
            }
        })();

        // Record the currently active site
        _previousSiteId = SM.getActiveSiteId();

        // On page load: restore saved config for the current site if one exists,
        // then snapshot if it's a first visit. Dispatches 'gaip:site-config-applied'
        // so the auto-run can wait for the correct species/turfType to be in the DOM
        // before calling gaip_build_state(). Without this, incognito/cold-start loads
        // ran the first analysis against the TurfProfile default (Perennial Ryegrass)
        // instead of the saved species (e.g. Creeping Bentgrass).
        //
        // Timing rationale:
        //   - hub-persistence restores species at ~100ms
        //   - TurfProfile cascade (turfType → subCategory → species) takes ~350ms
        //   - So 800ms is safe for returning users (species already correct, this is belt-and-braces)
        //   - First-time / incognito users have no saved config → dispatch immediately
        //
        // b35fix253: restoreDelay is chosen at schedule time, but _configs may be empty
        // then because pullConfigsFromServer() (async) hasn't completed yet. The 3000ms
        // delay gives the server pull time to populate _configs. Re-check _configs at
        // FIRE time (not schedule time) — if the server pull completed during the wait,
        // restore rather than treating it as a first-visit snapshot.
        var restoreDelay = _configs[SM.getActiveSiteId()] ? 800 : 3000;
        setTimeout(function() {
            var currentId = SM.getActiveSiteId();
            _previousSiteId = currentId;
            // b35fix253: re-read _configs[currentId] at fire time — server pull may have
            // populated it during the 3000ms wait even if it was empty at schedule time.
            var configAtFireTime = _configs[currentId];
            if (configAtFireTime) {
                log('Restoring saved config for', currentId, 'on page load');
                restoreConfig(configAtFireTime);
                // Dispatch after restoreConfig's internal setTimeout cascade completes.
                // restoreConfig now manages _isRestoring internally (~1050ms total).
                setTimeout(function() {
                    _bootCooldown = false;
                    // Cascade has completed — re-snapshot to capture any settings that
                    // loaded after the initial restore (e.g. construction, HOC from hub-persistence).
                    // The cascade has already written the correct species/turfType to the DOM,
                    // so snapshotConfig() now reflects the true state for this site.
                    var freshSnap = snapshotConfig();
                    var existingConfig = _configs[currentId];
                    // Always restore saved turf identity — don't let TurfProfile's
                    // page-load cascade (which may still be finishing Federal GC or
                    // another previous site) overwrite this site's saved species/variety.
                    // e.g. Silk Path = Couch must not be overwritten by Federal = Bentgrass
                    // finishing its cascade after site-config-persistence has already
                    // correctly restored Couch to the DOM.
                    if (existingConfig && existingConfig.turf) {
                        var identityFields = ['turfType', 'subCategory', 'species', 'variety', 'companionSpecies'];
                        for (var fi = 0; fi < identityFields.length; fi++) {
                            var field = identityFields[fi];
                            if (existingConfig.turf[field]) {
                                // Unconditional: saved identity always wins over DOM snapshot
                                freshSnap.turf[field] = existingConfig.turf[field];
                            }
                        }
                    }
                    // b35fix136: preserve existing pgr if the fresh snapshot has no product.
                    // The DOM PGR fields may not be populated yet at the 1600ms snapshot
                    // moment (e.g. if restoreConfig hasn't finished or was interrupted),
                    // which would blank out a correctly saved pgr for this site.
                    // Only overwrite if the new snapshot actually has a product configured.
                    if (existingConfig && existingConfig.pgr && existingConfig.pgr.productType) {
                        if (!freshSnap.pgr || !freshSnap.pgr.productType) {
                            freshSnap.pgr = existingConfig.pgr;
                        }
                    }
                    _configs[currentId] = freshSnap;
                    saveToStorage();
                    log('Page-load config finalised for', currentId,
                        '— species:', (freshSnap.turf || {}).species);

                    // Seed GAIP_STATE.turf so hub-orchestrator's computeAll finds the
                    // correct species on gaip:site-config-applied, even on a fresh import
                    // where TurfProfile skips last-profile restore (GSSH page detection)
                    // and no previous-session GAIP_STATE exists.
                    var _snapTurf = freshSnap.turf || {};
                    var _snapSpecies = _snapTurf.species || _snapTurf.grassSpecies;
                    if (_snapSpecies) {
                        global.GAIP_STATE = global.GAIP_STATE || {};
                        global.GAIP_STATE.turf = global.GAIP_STATE.turf || {};
                        var _gst = global.GAIP_STATE.turf;
                        if (!_gst.grassSpecies) _gst.grassSpecies = _snapSpecies;
                        if (!_gst.effectiveSpecies) _gst.effectiveSpecies = _snapSpecies;
                        if (!_gst.species) _gst.species = _snapSpecies;
                        if (!_gst.turfType && _snapTurf.turfType) _gst.turfType = _snapTurf.turfType;
                        if (!_gst.subCategory && _snapTurf.subCategory) _gst.subCategory = _snapTurf.subCategory;
                        if (!_gst.variety && _snapTurf.variety) _gst.variety = _snapTurf.variety;
                        if (!_gst.trafficLevel && _snapTurf.trafficLevel) _gst.trafficLevel = _snapTurf.trafficLevel;
                        log('Seeded GAIP_STATE.turf.grassSpecies =', _snapSpecies, 'for computeAll');
                    }

            log('Page-load restore complete — dispatching gaip:site-config-applied');
                    global.GAIP_SITE_CONFIG_PENDING = false;
                    document.dispatchEvent(new CustomEvent('gaip:site-config-applied', {
                        detail: { siteId: currentId, restored: true }
                    }));
                }, 1600); // cascade takes ~1050ms; 1600ms gives safe margin
            } else {
                // b35fix287: first-visit / no saved config path.
                // Keep GAIP_SITE_CONFIG_PENDING true for a short delay so
                // hub-orchestrator defers computeAll until TurfProfile has applied
                // its default species to the DOM. Without this delay the
                // gaip:site-changed triggered computeAll fires with no speciesKey → TIER 0.
                setTimeout(function() {
                    _bootCooldown = false;
                    global.GAIP_SITE_CONFIG_PENDING = false;
                    _configs[currentId] = snapshotConfig();
                    saveToStorage();
                    log('Captured initial config for', currentId, '(first visit)');
                    document.dispatchEvent(new CustomEvent('gaip:site-config-applied', {
                        detail: { siteId: currentId, restored: false }
                    }));
                }, 600); // 600ms — enough for TurfProfile default cascade
            }
        }, restoreDelay);

        // Listen for site changes — fires AFTER the switch is complete
        document.addEventListener('gaip:site-changed', function(e) {
            var newSiteId = e.detail ? e.detail.siteId : null;
            if (!newSiteId) return;

            // Skip if it's the same site (e.g. restore-triggered duplicate events)
            if (newSiteId === _previousSiteId) return;

            log('Site switch detected:', _previousSiteId, '->', newSiteId);

            // Save config for the site we're LEAVING
            saveCurrentSiteConfig();

            // Update tracker
            _previousSiteId = newSiteId;

            // Restore config for the site we're ARRIVING at (delay for sample loading)
            setTimeout(function() {
                restoreNewSiteConfig(newSiteId);
            }, 300);
        });

        // Clean up config when a site is deleted
        document.addEventListener('gaip:site-removed', function(e) {
            var siteId = e.detail ? e.detail.siteId : null;
            if (!siteId) return;
            if (_configs[siteId]) {
                delete _configs[siteId];
                saveToStorage();
                log('Deleted config for removed site:', siteId);
            }
        });

        // Also save config periodically when user changes turf settings
        // (so switching away always has the latest)
        document.addEventListener('gaip:turf-profile-change', function() {
            var SM2 = global.GAIP_SampleManager;
            if (!SM2) return;
            // In stadium/GSSH mode the active site is the selected venue, not the
            // GAIP SampleManager site. Prefer venue ID when available.
            // b35fix271: Delegate to GAIP_SiteContext — single source of truth.
            var currentId = global.GAIP_SiteContext
                ? global.GAIP_SiteContext.getSiteId()
                : SM2.getActiveSiteId();
            // Skip auto-save if we're restoring a config, in boot cooldown,
            // or if TurfProfile is mid-way through a loadProfile cascade,
            // or if page-load site-config restore is still pending (GAIP_SITE_CONFIG_PENDING).
            // This prevents TurfProfile's tail-end Bentgrass cascade events from
            // poisoning Silk Path (Couch) after _isRestoring goes false but before
            // the PENDING flag is cleared at t=1600ms.
            var tp = global.GaipTurfProfile;
            var isProfileLoading = tp && tp._isLoadingProfile;
            if (!_isRestoring && !_bootCooldown && !isProfileLoading && !global.GAIP_SITE_CONFIG_PENDING) {
                _configs[currentId] = snapshotConfig();
                saveToStorage();
                log('Auto-saved config on turf change for', currentId);
            }
        });

        // Explicit save button: snapshot current config NOW
        document.addEventListener('gaip:site-save-requested', function(e) {
            var detail = e.detail || {};
            var siteId = detail.siteId;
            if (!siteId) return;
            _configs[siteId] = snapshotConfig();
            saveToStorage();
            log('Explicit save for', siteId, ':', JSON.stringify(_configs[siteId].turf.species), _configs[siteId].location.name);
            
            // Also persist location to MySQL so it survives localStorage clears.
            var loc = _configs[siteId].location;
            saveLocationToServer(siteId, loc);
        });

        // b35fix110: gaip:config-save-requested — fired by daily-dashboard.js when
        // companion species changes. No siteId in detail — use active site.
        document.addEventListener('gaip:config-save-requested', function() {
            // Note: _bootCooldown deliberately NOT checked here.
            // This event is fired by explicit user actions (e.g. companion species change)
            // and must always save regardless of page-load timing.
            if (_isRestoring || global.GAIP_SITE_CONFIG_PENDING) return;
            var SM = global.GAIP_SampleManager;
            if (!SM) return;
            var currentId = SM.getActiveSiteId();
            if (!currentId || currentId === 'default') return;
            var snap = snapshotConfig();
            // If #gaip-companion-species wasn't in DOM at snapshot time (undefined),
            // preserve whatever was previously saved rather than blanking it.
            var existing = _configs[currentId];
            if (snap.turf && snap.turf.companionSpecies === undefined) {
                if (existing && existing.turf && existing.turf.companionSpecies !== undefined) {
                    snap.turf.companionSpecies = existing.turf.companionSpecies;
                }
            }
            _configs[currentId] = snap;
            saveToStorage();
            log('Config saved on gaip:config-save-requested for', currentId);
        });

        // b35fix133: Auto-save on gaip:analysis-complete so PGR, species, and all
        // DOM state are captured after every successful run.
        // b35fix135: _bootCooldown guard removed — analysis-complete only fires after
        // a full successful analysis so DOM is in clean state by definition.
        // b35fix136: preserve existing pgr when fresh snapshot has no product — guards
        // against the DOM PGR fields being momentarily empty at the time the event fires
        // (e.g. during the TurfProfile cascade on a site switch).
        document.addEventListener('gaip:analysis-complete', function() {
            if (_isRestoring || global.GAIP_SITE_CONFIG_PENDING) return;
            var SM = global.GAIP_SampleManager;
            if (!SM) return;
            var currentId = SM.getActiveSiteId();
            if (!currentId || currentId === 'default') return;
            var snap = snapshotConfig();
            // b35fix233: preserve existing pgr from saved config when snapshot has no product.
            // GAIP_LAST_PGR is the SSOT for PGR data (from spray log via cascade).
            // Auto-save should never overwrite a valid saved PGR config with empty values.
            var existing = _configs[currentId];
            if (existing && existing.pgr && existing.pgr.productType) {
                if (!snap.pgr || !snap.pgr.productType) {
                    snap.pgr = existing.pgr;
                }
            }
            // Also persist GAIP_LAST_PGR into site config so it survives page reload
            // without needing a spray log fetch to restore it.
            var _lastPgr = window.GAIP_LAST_PGR;
            if (_lastPgr && _lastPgr.product_key) {
                if (!snap.pgr) snap.pgr = {};
                snap.pgr.productType     = snap.pgr.productType     || _lastPgr.product_key;
                snap.pgr.applicationDate = snap.pgr.applicationDate || _lastPgr.application_date;
                snap.pgr.rateLperHa      = snap.pgr.rateLperHa      || _lastPgr.rate;
            }
            // b35fix230: preserve existing companionSpecies if snapshot captured undefined
            // (#gaip-companion-species not yet injected when this fires — 350ms race)
            if (snap.turf && snap.turf.companionSpecies === undefined) {
                if (existing && existing.turf && existing.turf.companionSpecies) {
                    snap.turf.companionSpecies = existing.turf.companionSpecies;
                }
            }
            _configs[currentId] = snap;
            saveToStorage();
            log('Config auto-saved on gaip:analysis-complete for', currentId);
        });

        log('v' + VERSION, 'ready — event-based,', Object.keys(_configs).length, 'saved configs');
    }

    // =========================================================================
    // BOOT
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 500); });
    } else {
        setTimeout(init, 500);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_SiteConfig = {
        version: VERSION,
        snapshot: snapshotConfig,
        restore: restoreConfig,
        isRestoring: function() { return _isRestoring; },
        getConfig: function(siteId) { return _configs[siteId] || null; },
        getAllConfigs: function() { return JSON.parse(JSON.stringify(_configs)); },
        mergeConfig: function(siteId, patch) {
            if (!siteId || !patch || typeof patch !== 'object') return false;
            var existing = _configs[siteId] || { turf: {}, location: {} };
            var next = JSON.parse(JSON.stringify(existing));

            Object.keys(patch).forEach(function(key) {
                var value = patch[key];
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    var existingValue = next[key];
                    if (!existingValue || typeof existingValue !== 'object' || Array.isArray(existingValue)) {
                        existingValue = {};
                    }
                    next[key] = Object.assign({}, existingValue, value);
                } else {
                    next[key] = value;
                }
            });

            next.savedAt = new Date().toISOString();
            _configs[siteId] = next;
            saveToStorage();
            pushConfigsToServer();
            log('Merged config for', siteId, 'keys:', Object.keys(patch).join(', '));
            return true;
        },
        removeConfig: function(siteId) {
            if (!siteId || !_configs[siteId]) return false;
            delete _configs[siteId];
            saveToStorage();
            log('Removed config for', siteId);
            return true;
        },
        saveCurrentSite: function() {
            var SM = global.GAIP_SampleManager;
            if (!SM) return;
            var siteId = SM.getActiveSiteId();
            _configs[siteId] = snapshotConfig();
            saveToStorage();
            log('Manually saved config for', siteId);
        },
        // Direct companion species write — bypasses timing guards intentionally.
        // Called by the Save button in daily-dashboard.js companion selector.
        setCompanionSpecies: function(siteId, value) {
            if (!siteId) return;
            if (!_configs[siteId]) _configs[siteId] = { turf: {}, location: {} };
            if (!_configs[siteId].turf) _configs[siteId].turf = {};
            _configs[siteId].turf.companionSpecies = value;
            saveToStorage();
            pushConfigsToServer();
            log('Companion species written directly:', '"' + value + '"', 'for site', siteId);
        },

        // b35fix367 — Multi-site turf toggle.
        //
        // When enabled for a site, samples within that site may carry their own
        // sample.turfProfile override (species, variety, turfType, etc.) which
        // wins over the site-level GaipTurfProfile in engine read paths.
        // Default: false (single-site users see no behaviour change).
        // Persisted on _configs[siteId].multiSiteTurf alongside turf/location/pgr.
        // Round-trips to server via pushConfigsToServer like other site config.
        // Read site: word-export.js _buildEngineInputs gates per-sample override
        // reads on this flag for the active site.
        isMultiSiteTurfEnabled: function(siteId) {
            if (!siteId) {
                var SM = global.GAIP_SampleManager;
                siteId = SM && typeof SM.getActiveSiteId === 'function'
                    ? SM.getActiveSiteId() : null;
            }
            if (!siteId) return false;
            var cfg = _configs[siteId];
            return !!(cfg && cfg.multiSiteTurf === true);
        },
        setMultiSiteTurfEnabled: function(siteId, enabled) {
            if (!siteId) {
                var SM = global.GAIP_SampleManager;
                siteId = SM && typeof SM.getActiveSiteId === 'function'
                    ? SM.getActiveSiteId() : null;
            }
            if (!siteId) return false;
            if (!_configs[siteId]) _configs[siteId] = { turf: {}, location: {} };
            _configs[siteId].multiSiteTurf = !!enabled;
            saveToStorage();
            pushConfigsToServer();
            log('Multi-site turf toggle for', siteId, '=', !!enabled);
            try {
                document.dispatchEvent(new CustomEvent('gaip:multi-site-turf-change', {
                    detail: { siteId: siteId, enabled: !!enabled }
                }));
            } catch (e) { /* event dispatch optional */ }
            return true;
        }
    };


})(window);
