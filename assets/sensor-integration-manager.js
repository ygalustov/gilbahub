/**
 * =============================================================================
 * GILBA HUB SENSOR INTEGRATION MANAGER v1.0.0
 * =============================================================================
 *
 * Central manager for live soil sensor integrations. Handles:
 * - Multi-vendor support (Hydrosight, future: Soil Scout, SpecConnect)
 * - Per-user API credentials (stored locally in this Laravel build)
 * - Site-to-sensor mapping (which sensors belong to which site)
 * - "All Sites" aggregation view
 * - Data transformation to GAIP_Sensor interface
 *
 * Architecture:
 *   User logs in → Load credentials from local cache
 *   User selects site → Filter sensors for that site
 *   "All Sites" selected → Aggregate all sensors
 *   Data feeds into existing GAIP_Sensor interface (VWC, EC, SoilTemp)
 *
 * Storage:
 *   localStorage: credentials + site-sensor mappings
 *
 * Dependencies:
 *   - sensor-api-hydrosight.js (vendor adapter)
 *   - sample-manager.js (site list)
 *   - site-config-persistence.js (site switching)
 *
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;


    var VERSION = '1.0.0';
    var DEBUG = false;

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        storageKey: 'gilba_sensor_mappings',
        credentialsCacheKey: 'gilba_sensor_credentials_cache',
        allSitesId: '__all_sites__',
        allSitesLabel: 'All Sites',
        cacheDurationMs: 15 * 60 * 1000, // 15 min
        pollIntervalMs: 30 * 60 * 1000   // 30 min
    };

    // =========================================================================
    // VENDOR REGISTRY
    // =========================================================================

    /**
     * Registered sensor vendors
     * Each vendor must implement: {
     *   id: string,
     *   name: string,
     *   hasCredentials: function() -> bool,
     *   setCredentials: function(key) -> void,
     *   getCredentials: function() -> string|null,
     *   testConnection: async function() -> { success, sensors[], error? },
     *   fetchAllSensors: async function() -> sensors[],
     *   fetchSensorData: async function(sensorIds[]) -> readings[],
     *   transformReading: function(raw) -> { vwc, ec, soilTemp, timestamp, sensorId }
     * }
     */
    var _vendors = {};

    // =========================================================================
    // STATE
    // =========================================================================

    var _state = {
        // Credentials loaded from local storage
        credentials: {},  // { vendorId: apiKey }
        credentialsLoaded: false,
        _lastActiveTs: Date.now(),  // tracks last visible timestamp for wake detection

        // All sensors from all vendors
        allSensors: [],   // [{ vendorId, sensorId, name, locationId, lastReading }]

        // Site-sensor mappings
        // { siteId: { vendorId: [sensorId, ...] } }
        siteMappings: {},

        // Unmapped sensors (sensors not assigned to any site)
        unmappedSensors: [], // [{ vendorId, sensorId, name }]

        // Current site selection (null = All Sites)
        currentSiteId: null,

        // Cached readings per sensor
        sensorReadings: {}, // { 'vendorId:sensorId': { reading, fetchedAt } }

        // Polling
        pollTimer: null,
        isPolling: false,

        // UI state
        settingsPanelOpen: false
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log() {
        if (!DEBUG) return;
        var args = ['[SensorManager]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function warn() {
        var args = ['[SensorManager WARN]'].concat(Array.prototype.slice.call(arguments));
        console.warn.apply(console, args);
    }

    function error() {
        var args = ['[SensorManager ERROR]'].concat(Array.prototype.slice.call(arguments));
        console.error.apply(console, args);
    }

    // =========================================================================
    // VENDOR REGISTRATION
    // =========================================================================

    function registerVendor(vendor) {
        if (!vendor || !vendor.id) {
            error('Invalid vendor registration - missing id');
            return false;
        }
        _vendors[vendor.id] = vendor;
        log('Registered vendor:', vendor.id, vendor.name);
        return true;
    }

    function getVendor(vendorId) {
        return _vendors[vendorId] || null;
    }

    function getVendorList() {
        return Object.keys(_vendors).map(function(id) {
            var v = _vendors[id];
            return {
                id: v.id,
                name: v.name,
                hasCredentials: v.hasCredentials(),
                isConnected: v.hasCredentials() && _state.allSensors.some(function(s) {
                    return s.vendorId === id;
                })
            };
        });
    }

    // =========================================================================
    // CREDENTIALS MANAGEMENT
    // =========================================================================

    async function loadCredentials() {
        loadCredentialsFromCache();
        if (!_state.credentialsLoaded) {
            _state.credentials = {};
            _state.credentialsLoaded = true;
        }
        applyCredentialsToVendors();
        log('Loaded credentials from local storage');
    }

    /**
     * Save credentials to local storage
     */
    async function saveCredentials(vendorId, apiKey) {
        if (apiKey) {
            _state.credentials[vendorId] = apiKey;
        } else {
            delete _state.credentials[vendorId];
        }

        try {
            saveCredentialsToCache();
            applyCredentialsToVendors();
            log('Saved credentials for', vendorId);
            return { success: true };
        } catch (e) {
            error('Error saving credentials:', e);
            return { success: false, error: e.message };
        }
    }

    // Debounce timer for saveSiteMappings — prevents storm of 15+ saves on init
    var _saveMappingsTimer = null;

    /**
     * Save site-sensor mappings locally (debounced — 800ms)
     */
    async function saveSiteMappings() {
        // Always save to localStorage immediately (synchronous, reliable)
        saveMappingsToLocalStorage();

        // Debounce resolution so callers keep the async contract without a server roundtrip
        if (_saveMappingsTimer) clearTimeout(_saveMappingsTimer);
        return new Promise(function(resolve) {
            _saveMappingsTimer = setTimeout(function() {
                _saveMappingsTimer = null;
                resolve({ success: true });
            }, 800);
        });
    }

    function loadCredentialsFromCache() {
        try {
            var cached = _ls.getItem(CONFIG.credentialsCacheKey);
            if (cached) {
                var data = JSON.parse(cached);
                _state.credentials = data.credentials || {};
                _state.credentialsLoaded = true;
                applyCredentialsToVendors();
                log('Loaded credentials from cache');
            }
        } catch (e) {
            warn('Failed to load cached credentials:', e);
        }
    }

    function saveCredentialsToCache() {
        try {
            var cacheData = {
                credentials: _state.credentials,
                cachedAt: Date.now()
            };
            _ls.setItem(CONFIG.credentialsCacheKey, JSON.stringify(cacheData));
        } catch (e) {
            warn('Failed to cache credentials:', e);
        }
    }

    function saveMappingsToLocalStorage() {
        try {
            var data = JSON.stringify(_state.siteMappings);
            _ls.setItem(CONFIG.storageKey, data);
            log('Saved mappings to localStorage (' + Object.keys(_state.siteMappings).length + ' sites)');
        } catch (e) {
            warn('Failed to save mappings to localStorage:', e);
        }
    }

    function loadMappingsFromLocalStorage() {
        try {
            var saved = _ls.getItem(CONFIG.storageKey);
            if (saved) {
                var parsed = JSON.parse(saved);
                // Guard: if localStorage has [] (from prior bug), coerce to {}
                _state.siteMappings = Array.isArray(parsed) ? {} : parsed;
                log('Loaded mappings from localStorage (' + Object.keys(_state.siteMappings).length + ' sites)');
            } else {
                log('No mappings found in localStorage');
            }
        } catch (e) {
            warn('Failed to load mappings from localStorage:', e);
        }
    }

    function applyCredentialsToVendors() {
        Object.keys(_vendors).forEach(function(vendorId) {
            var vendor = _vendors[vendorId];
            var cred = _state.credentials[vendorId];
            if (!vendor.setCredentials) return;
            if (!cred) {
                vendor.setCredentials(null);
                return;
            }
            // Backwards compatibility: older caches may still store { key_set: true }.
            if (typeof cred === 'object' && cred !== null && !Array.isArray(cred)) {
                if (cred.api_key) {
                    vendor.setCredentials(cred.api_key);
                } else if (cred.key_set) {
                    vendor.setCredentials(true);
                }
                return;
            }
            vendor.setCredentials(cred);
        });
    }

    // =========================================================================
    // SENSOR DISCOVERY
    // =========================================================================

    /**
     * Fetch all sensors from all configured vendors
     */
    async function discoverAllSensors() {
        var allSensors = [];

        for (var vendorId in _vendors) {
            var vendor = _vendors[vendorId];
            if (!vendor.hasCredentials()) continue;

            try {
                log('Discovering sensors from', vendor.name);
                var sensors = await vendor.fetchAllSensors();

                sensors.forEach(function(s) {
                    allSensors.push({
                        vendorId: vendorId,
                        vendorName: vendor.name,
                        sensorId: s.sensorId,
                        name: s.name || s.sensorId,
                        locationId: s.locationId,
                        coordinates: s.coordinates,
                        lastReading: s.lastReadings || null
                    });
                });

                log('Found', sensors.length, 'sensors from', vendor.name);
            } catch (e) {
                error('Failed to discover sensors from', vendor.name, e);
            }
        }

        _state.allSensors = allSensors;
        updateUnmappedSensors();

        document.dispatchEvent(new CustomEvent('gaip:sensors:discovered', {
            detail: { sensors: allSensors }
        }));

        return allSensors;
    }

    /**
     * Update list of sensors not mapped to any site
     */
    function updateUnmappedSensors() {
        var mappedIds = new Set();

        Object.keys(_state.siteMappings).forEach(function(siteId) {
            var siteSensors = _state.siteMappings[siteId];
            Object.keys(siteSensors).forEach(function(vendorId) {
                siteSensors[vendorId].forEach(function(sensorId) {
                    mappedIds.add(vendorId + ':' + sensorId);
                });
            });
        });

        _state.unmappedSensors = _state.allSensors.filter(function(s) {
            return !mappedIds.has(s.vendorId + ':' + s.sensorId);
        });
    }

    // =========================================================================
    // SITE-SENSOR MAPPING
    // =========================================================================

    /**
     * Map a sensor to a site
     */
    function mapSensorToSite(siteId, vendorId, sensorId) {
        if (!siteId || siteId === 'default') {
            console.warn('[SensorManager] Blocked attempt to map sensor to default site — select a named site first.');
            return;
        }
        if (!_state.siteMappings[siteId]) {
            _state.siteMappings[siteId] = {};
        }
        if (!_state.siteMappings[siteId][vendorId]) {
            _state.siteMappings[siteId][vendorId] = [];
        }

        // Remove from any other site first
        Object.keys(_state.siteMappings).forEach(function(sid) {
            if (sid === siteId) return;
            var vm = _state.siteMappings[sid][vendorId];
            if (vm) {
                var idx = vm.indexOf(sensorId);
                if (idx >= 0) vm.splice(idx, 1);
            }
        });

        // Add to target site
        if (_state.siteMappings[siteId][vendorId].indexOf(sensorId) < 0) {
            _state.siteMappings[siteId][vendorId].push(sensorId);
        }

        updateUnmappedSensors();
        saveSiteMappings();

        log('Mapped sensor', vendorId + ':' + sensorId, 'to site', siteId);

        // Clear Hydrosight cache for this site so the next fetch uses the new mapping.
        // Without this, stale cached data (fetched before the mapping existed) is served
        // from localStorage for up to 15 minutes, and the sensor filter never fires.
        try {
            var cacheKey = 'gaip_hydrosight_cache_' + siteId;
            _ls.removeItem(cacheKey);
            log('Cleared Hydrosight cache for', siteId, 'after sensor mapping change');
        } catch (e) { /* non-fatal */ }

        // If this is the currently active site, trigger a Hydrosight reload after
        // localStorage is guaranteed written (saveSiteMappings is synchronous for LS).
        var activeSiteId = null;
        try {
            var SM = global.GAIP_SampleManager;
            activeSiteId = SM && typeof SM.getActiveSiteId === 'function' ? SM.getActiveSiteId() : null;
        } catch (e) { /* ignore */ }

        if (activeSiteId && activeSiteId === siteId) {
            setTimeout(function() {
                document.dispatchEvent(new CustomEvent('gaip:site-changed', {
                    detail: { siteId: siteId, reason: 'sensor-mapping-changed' }
                }));
                log('Dispatched gaip:site-changed to reload Hydrosight for', siteId);
            }, 300);
        }
    }

    /**
     * Unmap a sensor from its site
     */
    function unmapSensor(vendorId, sensorId) {
        Object.keys(_state.siteMappings).forEach(function(siteId) {
            var vm = _state.siteMappings[siteId][vendorId];
            if (vm) {
                var idx = vm.indexOf(sensorId);
                if (idx >= 0) vm.splice(idx, 1);
            }
        });

        updateUnmappedSensors();
        saveSiteMappings();

        log('Unmapped sensor', vendorId + ':' + sensorId);

        // Clear cache for all sites that previously had this sensor — simplest is
        // to iterate all known sites. On next fetch each will re-filter correctly.
        try {
            Object.keys(_state.siteMappings).forEach(function(sid) {
                _ls.removeItem('gaip_hydrosight_cache_' + sid);
            });
        } catch (e) { /* non-fatal */ }
    }

    /**
     * Get sensors for a specific site
     */
    function getSensorsForSite(siteId) {
        if (siteId === CONFIG.allSitesId || !siteId) {
            // All Sites - return all mapped sensors
            return _state.allSensors.filter(function(s) {
                return !_state.unmappedSensors.some(function(u) {
                    return u.vendorId === s.vendorId && u.sensorId === s.sensorId;
                });
            });
        }

        var siteSensors = _state.siteMappings[siteId];
        if (!siteSensors) return [];

        var result = [];
        Object.keys(siteSensors).forEach(function(vendorId) {
            var sensorIds = siteSensors[vendorId] || [];
            sensorIds.forEach(function(sensorId) {
                var sensor = _state.allSensors.find(function(s) {
                    return s.vendorId === vendorId && s.sensorId === sensorId;
                });
                if (sensor) result.push(sensor);
            });
        });

        return result;
    }

    /**
     * Get site that a sensor belongs to
     */
    function getSiteForSensor(vendorId, sensorId) {
        for (var siteId in _state.siteMappings) {
            var vm = _state.siteMappings[siteId][vendorId];
            if (vm && vm.indexOf(sensorId) >= 0) {
                return siteId;
            }
        }
        return null;
    }

    // =========================================================================
    // DATA FETCHING
    // =========================================================================

    /**
     * Fetch latest readings for current site's sensors
     */
    async function fetchCurrentSiteData(forceRefresh) {
        var sensors = getSensorsForSite(_state.currentSiteId);
        if (sensors.length === 0) {
            log('No sensors for current site');
            return null;
        }

        // Group by vendor
        var byVendor = {};
        sensors.forEach(function(s) {
            if (!byVendor[s.vendorId]) byVendor[s.vendorId] = [];
            byVendor[s.vendorId].push(s.sensorId);
        });

        var allReadings = [];

        for (var vendorId in byVendor) {
            var vendor = _vendors[vendorId];
            if (!vendor) continue;

            var sensorIds = byVendor[vendorId];

            // Check cache first
            if (!forceRefresh) {
                var cached = getCachedReadings(vendorId, sensorIds);
                if (cached.length === sensorIds.length) {
                    allReadings = allReadings.concat(cached);
                    continue;
                }
            }

            try {
                var readings = await vendor.fetchSensorData(sensorIds);
                readings.forEach(function(r) {
                    var transformed = vendor.transformReading(r);
                    transformed.vendorId = vendorId;
                    cacheReading(vendorId, transformed.sensorId, transformed);
                    allReadings.push(transformed);
                });
            } catch (e) {
                error('Failed to fetch data from', vendor.name, e);
            }
        }

        return aggregateReadings(allReadings);
    }

    function getCachedReadings(vendorId, sensorIds) {
        var now = Date.now();
        var results = [];

        sensorIds.forEach(function(sensorId) {
            var key = vendorId + ':' + sensorId;
            var cached = _state.sensorReadings[key];
            if (cached && (now - cached.fetchedAt) < CONFIG.cacheDurationMs) {
                results.push(cached.reading);
            }
        });

        return results;
    }

    function cacheReading(vendorId, sensorId, reading) {
        var key = vendorId + ':' + sensorId;
        _state.sensorReadings[key] = {
            reading: reading,
            fetchedAt: Date.now()
        };
    }

    /**
     * Aggregate multiple sensor readings into summary stats
     */
    function aggregateReadings(readings) {
        if (!readings || readings.length === 0) return null;

        var vwcValues = [];
        var ecValues = [];
        var tempValues = [];

        readings.forEach(function(r) {
            if (r.vwc !== null && r.vwc !== undefined && !isNaN(r.vwc)) {
                vwcValues.push(r.vwc);
            }
            if (r.ec !== null && r.ec !== undefined && !isNaN(r.ec)) {
                ecValues.push(r.ec);
            }
            if (r.soilTemp !== null && r.soilTemp !== undefined && !isNaN(r.soilTemp)) {
                tempValues.push(r.soilTemp);
            }
        });

        return {
            readings: readings,
            sensorCount: readings.length,
            vwc: calcStats(vwcValues),
            ec: calcStats(ecValues),
            soilTemp: calcStats(tempValues),
            fetchedAt: new Date().toISOString(),
            siteId: _state.currentSiteId,
            isAllSites: _state.currentSiteId === CONFIG.allSitesId || !_state.currentSiteId
        };
    }

    function calcStats(values) {
        if (!values || values.length === 0) return null;
        var n = values.length;
        var sum = 0;
        for (var i = 0; i < n; i++) sum += values[i];
        var mean = sum / n;
        var min = Math.min.apply(null, values);
        var max = Math.max.apply(null, values);
        var variance = 0;
        for (var j = 0; j < n; j++) variance += Math.pow(values[j] - mean, 2);
        var stdDev = Math.sqrt(variance / n);
        return { mean: mean, min: min, max: max, stdDev: stdDev, count: n };
    }

    // =========================================================================
    // GAIP_SENSOR INTERFACE
    // =========================================================================

    /**
     * Check if we have sensor data available for current site
     */
    function hasData() {
        var sensors = getSensorsForSite(_state.currentSiteId);
        return sensors.length > 0;
    }

    /**
     * Get irrigation data in GAIP_Sensor format
     */
    async function getIrrigationData() {
        var data = await fetchCurrentSiteData(false);
        if (!data) return null;

        return {
            source: 'Live Sensors',
            deviceName: 'Multi-Sensor (' + data.sensorCount + ')',
            importDate: data.fetchedAt,
            measurementDepth: 100, // Default assumption
            vwc: data.vwc ? data.vwc.mean : null,
            vwcMin: data.vwc ? data.vwc.min : null,
            vwcMax: data.vwc ? data.vwc.max : null,
            vwcStdDev: data.vwc ? data.vwc.stdDev : null,
            ec: data.ec ? data.ec.mean : null,
            ecMin: data.ec ? data.ec.min : null,
            ecMax: data.ec ? data.ec.max : null,
            soilTemp: data.soilTemp ? data.soilTemp.mean : null,
            soilTempMin: data.soilTemp ? data.soilTemp.min : null,
            soilTempMax: data.soilTemp ? data.soilTemp.max : null,
            salinityIndex: data.ec ? data.ec.mean : null,
            sensorCount: data.sensorCount,
            isLive: true,
            isAllSites: data.isAllSites,
            perSensorReadings: data.readings
        };
    }

    /**
     * Get water quality data in GAIP_Sensor format
     */
    async function getWaterQualityData() {
        var data = await fetchCurrentSiteData(false);
        if (!data || !data.ec) return null;

        return {
            source: 'Live Sensors',
            soilEC: data.ec.mean,
            soilECMin: data.ec.min,
            soilECMax: data.ec.max,
            soilECStdDev: data.ec.stdDev,
            salinityIndex: data.ec.mean,
            sensorCount: data.sensorCount,
            isLive: true
        };
    }

    // =========================================================================
    // SITE SELECTION
    // =========================================================================

    /**
     * Set current site for data filtering
     */
    function setCurrentSite(siteId) {
        _state.currentSiteId = siteId;
        log('Current site set to:', siteId || 'All Sites');

        document.dispatchEvent(new CustomEvent('gaip:sensor:siteChanged', {
            detail: {
                siteId: siteId,
                sensors: getSensorsForSite(siteId)
            }
        }));
    }

    /**
     * Get list of sites that have sensors
     */
    function getSitesWithSensors() {
        var sites = [];
        var SM = global.GAIP_SampleManager;

        // Add "All Sites" as first option
        var allSitesSensorCount = _state.allSensors.length - _state.unmappedSensors.length;
        if (allSitesSensorCount > 0) {
            sites.push({
                id: CONFIG.allSitesId,
                label: CONFIG.allSitesLabel + ' (' + allSitesSensorCount + ' sensors)',
                sensorCount: allSitesSensorCount,
                isAllSites: true
            });
        }

        // Get site list from SampleManager
        if (SM && SM.getSiteList) {
            var siteList = SM.getSiteList();
            siteList.forEach(function(site) {
                var sensors = getSensorsForSite(site.id);
                if (sensors.length > 0) {
                    sites.push({
                        id: site.id,
                        label: site.label + ' (' + sensors.length + ' sensors)',
                        sensorCount: sensors.length,
                        isAllSites: false
                    });
                }
            });
        }

        return sites;
    }

    // =========================================================================
    // POLLING
    // =========================================================================

    function startPolling() {
        if (_state.pollTimer) clearInterval(_state.pollTimer);

        _state.isPolling = true;
        _state.pollTimer = setInterval(async function() {
            try {
                await fetchCurrentSiteData(true);
                document.dispatchEvent(new CustomEvent('gaip:sensor:updated'));
            } catch (e) {
                error('Polling error:', e);
            }
        }, CONFIG.pollIntervalMs);

        log('Started polling every', CONFIG.pollIntervalMs / 60000, 'minutes');
    }

    function stopPolling() {
        if (_state.pollTimer) {
            clearInterval(_state.pollTimer);
            _state.pollTimer = null;
        }
        _state.isPolling = false;
        log('Stopped polling');
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    async function init() {
        log('Initializing v' + VERSION);

        // Load mappings from localStorage first (fast)
        loadMappingsFromLocalStorage();

        // Load credentials from local storage
        await loadCredentials();

        // Discover sensors if we have any credentials
        if (Object.keys(_state.credentials).length > 0) {
            await discoverAllSensors();

            // Start polling if we have sensors
            if (_state.allSensors.length > 0) {
                startPolling();
            }
        }

        // Listen for site changes
        document.addEventListener('gaip:siteChanged', function(e) {
            if (e.detail && e.detail.siteId) {
                setCurrentSite(e.detail.siteId);
            }
        });

        // Set default to All Sites
        setCurrentSite(CONFIG.allSitesId);

        log('Initialized with', _state.allSensors.length, 'sensors');

        // ── Wake-from-sleep / tab-restore recovery ──────────────────────────
        // After sleep or network restore, re-apply locally stored credentials
        // and re-discover sensors so adapters recover cleanly.
        document.addEventListener('visibilitychange', async function() {
            if (document.visibilityState === 'visible') {
                var now = Date.now();
                var hiddenDuration = now - (_state._lastActiveTs || now);
                _state._lastActiveTs = now;

                // Only act if hidden for > 5 minutes (avoids tab-switching noise)
                if (hiddenDuration > 5 * 60 * 1000) {
                    log('Woke from sleep/background (' + Math.round(hiddenDuration / 60000) + ' min hidden) — reloading credentials and re-discovering sensors');
                    try {
                        await loadCredentials();
                        if (Object.keys(_state.credentials).length > 0) {
                            await discoverAllSensors();
                            if (!_state.isPolling && _state.allSensors.length > 0) {
                                startPolling();
                            }
                        }
                    } catch (e) {
                        error('Wake recovery failed:', e);
                    }
                }
            } else {
                // Record when we go hidden
                _state._lastActiveTs = Date.now();
            }
        });

        // Network restore (e.g. laptop reconnects to wifi after wake)
        window.addEventListener('online', async function() {
            log('Network restored — reloading credentials and re-discovering sensors');
            try {
                await loadCredentials();
                if (Object.keys(_state.credentials).length > 0) {
                    await discoverAllSensors();
                    if (!_state.isPolling && _state.allSensors.length > 0) {
                        startPolling();
                    }
                }
            } catch (e) {
                error('Network restore recovery failed:', e);
            }
        });
        // ────────────────────────────────────────────────────────────────────

        document.dispatchEvent(new CustomEvent('gaip:sensorManager:ready'));
    }

    // Auto-init when DOM ready
    // b35fix248: async init() passed bare to setTimeout — rejected promise was uncaught.
    // Wrap in arrow function so .catch() is applied to the returned Promise.
    function _safeInit() { init().catch(function(e) { console.warn('[SensorManager] init failed:', e.message); }); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(_safeInit, 100);
        });
    } else {
        setTimeout(_safeInit, 100);
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_SensorManager = {
        // Version
        VERSION: VERSION,

        // Vendor management
        registerVendor: registerVendor,
        getVendor: getVendor,
        getVendorList: getVendorList,

        // Credentials
        loadCredentials: loadCredentials,
        saveCredentials: saveCredentials,
        hasCredentials: function(vendorId) {
            var cred = _state.credentials[vendorId];
            if (!cred) return false;
            return (typeof cred === 'object') ? !!cred.key_set : !!cred;
        },

        // Sensor discovery
        discoverAllSensors: discoverAllSensors,
        getAllSensors: function() { return _state.allSensors.slice(); },
        getUnmappedSensors: function() { return _state.unmappedSensors.slice(); },

        // Site-sensor mapping
        mapSensorToSite: mapSensorToSite,
        unmapSensor: unmapSensor,
        getSensorsForSite: getSensorsForSite,
        getSiteForSensor: getSiteForSensor,
        getSiteMappings: function() { return JSON.parse(JSON.stringify(_state.siteMappings)); },
        saveSiteMappings: saveSiteMappings,

        // Site selection
        setCurrentSite: setCurrentSite,
        getCurrentSiteId: function() { return _state.currentSiteId; },
        getSitesWithSensors: getSitesWithSensors,
        ALL_SITES_ID: CONFIG.allSitesId,

        // Data fetching
        fetchCurrentSiteData: fetchCurrentSiteData,

        // GAIP_Sensor interface
        hasData: hasData,
        getIrrigationData: getIrrigationData,
        getWaterQualityData: getWaterQualityData,

        // Polling
        startPolling: startPolling,
        stopPolling: stopPolling,
        isPolling: function() { return _state.isPolling; },

        // State access (for debugging)
        getState: function() { return _state; }
    };

    log('Module loaded');

})(window);
