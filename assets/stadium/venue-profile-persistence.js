/**
 * GSSH Venue Profile Persistence v1.0.0
 *
 * Saves and restores turf profile (type/species/variety/construction) per venue.
 * Operates on the GSSH shade hub only — does not touch GAIP SiteConfig.
 *
 * Storage: MySQL via Laravel stadium venue profile API.
 * Local cache: window.GSSH_VENUE_PROFILES (loaded once on init).
 *
 * Triggers:
 *   - gssh:venueSelect  → restore saved profile for that venue_id
 *   - gaip:turf-profile-change → auto-save current profile against active venue_id
 */
(function(global) {
    'use strict';

    var VERSION = '1.0.0';
    // In-memory cache of all venue profiles { venue_id: { turfType, subCategory, species, variety, construction } }
    var _profiles = {};
    var _currentVenueId = null;
    var _saveTimer = null;
    var _loaded = false;
    var _restoring = false; // guard: don't auto-save while restoring

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[VenueProfile]');
        console.log.apply(console, args);
    }

    function getApiBaseUrl() {
        var cfg = global.GSSH_HUB_CONFIG || global.GAIP_HUB_CONFIG || {};
        return cfg.restUrl || '/api/';
    }

    function getCsrfToken() {
        var cfg = global.GSSH_HUB_CONFIG || global.GAIP_HUB_CONFIG || {};
        return cfg.csrfToken || cfg.restNonce || cfg.nonce || '';
    }

    function apiFetchJson(url, options) {
        var headers = Object.assign({
            'Accept': 'application/json'
        }, (options && options.headers) || {});
        var token = getCsrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;

        return fetch(url, Object.assign({ credentials: 'same-origin', headers: headers }, options || {}))
            .then(function(res) {
                return res.json().then(function(data) {
                    if (!res.ok) throw new Error((data && data.message) || ('HTTP ' + res.status));
                    return data;
                });
            });
    }

    // =========================================================================
    // LOAD profiles from server on init
    // =========================================================================
    function loadProfiles(callback) {
        if (_loaded) { if (callback) callback(); return; }

        var base = getApiBaseUrl();
        apiFetchJson(base.replace(/\/?$/, '/') + 'stadium/venue-profiles')
        .then(function(data) {
            if (data && data.data) {
                _profiles = data.data;
                log('Loaded', Object.keys(_profiles).length, 'venue profiles');
            }
            _loaded = true;
            if (callback) callback();
        })
        .catch(function(err) {
            console.warn('[VenueProfile] Failed to load profiles:', err);
            _loaded = true;
            if (callback) callback();
        });
    }

    // =========================================================================
    // SAVE current turf state against current venue
    // =========================================================================
    function saveProfile(venueId, state) {
        if (!venueId || !state) return;
        if (!state.turfType || !state.species) return; // skip incomplete state

        var profile = {
            turfType:        state.turfType        || '',
            subCategory:     state.subCategory     || '',
            species:         state.species         || '',
            variety:         state.variety         || 'generic',
            construction:    state.construction    || '',
            // b35fix256: overseed and C3 cover are DOM-only values not in
            // gaip:turf-profile-change detail — read from DOM at save time.
            overseedSpecies: (document.querySelector('.gaip-cool-overseed')  || {}).value || '',
            overseedVariety: (document.querySelector('.gaip-overseed-variety') || {}).value || '',
            percentC3Cover:  parseFloat((document.querySelector('.gaip-c3-cover') || {}).value || 0) || 0,
        };

        // Update local cache immediately
        _profiles[venueId] = profile;

        // b35fix253: capture current EUE venue env config to save alongside turf profile
        var venueEnvData = (global.GSSH_EUE_Bridge &&
            typeof global.GSSH_EUE_Bridge.getVenueEnvConfig === 'function')
            ? global.GSSH_EUE_Bridge.getVenueEnvConfig()
            : null;
        if (venueEnvData) {
            _profiles[venueId].venueEnv = venueEnvData;
        }

        var payload = {
            turfType:        profile.turfType,
            subCategory:     profile.subCategory,
            species:         profile.species,
            variety:         profile.variety,
            construction:    profile.construction,
            overseedSpecies: profile.overseedSpecies,
            overseedVariety: profile.overseedVariety,
            percentC3Cover:  profile.percentC3Cover
        };

        if (venueEnvData) {
            payload.venueEnv = venueEnvData;
        }

        var base = getApiBaseUrl();
        apiFetchJson(base.replace(/\/?$/, '/') + 'stadium/venue-profiles/' + encodeURIComponent(venueId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(data) {
            if (data && data.data) {
                log('Saved profile for', venueId, '—', profile.species, profile.variety);
            } else {
                console.warn('[VenueProfile] Save failed:', data);
            }
        })
        .catch(function(err) {
            console.warn('[VenueProfile] Save error:', err);
        });
    }

    // =========================================================================
    // APPLY STADIUM DB DEFAULTS (b35fix253)
    // Used when no saved profile exists — pre-populates from PHP-injected defaults
    // =========================================================================
    function applyStadiumDefaults(venueId) {
        var defaults = (global.GSSH_STADIUM_DEFAULTS || {})[venueId];
        if (!defaults) return false;
        if (defaults.venueEnv && global.GSSH_EUE_Bridge &&
            typeof global.GSSH_EUE_Bridge.setVenueEnvConfig === 'function') {
            global.GSSH_EUE_Bridge.setVenueEnvConfig(defaults.venueEnv);
            log('Applied stadium defaults for', venueId,
                '— enclosure:', defaults.venueEnv.enclosureType,
                'drainage:', defaults.venueEnv.drainageRating,
                'hoc:', defaults.venueEnv.hocMM);
            return true;
        }
        return false;
    }

    // =========================================================================
    // RESTORE saved profile into TurfProfileController
    // =========================================================================
    function restoreProfile(venueId) {
        var profile = _profiles[venueId];
        if (!profile || !profile.species) {
            log('No saved profile for', venueId, '— checking stadium defaults');
            // b35fix253: apply stadium DB defaults if available
            applyStadiumDefaults(venueId);
            // Ensure any previously set _isLoadingProfile guard is cleared
            var tpClear = global.GaipTurfProfile;
            if (tpClear) tpClear._isLoadingProfile = false;
            return false;
        }

        var tp = global.GaipTurfProfile;
        if (!tp) {
            console.warn('[VenueProfile] GaipTurfProfile not available');
            return false;
        }

        log('Restoring profile for', venueId, '—', profile.turfType, profile.species, profile.variety);

        _restoring = true;

        // Suppress TurfProfile's location-change species rebuild while we're
        // restoring. Without this, the lat change event fired by updateHubLocation
        // triggers updateSpeciesOptions() which resets species to the region default
        // (e.g. PRG), fighting the restore cascade.
        var tp2 = global.GaipTurfProfile;
        if (tp2) tp2._isLoadingProfile = true;

        // Set turf type + subCategory first
        if (profile.turfType && typeof tp.selectTurfType === 'function') {
            tp.selectTurfType(profile.turfType);
        }
        if (profile.subCategory && typeof tp.selectSubCategory === 'function') {
            tp.selectSubCategory(profile.subCategory);
        }

        // Set species (with a short delay to let species options repopulate)
        setTimeout(function() {
            if (profile.species && typeof tp.selectSpecies === 'function') {
                tp.selectSpecies(profile.species);
            }

            // Set variety after species options are populated
            setTimeout(function() {
                if (profile.variety && profile.variety !== 'generic' && typeof tp.selectVariety === 'function') {
                    tp.selectVariety(profile.variety);
                }
                // Set construction
                if (profile.construction) {
                    var constructEl = document.getElementById('gaip-construction-select') ||
                                      document.querySelector('[name="construction"]');
                    if (constructEl) {
                        constructEl.value = profile.construction;
                        constructEl.dispatchEvent(new Event('change'));
                    }
                }
                // b35fix256: restore overseed species, variety and % C3 cover
                // These are DOM-only fields not managed by TurfProfileController API
                //
                // b35fix257: overseed variety options are built dynamically by
                // site-settings-panel.js when overseed species changes (async).
                // Setting variety immediately after the species change event fires
                // has no effect — options haven't populated yet. Use an additional
                // 300ms delay to let the variety dropdown populate first.
                if (profile.overseedSpecies) {
                    var overseedEl = document.querySelector('.gaip-cool-overseed');
                    if (overseedEl) {
                        overseedEl.value = profile.overseedSpecies;
                        overseedEl.dispatchEvent(new Event('change'));
                    }
                }
                // Restore variety and C3 cover after a short delay to allow
                // overseed variety dropdown to populate from the species change.
                var _savedOverseedVariety   = profile.overseedVariety   || '';
                var _savedPercentC3Cover    = profile.percentC3Cover    || 0;
                var _savedOverseedSpecies   = profile.overseedSpecies   || '';
                setTimeout(function() {
                    if (_savedOverseedVariety) {
                        var overseedVarEl = document.querySelector('.gaip-overseed-variety');
                        if (overseedVarEl) {
                            overseedVarEl.value = _savedOverseedVariety;
                            // Verify option exists — if not, fallback silently
                            if (overseedVarEl.value !== _savedOverseedVariety) {
                                log('Overseed variety', _savedOverseedVariety,
                                    'not found in dropdown — options may not be populated yet');
                            } else {
                                overseedVarEl.dispatchEvent(new Event('change'));
                            }
                        }
                    }
                    if (_savedPercentC3Cover > 0) {
                        var c3El = document.querySelector('.gaip-c3-cover');
                        if (c3El) {
                            c3El.value = _savedPercentC3Cover;
                            c3El.dispatchEvent(new Event('input'));
                            c3El.dispatchEvent(new Event('change'));
                        }
                    }
                    log('Restored overseed/C3 for', venueId,
                        '— overseed:', _savedOverseedSpecies || 'none',
                        'variety:', _savedOverseedVariety || 'none',
                        'C3:', _savedPercentC3Cover + '%');
                }, 300);
                _restoring = false;
                // Re-enable TurfProfile's location-change handler
                var tp3 = global.GaipTurfProfile;
                if (tp3) tp3._isLoadingProfile = false;
                log('Restore complete for', venueId);

                // b35fix253: restore EUE venue environment config
                // Do this AFTER turf restore so EUE recalc uses correct species
                var savedEnv = profile.venueEnv;
                if (savedEnv && Object.keys(savedEnv).length > 0 &&
                    global.GSSH_EUE_Bridge &&
                    typeof global.GSSH_EUE_Bridge.setVenueEnvConfig === 'function') {
                    global.GSSH_EUE_Bridge.setVenueEnvConfig(savedEnv);
                    log('Restored venueEnv for', venueId,
                        '— enclosure:', savedEnv.enclosureType,
                        'drainage:', savedEnv.drainageRating,
                        'hoc:', savedEnv.hocMM);
                } else if (!savedEnv || Object.keys(savedEnv).length === 0) {
                    // No saved venueEnv — fall back to stadium defaults
                    applyStadiumDefaults(venueId);
                }

                document.dispatchEvent(new CustomEvent('gssh:venue-profile-restored', {
                    detail: { venue_id: venueId, profile: profile },
                    bubbles: true
                }));
            }, 200);
        }, 150);

        return true;
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================
    function init() {
        // Load all profiles once, then set up listeners
        loadProfiles(function() {

            // 1. On venue select — restore saved profile
            document.addEventListener('gssh:venueSelect', function(e) {
                var venueId = e.detail && e.detail.venue_id;
                if (!venueId) return;
                _currentVenueId = venueId;
                restoreProfile(venueId);
            });

            // 2. On turf state change — auto-save against current venue (debounced 1.5s)
            document.addEventListener('gaip:turf-profile-change', function(e) {
                if (_restoring) return; // don't save while we're restoring
                if (!_currentVenueId) return;
                var state = e.detail;
                if (!state) return;

                clearTimeout(_saveTimer);
                _saveTimer = setTimeout(function() {
                    saveProfile(_currentVenueId, state);
                }, 1500);
            });

            // 3. On venue deleted — remove its profile
            document.addEventListener('gssh:venueDeleted', function(e) {
                var venueId = e.detail && e.detail.venue_id;
                if (venueId && _profiles[venueId]) {
                    delete _profiles[venueId];
                    log('Profile removed for deleted venue:', venueId);
                }
            });

            log('v' + VERSION + ' ready — ' + Object.keys(_profiles).length + ' profiles cached');

            // b35fix255: catch-up — if a venue was already selected before profiles
            // finished loading (common on page load with ?gssh_venue= URL param),
            // the gssh:venueSelect event fired before our listener was attached.
            // Check GSSH_UnifiedVenueSelector for a current venue and restore immediately.
            setTimeout(function() {
                if (_currentVenueId) return; // already handled by event listener
                var uvs = global.GSSH_UnifiedVenueSelector;
                if (!uvs || typeof uvs.getCurrentVenueId !== 'function') return;
                var existingId = uvs.getCurrentVenueId();
                if (!existingId) return;
                log('Catch-up: venue already selected —', existingId, '— restoring profile');
                _currentVenueId = existingId;
                restoreProfile(existingId);
            }, 100);
        });
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    global.GSSH_VenueProfiles = {
        version:        VERSION,
        getProfile:     function(venueId) { return _profiles[venueId] || null; },
        getAllProfiles:  function() { return JSON.parse(JSON.stringify(_profiles)); },
        saveNow:        function(venueId, state) { saveProfile(venueId, state); },
        currentVenueId: function() { return _currentVenueId; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }

})(window);
