/**
 * =============================================================================
 * GILBA HUB SAMPLE PERSISTENCE v1.0.0
 * =============================================================================
 * 
 * Persistence layer for GAIP_SampleManager.
 * Listens for sample mutation events, auto-saves to storage, and restores
 * on page load.
 * 
 * STORAGE:
 *   localStorage is retained as a browser cache for fast boot and legacy UI
 *   compatibility. Every save must also reach the MySQL-backed REST sync route
 *   before the save is reported as complete.
 * 
 * ARCHITECTURE:
 *   sample-manager.js  ──dispatches events──>  sample-persistence.js
 *                                                    │
 *                                              StorageAdapter cache
 *                                                    │
 *                                        localStorage + MySQL REST sync
 * 
 * EVENTS CONSUMED (mutation signals from sample-manager.js):
 *   - gaip:samples-imported
 *   - gaip:sample-added
 *   - gaip:sample-updated
 *   - gaip:sample-deleted
 *   - gaip:sample-renamed
 *   - gaip:samples-cleared
 *   - gaip:all-samples-cleared
 *   - gaip:site-changed
 *   - gaip:site-added
 *   - gaip:site-renamed
 *   - gaip:site-removed
 * 
 * EVENTS PRODUCED:
 *   - gaip:samples-persistence-ready   (restore complete on page load)
 *   - gaip:samples-persistence-saved   (after each save)
 *   - gaip:samples-persistence-error   (on save/load failure)
 * 
 * DEPENDENCIES:
 *   - sample-manager.js (GAIP_SampleManager.getAllSamples / restoreFromPersistence)
 * 
 * @author  Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;


    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        version: '1.0.0',
        debug: false,

        // localStorage key
        storageKey: 'gilba_samples',

        // Debounce delay (ms) — prevents rapid-fire saves during bulk import
        saveDebounceMs: 500,

        // Maximum storage size warning threshold (bytes)
        // localStorage typically allows ~5MB per origin
        sizeWarningBytes: 4 * 1024 * 1024  // 4MB warning
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(msg, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
            console.log('[SamplePersistence] ' + msg, data);
        } else {
            console.log('[SamplePersistence] ' + msg);
        }
    }

    function warn(msg, data) {
        if (data !== undefined) {
            console.warn('[SamplePersistence] ' + msg, data);
        } else {
            console.warn('[SamplePersistence] ' + msg);
        }
    }

    // =========================================================================
    // STORAGE ADAPTER
    // =========================================================================
    //
    // Thin local cache over the server-backed sample store. Data is restored
    // server-first and every save must sync to MySQL before completion.
    //
    // All methods return Promises for future async compatibility.
    // =========================================================================

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
        if (token) {
            headers['X-CSRF-TOKEN'] = token;
        }
        return fetch(url, Object.assign({ credentials: 'same-origin', headers: headers }, options || {}))
            .then(function(r) {
                return r.json().then(function(data) {
                    if (!r.ok) {
                        var msg = (data && data.message) || (data && data.data && data.data.message) || ('HTTP ' + r.status);
                        throw new Error(msg);
                    }
                    return data;
                });
            });
    }

    var StorageAdapter = {
        /**
         * Save data to storage
         * @param {string} key
         * @param {object} data
         * @returns {Promise<boolean>}
         */
        save: function(key, data) {
            return new Promise(function(resolve, reject) {
                try {
                    var json = JSON.stringify(data);

                    // Size check
                    if (json.length > CONFIG.sizeWarningBytes) {
                        warn('Storage size approaching limit: ' + 
                            Math.round(json.length / 1024) + 'KB / ~5120KB');
                    }

                    _ls.setItem(key, json);
                    log('Saved ' + Math.round(json.length / 1024) + 'KB to ' + key);
                    resolve(true);
                } catch (e) {
                    // QuotaExceededError or SecurityError
                    warn('Save failed: ' + e.message);
                    reject(e);
                }
            });
        },

        /**
         * Load data from storage
         * @param {string} key
         * @returns {Promise<object|null>}
         */
        load: function(key) {
            return new Promise(function(resolve, reject) {
                try {
                    var raw = _ls.getItem(key);
                    if (!raw) {
                        log('No data found for key: ' + key);
                        resolve(null);
                        return;
                    }

                    var data = JSON.parse(raw);
                    log('Loaded ' + Math.round(raw.length / 1024) + 'KB from ' + key);
                    resolve(data);
                } catch (e) {
                    warn('Load failed: ' + e.message);
                    reject(e);
                }
            });
        },

        /**
         * Delete data from storage
         * @param {string} key
         * @returns {Promise<boolean>}
         */
        delete: function(key) {
            return new Promise(function(resolve) {
                try {
                    _ls.removeItem(key);
                    log('Deleted key: ' + key);
                    resolve(true);
                } catch (e) {
                    warn('Delete failed: ' + e.message);
                    resolve(false);
                }
            });
        },

        /**
         * Get approximate storage usage for this key (bytes)
         * @param {string} key
         * @returns {number}
         */
        getSize: function(key) {
            try {
                var raw = _ls.getItem(key);
                return raw ? raw.length * 2 : 0;  // UTF-16 = 2 bytes per char
            } catch (e) {
                return 0;
            }
        }
    };

    // =========================================================================
    // DEBOUNCED SAVE
    // =========================================================================

    var _saveTimer = null;
    var _saveCount = 0;

    /**
     * Schedule a debounced save.
     * Multiple rapid mutations (e.g. bulk import of 20 samples) collapse
     * into a single save after the debounce window.
     */
    function scheduleSave(reason) {
        _saveCount++;
        var batchId = _saveCount;

        if (_saveTimer) {
            clearTimeout(_saveTimer);
        }

        _saveTimer = setTimeout(function() {
            _saveTimer = null;
            doSave(reason, batchId);
        }, CONFIG.saveDebounceMs);
    }

    /**
     * Execute the actual save.
     */
    function doSave(reason, batchId) {
        if (!global.GAIP_SampleManager) {
            warn('SampleManager not available — cannot save');
            return;
        }

        var snapshot = global.GAIP_SampleManager.getAllSamples();

        StorageAdapter.save(CONFIG.storageKey, snapshot)
            .then(function() {
                // Count samples for logging
                var count = 0;
                var siteKeys = Object.keys(snapshot.allSites || {});
                for (var s = 0; s < siteKeys.length; s++) {
                    var site = snapshot.allSites[siteKeys[s]];
                    var types = ['soil', 'water', 'tissue', 'loi'];
                    for (var t = 0; t < types.length; t++) {
                        if (site[types[t]]) {
                            count += Object.keys(site[types[t]]).length;
                        }
                    }
                }

                log('Auto-saved (' + reason + '): ' + count + ' samples across ' + 
                    siteKeys.length + ' sites [batch #' + batchId + ']');

                // Sync site registry before samples so imported/restored site IDs
                // exist in MySQL before sample rows reference them.
                return syncSiteListToServer(snapshot.sites || {}).then(function() {
                    return syncSamplesToServer(snapshot);
                }).then(function() {
                    document.dispatchEvent(new CustomEvent('gaip:samples-persistence-saved', {
                        detail: {
                            sampleCount: count,
                            siteCount: siteKeys.length,
                            reason: reason,
                            sizeBytes: StorageAdapter.getSize(CONFIG.storageKey)
                        }
                    }));
                });
            })
            .catch(function(err) {
                warn('Auto-save failed: ' + err.message);
                document.dispatchEvent(new CustomEvent('gaip:samples-persistence-error', {
                    detail: { error: err.message, reason: reason }
                }));
            });
    }

    /**
     * Sync all samples to MySQL so localStorage is only a browser cache.
     */
    function syncSamplesToServer(snapshot) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') {
            return Promise.reject(new Error('REST sample sync unavailable'));
        }

        return apiFetchJson(base.replace(/\/?$/, '/') + 'samples/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allSites: snapshot.allSites || {} })
        })
            .then(function(data) {
                log('Sample snapshot synced to server', data && data.data ? data.data : data);
            })
            .catch(function(err) {
                warn('Server sample sync failed: ' + err.message);
                throw err;
            });
    }

    function fetchSamplesFromServer(onComplete) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined' || !global.GAIP_SampleManager) {
            onComplete(false);
            return;
        }

        apiFetchJson(base.replace(/\/?$/, '/') + 'samples?limit=200')
            .then(function(data) {
                var samples = (data && data.data) || [];
                if (!samples.length) {
                    onComplete(false);
                    return;
                }

                var SM = global.GAIP_SampleManager;
                var originalSite = SM.getActiveSiteId ? SM.getActiveSiteId() : 'default';
                var restored = 0;

                samples.forEach(function(sample) {
                    var siteId = sample.site_id;
                    if (!siteId || !sample.sample_type || !sample.payload) return;

                    var existingSites = SM.getSiteList ? SM.getSiteList() : [];
                    var exists = existingSites.some(function(site) { return site.id === siteId; });
                    if (!exists && typeof SM.addSiteWithId === 'function') {
                        var siteLabel = (sample.summary && sample.summary.site_name) || siteId;
                        SM.addSiteWithId(siteId, siteLabel);
                    }

                    if (typeof SM.setActiveSite === 'function') {
                        SM.setActiveSite(siteId);
                    }

                    var sampleId = sample.client_uid || (sample.payload && (sample.payload.label || sample.payload.sampleId)) || ('sample_' + sample.id);
                    if (SM.getSample && SM.getSample(sample.sample_type, sampleId)) {
                        return;
                    }

                    SM.addSample(sample.sample_type, {
                        id: sampleId,
                        label: (sample.payload && sample.payload.label) || sampleId,
                        date: sample.lab_date || sample.sample_date || null,
                        notes: sample.notes || '',
                        zoneType: (sample.payload && sample.payload.zone) || 'other',
                        values: sample.payload
                    });
                    restored++;
                });

                if (typeof SM.setActiveSite === 'function' && originalSite) {
                    SM.setActiveSite(originalSite);
                }

                if (restored > 0) {
                    try {
                        var snap = SM.getAllSamples();
                        _ls.setItem(CONFIG.storageKey, JSON.stringify(snap));
                    } catch (e) {}
                }

                log('SERVER SYNC: Restored ' + restored + ' samples from MySQL');
                onComplete(restored > 0);
            })
            .catch(function(err) {
                warn('Server sample fetch failed: ' + err.message);
                onComplete(false);
            });
    }

    /**
     * Sync the site registry (id + label only) to MySQL.
     * Fire-and-forget — never blocks the save path, never retries.
     * @param {object} sites  { siteId: { label, createdAt } }
     */
    function syncSiteListToServer(sites) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') return Promise.resolve(false);

        // Only sync non-default sites — 'default' always exists client-side
        var toSync = {};
        Object.keys(sites).forEach(function(id) {
            if (id !== 'default') toSync[id] = sites[id];
        });

        if (Object.keys(toSync).length === 0) return Promise.resolve(false);

        return apiFetchJson(base.replace(/\/?$/, '/') + 'sites/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sites: toSync })
        })
            .then(function(data) {
                log('Site list synced to MySQL (' + ((data && data.data && data.data.saved) || 0) + ' sites)');
                return true;
            })
            .catch(function(err) {
                warn('Server site sync failed:', err.message);
                throw err;
            });
    }

    /**
     * Fetch site list from MySQL and merge into SampleManager.
     * Called when localStorage has no data (fresh device / cleared storage).
     * @param {function} onComplete  called when done (with or without server data)
     */
    function fetchSiteListFromServer(onComplete) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') {
            onComplete(false);
            return;
        }

        apiFetchJson(base.replace(/\/?$/, '/') + 'sites')
            .then(function(data) {
                var rows = (data && data.data) || [];
                if (!rows.length) {
                    onComplete(false);
                    return;
                }

                var sites = {};
                rows.forEach(function(site) {
                    if (!site || !site.id) return;
                    sites[site.id] = {
                        label: site.name || site.id,
                        createdAt: site.created_at || ''
                    };
                });

                var keys = Object.keys(sites);
                if (keys.length === 0) {
                    onComplete(false);
                    return;
                }

                var SM = global.GAIP_SampleManager;
                var added = 0;
                keys.forEach(function(siteId) {
                    var label = (sites[siteId] && sites[siteId].label) ? sites[siteId].label : siteId;
                    var existing = SM.getSiteList ? SM.getSiteList() : [];
                    var exists = existing.some(function(s) { return s.id === siteId; });
                    if (!exists && typeof SM.addSiteWithId === 'function') {
                        SM.addSiteWithId(siteId, label);
                        added++;
                    }
                });

                if (added > 0) {
                    log('SERVER SYNC: Imported ' + added + ' sites from MySQL');
                    // Persist the reconstructed site list locally so next load is instant
                    try {
                        var snap = SM.getAllSamples();
                        _ls.setItem(CONFIG.storageKey, JSON.stringify(snap));
                    } catch(e) { /* quota — ignore */ }
                }

                onComplete(added > 0);
            })
            .catch(function() {
                onComplete(false);
            });
    }

    /**
     * Force an immediate save (bypasses debounce).
     * Use before page unload.
     */
    function forceSave(reason) {
        if (_saveTimer) {
            clearTimeout(_saveTimer);
            _saveTimer = null;
        }
        doSave(reason || 'force', _saveCount);
    }

    // =========================================================================
    // RESTORE ON PAGE LOAD
    // =========================================================================

    function restore() {
        if (!global.GAIP_SampleManager) {
            warn('SampleManager not available — cannot restore');
            return;
        }

        function countSnapshotSamples(snapshot) {
            var count = 0;
            var siteKeys = Object.keys((snapshot && snapshot.allSites) || {});
            for (var s = 0; s < siteKeys.length; s++) {
                var site = snapshot.allSites[siteKeys[s]];
                var types = ['soil', 'water', 'tissue', 'loi'];
                for (var t = 0; t < types.length; t++) {
                    if (site[types[t]]) {
                        count += Object.keys(site[types[t]]).length;
                    }
                }
            }
            return count;
        }

        function finishReady(detail) {
            global._gaipSamplePersistenceReady = true;
            document.dispatchEvent(new CustomEvent('gaip:samples-persistence-ready', {
                detail: detail
            }));
        }

        function recoverSitesFromLegacyConfig() {
            try {
                var configsRaw = _ls.getItem('gilba_hub_site_configs');
                if (configsRaw) {
                    var configs = JSON.parse(configsRaw);
                    var siteIds = Object.keys(configs);
                    if (siteIds.length > 0 && global.GAIP_SampleManager) {
                        var SM = global.GAIP_SampleManager;
                        var recovered = 0;
                        siteIds.forEach(function(siteId) {
                            if (siteId === 'default') return;
                            var cfg = configs[siteId];
                            var label = (cfg.location && cfg.location.name)
                                      || (cfg.turf && (cfg.turf.species || cfg.turf.turfType))
                                      || siteId.replace(/_/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
                            var existing = SM.getSiteList ? SM.getSiteList() : [];
                            var exists = existing.some(function(site) { return site.id === siteId; });
                            if (!exists && typeof SM.addSiteWithId === 'function') {
                                SM.addSiteWithId(siteId, label);
                                recovered++;
                            }
                        });
                        if (recovered > 0) {
                            log('RECOVERY: Rebuilt ' + recovered + ' sites from gilba_hub_site_configs');
                            var snap = SM.getAllSamples();
                            _ls.setItem(CONFIG.storageKey, JSON.stringify(snap));
                        }
                    }
                }
            } catch (e) {
                warn('Site recovery failed:', e.message);
            }
        }

        function restoreFromLocalFallback() {
            StorageAdapter.load(CONFIG.storageKey)
                .then(function(data) {
                    if (!data) {
                        log('No local sample snapshot found after server restore miss');
                        recoverSitesFromLegacyConfig();
                        finishReady({ restored: false, count: 0, samplesFromServer: false });
                        return;
                    }

                    var success = global.GAIP_SampleManager.restoreFromPersistence(data);
                    var count = success && data.allSites ? countSnapshotSamples(data) : 0;

                    log('Restored ' + count + ' samples from storage fallback');
                    finishReady({
                        restored: success,
                        count: count,
                        sizeBytes: StorageAdapter.getSize(CONFIG.storageKey),
                        samplesFromServer: false
                    });
                })
                .catch(function(err) {
                    warn('Restore failed: ' + err.message);
                    document.dispatchEvent(new CustomEvent('gaip:samples-persistence-error', {
                        detail: { error: err.message, reason: 'restore' }
                    }));
                });
        }

        log('Attempting server-first sample restore');
        fetchSiteListFromServer(function() {
            fetchSamplesFromServer(function(restoredFromServer) {
                if (restoredFromServer) {
                    var serverSnap = global.GAIP_SampleManager.getAllSamples();
                    finishReady({
                        restored: true,
                        count: countSnapshotSamples(serverSnap),
                        samplesFromServer: true,
                        sizeBytes: StorageAdapter.getSize(CONFIG.storageKey)
                    });
                    return;
                }

                restoreFromLocalFallback();
            });
        });
    }

    // =========================================================================
    // EVENT WIRING
    // =========================================================================

    /**
     * Mutation events from sample-manager that trigger auto-save.
     * Each event maps to a human-readable reason for debug logging.
     */
    var MUTATION_EVENTS = {
        'gaip:samples-imported':     'import',
        'gaip:sample-added':         'add',
        'gaip:sample-updated':       'update',
        'gaip:sample-deleted':       'delete',
        'gaip:sample-renamed':       'rename',
        'gaip:samples-cleared':      'clear',
        'gaip:all-samples-cleared':  'clear-all',
        'gaip:site-changed':         'site-switch',
        'gaip:site-added':           'site-add',
        'gaip:site-renamed':         'site-rename',
        'gaip:site-removed':         'site-remove'
    };

    function bindEvents() {
        var events = Object.keys(MUTATION_EVENTS);
        for (var i = 0; i < events.length; i++) {
            (function(eventName) {
                document.addEventListener(eventName, function() {
                    scheduleSave(MUTATION_EVENTS[eventName]);
                });
            })(events[i]);
        }

        // Save before page unload (synchronous — no debounce)
        window.addEventListener('beforeunload', function() {
            if (_saveTimer) {
                clearTimeout(_saveTimer);
                _saveTimer = null;
            }
            // Synchronous save for beforeunload
            try {
                if (global.GAIP_SampleManager) {
                    var snapshot = global.GAIP_SampleManager.getAllSamples();
                    _ls.setItem(CONFIG.storageKey, JSON.stringify(snapshot));
                }
            } catch (e) {
                // Can't do much here — page is closing
            }
        });

        log('Bound ' + events.length + ' mutation events + beforeunload');
    }

    // =========================================================================
    // INITIALISE
    // =========================================================================

    function init() {
        // Wait for SampleManager if not yet loaded
        if (!global.GAIP_SampleManager) {
            log('Waiting for SampleManager...');
            var checkInterval = setInterval(function() {
                if (global.GAIP_SampleManager) {
                    clearInterval(checkInterval);
                    log('SampleManager detected — initialising persistence');
                    bindEvents();
                    restore();
                }
            }, 100);

            // Give up after 10s
            setTimeout(function() {
                clearInterval(checkInterval);
                if (!global.GAIP_SampleManager) {
                    warn('SampleManager not found after 10s — persistence disabled');
                }
            }, 10000);
            return;
        }

        bindEvents();
        restore();
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GAIP_SamplePersistence = {
        version: CONFIG.version,

        // Manual operations
        save: function() { forceSave('manual'); },
        restore: restore,
        clear: function() {
            return StorageAdapter.delete(CONFIG.storageKey).then(function() {
                log('Storage cleared');
            });
        },

        // Storage info
        getStorageSize: function() {
            return StorageAdapter.getSize(CONFIG.storageKey);
        },
        getStorageSizeFormatted: function() {
            var bytes = StorageAdapter.getSize(CONFIG.storageKey);
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        },

        // Adapter access (for future server migration)
        StorageAdapter: StorageAdapter,

        // Config (for debugging)
        CONFIG: CONFIG
    };

    // =========================================================================
    // START
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    log('v' + CONFIG.version + ' loaded');

})(window);
