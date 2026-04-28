/**
 * Gilba Hub - Hydrosight API Adapter
 * Version 1.1.0
 * 
 * Connects to Hydrosight API for live sensor data from Hydrosight wireless
 * soil monitors (Australian company - gethydrosight.com.au).
 * 
 * v1.1.0: Uses WP-Ajax proxy to bypass CORS restrictions
 * 
 * Data feeds into existing GAIP_Sensor interface for seamless integration
 * with Climate Engine, Irrigation Scheduler, and Disease modules.
 * 
 * API: https://api.hydrosight.au/v1 (via WordPress proxy)
 * Auth: x-api-key header (passed through proxy)
 * 
 * Endpoints:
 * - GET /locations - List all locations
 * - GET /locations/:locationId - Get location details
 * - GET /sensors - List sensors (optional ?locationId filter)
 * - GET /sensors/:sensorId - Get sensor with lastReadings
 * - GET /sensors/:sensorId/data?periodType=Day|Week|Month - Aggregated data
 * - GET /sensors/:sensorId/rawdata?startDateTime=&endDateTime= - Raw readings
 * 
 * Sensor data:
 * - moisture (% VWC)
 * - temperature (°C soil temp)
 * - salinity (dS/m EC)
 */

(function(global) {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;


    // ============================================
    // CONFIGURATION
    // ============================================
    
    var CONFIG = {
        // Use WordPress AJAX proxy to bypass CORS
        proxyUrl: (typeof ajaxurl !== 'undefined') ? ajaxurl : '/wp-admin/admin-ajax.php',
        proxyAction: 'gilba_hydrosight_proxy',
        storageKeyBase: 'gaip_hydrosight_config',
        cacheKeyBase: 'gaip_hydrosight_cache',
        cacheDurationMs: 15 * 60 * 1000,
        cacheVersion: 2,  // bump when sensor-filter logic changes to bust stale caches
        pollIntervalMs: 30 * 60 * 1000,
        maxRetries: 3,
        retryDelayMs: 2000
    };

    // ============================================
    // SITE-SCOPED STORAGE KEY HELPERS
    // ============================================

    function getActiveSiteId() {
        try {
            var SM = global.GAIP_SampleManager;
            if (SM && typeof SM.getActiveSiteId === 'function') {
                return SM.getActiveSiteId() || 'default';
            }
        } catch (e) { /* ignore */ }
        return 'default';
    }

    function storageKey() {
        return CONFIG.storageKeyBase + '_' + getActiveSiteId();
    }

    function cacheKey() {
        return CONFIG.cacheKeyBase + '_' + getActiveSiteId();
    }

    // Migrate legacy keys to current site on first load.
    // Checks three possible legacy locations in priority order:
    //   1. gaip_hydrosight_config          (original global key)
    //   2. gaip_hydrosight_config_default  (mis-migrated on early load before siteId resolved)
    function migrateGlobalConfig() {
        try {
            var siteKey = storageKey();
            if (_ls.getItem(siteKey)) return; // already have site-scoped data

            // Only migrate to sites that have sensors actually mapped in SensorManager.
            // Migrating to an unmapped site contaminates it with another site's API key
            // and causes false sensor readings via bleed-over from the shared Hydrosight account.
            var activeSiteId = getActiveSiteId();
            if (activeSiteId && activeSiteId !== 'default') {
                var SM = global.GAIP_SensorManager;
                if (SM && typeof SM.getSiteMappings === 'function') {
                    var _mig = SM.getSiteMappings()[activeSiteId];
                    var mapped = _mig && Object.keys(_mig).some(function(v) { return _mig[v] && _mig[v].length > 0; });
                    if (!mapped) {
                        console.log('[Hydrosight] Skipping migration for unmapped site:', activeSiteId);
                        return;
                    }
                }
            }

            var legacyKeys = [
                CONFIG.storageKeyBase,
                CONFIG.storageKeyBase + '_default'
            ];

            for (var i = 0; i < legacyKeys.length; i++) {
                var legacy = _ls.getItem(legacyKeys[i]);
                if (legacy) {
                    _ls.setItem(siteKey, legacy);
                    _ls.removeItem(legacyKeys[i]);
                    console.log('[Hydrosight] Migrated', legacyKeys[i], '→', siteKey);
                    return;
                }
            }
        } catch (e) { /* ignore */ }
    }

    var DEVICE_INFO = {
        name: 'Hydrosight Soil Monitor',
        manufacturer: 'Hydrosight',
        defaultDepth: 100,
        depthOptions: [100, 200, 300],
        ecUnit: 'dS/m',
        features: ['vwc', 'ec', 'soilTemp'],
        description: 'Wireless buried soil sensors via Hydrosight API'
    };

    // ============================================
    // STATE
    // ============================================
    
    var state = {
        apiKey: null,       // raw key — only used in testConnection UI flow
        keyConfigured: false, // true when server-side key exists (b35fix292)
        enabled: false,
        locations: [],
        sensors: [],
        sensorZoneMapping: {},
        cachedReadings: null,
        lastFetch: null,
        pollTimer: null,
        isPolling: false,
        connectionTested: false
    };

    // ============================================
    // STORAGE
    // ============================================
    
    function saveConfig() {
        if (!_siteReady) return;  // don't write until siteId resolves
        try {
            var config = {
                apiKey: state.apiKey, // only set in testConnection path
                keyConfigured: state.keyConfigured,
                enabled: state.enabled,
                sensorZoneMapping: state.sensorZoneMapping
            };
            _ls.setItem(storageKey(), JSON.stringify(config));
        } catch (e) {
            console.warn('[Hydrosight] Failed to save config:', e);
        }
    }

    function loadConfig() {
        try {
            var saved = _ls.getItem(storageKey());
            if (saved) {
                var config = JSON.parse(saved);
                state.apiKey = config.apiKey || null;
                state.keyConfigured = !!(config.apiKey || config.keyConfigured);
                state.enabled = config.enabled || false;
                state.sensorZoneMapping = config.sensorZoneMapping || {};
                return true;
            }
        } catch (e) {
            console.warn('[Hydrosight] Failed to load config:', e);
        }
        return false;
    }

    function saveCache(data) {
        try {
            var cache = { data: data, timestamp: Date.now(), v: CONFIG.cacheVersion };
            _ls.setItem(cacheKey(), JSON.stringify(cache));
        } catch (e) {
            console.warn('[Hydrosight] Failed to save cache:', e);
        }
    }

    function loadCache() {
        try {
            var saved = _ls.getItem(cacheKey());
            if (saved) {
                var cache = JSON.parse(saved);
                if (cache.v === CONFIG.cacheVersion && Date.now() - cache.timestamp < CONFIG.cacheDurationMs) {
                    return cache.data;
                }
            }
        } catch (e) {
            console.warn('[Hydrosight] Failed to load cache:', e);
        }
        return null;
    }

    function clearCache() {
        try { _ls.removeItem(cacheKey()); } catch (e) {}
    }

    // ============================================
    // API CALLS (via WP-Ajax Proxy)
    // ============================================
    
    /**
     * Get the nonce for AJAX requests
     */
    function getNonce() {
        // Try GAIP_HUB_CONFIG (main hub config)
        if (typeof GAIP_HUB_CONFIG !== 'undefined' && GAIP_HUB_CONFIG.nonce) {
            return GAIP_HUB_CONFIG.nonce;
        }
        // Try GAIP_WIZARD_CONFIG (wizard config)
        if (typeof GAIP_WIZARD_CONFIG !== 'undefined' && GAIP_WIZARD_CONFIG.nonce) {
            return GAIP_WIZARD_CONFIG.nonce;
        }
        // Fallback: look for nonce in hidden input
        var nonceInput = document.querySelector('input[name="gilba_hub_nonce"]');
        if (nonceInput) {
            return nonceInput.value;
        }
        return '';
    }

    async function apiRequest(endpoint, options) {
        if (!state.keyConfigured) {
            throw new Error('Hydrosight API key not configured');
        }

        var nonce = getNonce();
        if (!nonce) {
            throw new Error('Security nonce not found - please refresh the page');
        }

        var formData = new FormData();
        formData.append('action', CONFIG.proxyAction);
        formData.append('nonce', nonce);
        // Security fix b35fix292: api_key no longer sent from JS.
        // Server retrieves key from user meta in the proxy handler.
        formData.append('endpoint', endpoint);

        var retries = 0;
        while (retries < CONFIG.maxRetries) {
            try {
                var response = await fetch(CONFIG.proxyUrl, {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                
                var result = await response.json();
                
                if (result.success) {
                    return result.data;
                } else {
                    var errorMsg = result.data && result.data.message ? result.data.message : 'API request failed';
                    var statusCode = result.data && result.data.status ? result.data.status : response.status;
                    
                    // Don't retry on auth failures - they won't succeed
                    if (statusCode === 401 || statusCode === 403) {
                        throw new Error(errorMsg);
                    }
                    
                    throw new Error(errorMsg);
                }
            } catch (e) {
                retries++;
                // Don't retry auth or config errors
                if (e.message.indexOf('API key') >= 0 || e.message.indexOf('nonce') >= 0 || 
                    e.message.indexOf('Invalid') >= 0 || e.message.indexOf('expired') >= 0) {
                    throw e;
                }
                if (retries >= CONFIG.maxRetries) throw e;
                await new Promise(function(r) { setTimeout(r, CONFIG.retryDelayMs * retries); });
            }
        }
    }

    async function fetchLocations() {
        console.log('[Hydrosight] Fetching locations...');
        var data = await apiRequest('/locations/');
        state.locations = data.items || [];
        console.log('[Hydrosight] Found', state.locations.length, 'locations');
        return state.locations;
    }

    async function fetchSensors(locationId) {
        var endpoint = '/sensors';
        if (locationId) endpoint += '?locationId=' + encodeURIComponent(locationId);
        
        console.log('[Hydrosight] Fetching sensors...');
        var data = await apiRequest(endpoint);
        state.sensors = data.items || [];
        console.log('[Hydrosight] Found', state.sensors.length, 'sensors');
        return state.sensors;
    }

    async function fetchSensor(sensorId) {
        return await apiRequest('/sensors/' + encodeURIComponent(sensorId));
    }

    async function fetchSensorData(sensorId, periodType) {
        periodType = periodType || 'Week';
        var endpoint = '/sensors/' + encodeURIComponent(sensorId) + '/data?periodType=' + periodType;
        var data = await apiRequest(endpoint);
        return data.items || [];
    }

    async function fetchSensorRawData(sensorId, startDate, endDate) {
        var endpoint = '/sensors/' + encodeURIComponent(sensorId) + 
                       '/rawdata?startDateTime=' + encodeURIComponent(startDate.toISOString()) + 
                       '&endDateTime=' + encodeURIComponent(endDate.toISOString());
        var data = await apiRequest(endpoint);
        return data.items || [];
    }

    // ============================================
    // DATA TRANSFORMATION
    // ============================================
    
    function transformToGAIPFormat(sensors) {
        var readings = [];
        var zones = {};
        var allMoisture = [];
        var allTemp = [];
        var allEC = [];

        sensors.forEach(function(sensor) {
            if (!sensor.lastReadings) return;

            var zoneName = state.sensorZoneMapping[sensor.sensorId] || sensor.name || 'Sensor ' + sensor.sensorId.substring(0, 8);
            var reading = sensor.lastReadings;
            
            var moisture = parseFloat(reading.moisture);
            var temp = parseFloat(reading.temperature);
            var salinity = parseFloat(reading.salinity);
            var ec = isNaN(salinity) ? null : salinity;

            var transformedReading = {
                zoneName: zoneName,
                timestamp: reading.dateTime,
                vwc: isNaN(moisture) ? null : moisture,
                soilTemp: isNaN(temp) ? null : temp,
                ec: ec,
                salinityIndex: ec,
                latitude: sensor.coordinates ? parseFloat(sensor.coordinates.latitude) : null,
                longitude: sensor.coordinates ? parseFloat(sensor.coordinates.longitude) : null,
                sensorId: sensor.sensorId,
                locationId: sensor.locationId,
                deviceType: 'HYDROSIGHT'
            };

            readings.push(transformedReading);

            if (!isNaN(moisture)) allMoisture.push(moisture);
            if (!isNaN(temp)) allTemp.push(temp);
            if (ec !== null) allEC.push(ec);

            if (!zones[zoneName]) {
                zones[zoneName] = {
                    name: zoneName,
                    readings: [],
                    stats: null,
                    sensorId: sensor.sensorId,
                    locationId: sensor.locationId
                };
            }
            zones[zoneName].readings.push(transformedReading);
        });

        Object.keys(zones).forEach(function(zoneId) {
            var zone = zones[zoneId];
            var vwcVals = zone.readings.map(function(r) { return r.vwc; }).filter(function(v) { return v !== null; });
            var tempVals = zone.readings.map(function(r) { return r.soilTemp; }).filter(function(v) { return v !== null; });
            var ecVals = zone.readings.map(function(r) { return r.ec; }).filter(function(v) { return v !== null; });

            zone.stats = {
                count: zone.readings.length,
                vwc: vwcVals.length > 0 ? calcStats(vwcVals) : null,
                soilTemp: tempVals.length > 0 ? calcStats(tempVals) : null,
                ec: ecVals.length > 0 ? calcStats(ecVals) : null
            };
        });

        var summary = {
            count: readings.length,
            vwc: allMoisture.length > 0 ? calcStats(allMoisture) : null,
            soilTemp: allTemp.length > 0 ? calcStats(allTemp) : null,
            ec: allEC.length > 0 ? calcStats(allEC) : null
        };

        return {
            readings: readings,
            zones: zones,
            summary: summary,
            deviceType: 'HYDROSIGHT',
            deviceConfig: DEVICE_INFO,
            measurementDepth: DEVICE_INFO.defaultDepth,
            importDate: new Date().toISOString(),
            source: 'api',
            isLive: true
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

    // ============================================
    // MAIN DATA FETCH
    // ============================================
    
    async function fetchLiveData(forceRefresh) {
        if (!state.enabled || !state.keyConfigured) {
            console.log('[Hydrosight] Not enabled or no API key');
            return null;
        }

        if (!forceRefresh) {
            var cached = loadCache();
            if (cached) {
                console.log('[Hydrosight] Using cached data');
                state.cachedReadings = cached;
                return cached;
            }
        }

        try {
            console.log('[Hydrosight] Fetching live sensor data...');
            
            var sensors = await fetchSensors();

            // Filter to only sensors mapped to the active site.
            // Without this, all sensors on the Hydrosight account are averaged together,
            // producing a meaningless cross-site soil temperature.
            var mappedSensorIds = [];
            try {
                var SM = global.GAIP_SampleManager;
                var activeSiteId = SM && typeof SM.getActiveSiteId === 'function' ? SM.getActiveSiteId() : null;
                if (activeSiteId) {
                    var SensorMgr = global.GAIP_SensorManager;
                    var mappings = SensorMgr && typeof SensorMgr.getSiteMappings === 'function'
                        ? SensorMgr.getSiteMappings()
                        : (typeof localStorage !== 'undefined' ? JSON.parse(_ls.getItem('gilba_sensor_mappings') || '{}') : {});
                    var siteMap = mappings[activeSiteId] || {};
                    mappedSensorIds = siteMap.hydrosight || [];
                }
            } catch (e) { /* non-fatal — fall through to all sensors */ }

            var sensorsToUse = mappedSensorIds.length > 0
                ? sensors.filter(function(s) { return mappedSensorIds.indexOf(s.sensorId) !== -1; })
                : sensors;

            if (mappedSensorIds.length > 0 && sensorsToUse.length === 0) {
                console.warn('[Hydrosight] Mapped sensor IDs not found in account sensors — falling back to all sensors');
                sensorsToUse = sensors;
            }

            console.log('[Hydrosight] Using', sensorsToUse.length, 'of', sensors.length, 'sensors for active site');

            var sensorsWithData = [];
            
            for (var i = 0; i < sensorsToUse.length; i++) {
                var sensor = sensorsToUse[i];
                if (!sensor.lastReadings) {
                    try {
                        var fullSensor = await fetchSensor(sensor.sensorId);
                        sensorsWithData.push(fullSensor);
                    } catch (e) {
                        console.warn('[Hydrosight] Failed to fetch sensor', sensor.sensorId, e);
                        sensorsWithData.push(sensor);
                    }
                } else {
                    sensorsWithData.push(sensor);
                }
            }

            var gaipData = transformToGAIPFormat(sensorsWithData);
            
            state.cachedReadings = gaipData;
            state.lastFetch = new Date();
            saveCache(gaipData);
            
            console.log('[Hydrosight] Fetched', gaipData.readings.length, 'readings from', 
                        Object.keys(gaipData.zones).length, 'sensors');
            
            document.dispatchEvent(new CustomEvent('gaip:hydrosight:updated', { detail: gaipData }));
            
            return gaipData;
            
        } catch (e) {
            console.error('[Hydrosight] Fetch failed:', e);
            if (state.cachedReadings) {
                console.log('[Hydrosight] Returning stale cached data after error');
                return state.cachedReadings;
            }
            throw e;
        }
    }

    // ============================================
    // GAIP_SENSOR INTERFACE METHODS
    // ============================================
    
    function hasData() {
        return state.enabled && state.cachedReadings && state.cachedReadings.readings.length > 0;
    }

    function getIrrigationData() {
        var data = state.cachedReadings;
        if (!data || !data.summary) return null;

        var stats = data.summary;
        return {
            source: 'Hydrosight',
            deviceName: DEVICE_INFO.name,
            importDate: data.importDate,
            measurementDepth: data.measurementDepth,
            vwc: stats.vwc ? stats.vwc.mean : null,
            vwcMin: stats.vwc ? stats.vwc.min : null,
            vwcMax: stats.vwc ? stats.vwc.max : null,
            vwcStdDev: stats.vwc ? stats.vwc.stdDev : null,
            ec: stats.ec ? stats.ec.mean : null,
            ecMin: stats.ec ? stats.ec.min : null,
            ecMax: stats.ec ? stats.ec.max : null,
            soilTemp: stats.soilTemp ? stats.soilTemp.mean : null,
            surfaceTemp: null,
            salinityIndex: stats.ec ? stats.ec.mean : null,
            zoneCount: Object.keys(data.zones).length,
            readingCount: data.readings.length,
            isLive: true,
            lastFetch: state.lastFetch ? state.lastFetch.toISOString() : null,
            zones: Object.keys(data.zones).map(function(zId) {
                var z = data.zones[zId];
                return {
                    name: z.name,
                    vwc: z.stats.vwc ? z.stats.vwc.mean : null,
                    vwcStdDev: z.stats.vwc ? z.stats.vwc.stdDev : null,
                    ec: z.stats.ec ? z.stats.ec.mean : null,
                    soilTemp: z.stats.soilTemp ? z.stats.soilTemp.mean : null,
                    salinityIndex: z.stats.ec ? z.stats.ec.mean : null,
                    count: z.stats.count,
                    sensorId: z.sensorId
                };
            })
        };
    }

    function getWaterQualityData() {
        var data = state.cachedReadings;
        if (!data || !data.summary || !data.summary.ec) return null;

        return {
            source: 'Hydrosight',
            soilEC: data.summary.ec.mean,
            soilECMin: data.summary.ec.min,
            soilECMax: data.summary.ec.max,
            soilECStdDev: data.summary.ec.stdDev,
            salinityIndex: data.summary.ec.mean,
            readingCount: data.readings.filter(function(r) { return r.ec !== null; }).length,
            isLive: true
        };
    }

    function getSummary() {
        return state.cachedReadings ? state.cachedReadings.summary : null;
    }

    function getZones() {
        return state.cachedReadings ? state.cachedReadings.zones : {};
    }

    function getReadings() {
        return state.cachedReadings ? state.cachedReadings.readings.slice() : [];
    }

    // ============================================
    // POLLING
    // ============================================
    
    function startPolling() {
        if (state.pollTimer) clearInterval(state.pollTimer);
        if (!state.enabled || !state.keyConfigured) return;

        state.isPolling = true;
        state.pollTimer = setInterval(async function() {
            try { await fetchLiveData(true); } 
            catch (e) { console.error('[Hydrosight] Polling error:', e); }
        }, CONFIG.pollIntervalMs);
        
        console.log('[Hydrosight] Started polling every', CONFIG.pollIntervalMs / 60000, 'minutes');
    }

    function stopPolling() {
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
        state.isPolling = false;
        console.log('[Hydrosight] Stopped polling');
    }

    // ============================================
    // CONFIGURATION
    // ============================================
    
    function configure(apiKey, enabled) {
        // b35fix292: apiKey may now be boolean true (key exists server-side)
        // or a raw key string (from testConnection UI flow — key entered manually).
        // Store raw key only for testConnection path; normal operation uses server-side key.
        if (typeof apiKey === 'string' && apiKey.length > 0) {
            state.apiKey = apiKey;
            state.keyConfigured = true;
        } else if (apiKey === true) {
            state.apiKey = null; // don't store in JS state
            state.keyConfigured = true;
        } else {
            state.apiKey = null;
            state.keyConfigured = false;
        }
        state.enabled = enabled || false;
        saveConfig();
        
        if (state.enabled && state.keyConfigured) startPolling();
        else stopPolling();
    }

    function setZoneMapping(sensorId, zoneName) {
        state.sensorZoneMapping[sensorId] = zoneName;
        saveConfig();
        if (state.sensors.length > 0) {
            state.cachedReadings = transformToGAIPFormat(state.sensors);
            saveCache(state.cachedReadings);
        }
    }

    async function testConnection(apiKey) {
        // Uses dedicated test endpoint that accepts raw key — main proxy never receives key from JS.
        var nonce = getNonce();
        if (!nonce) throw new Error('Security nonce not found');

        var formData = new FormData();
        formData.append('action', 'gilba_hydrosight_test_connection');
        formData.append('nonce', nonce);
        formData.append('api_key', apiKey);
        formData.append('endpoint', '/locations');

        try {
            var response = await fetch(CONFIG.proxyUrl, { method: 'POST', body: formData, credentials: 'same-origin' });
            var result = await response.json();
            if (!result.success) throw new Error(result.data && result.data.message ? result.data.message : 'Connection failed');
            // Also fetch sensors
            var formData2 = new FormData();
            formData2.append('action', 'gilba_hydrosight_test_connection');
            formData2.append('nonce', nonce);
            formData2.append('api_key', apiKey);
            formData2.append('endpoint', '/sensors');
            var response2 = await fetch(CONFIG.proxyUrl, { method: 'POST', body: formData2, credentials: 'same-origin' });
            var result2 = await response2.json();
            var sensors = (result2.success && Array.isArray(result2.data)) ? result2.data : [];
            state.connectionTested = true;
            return { success: true, locations: (result.data || []).length, sensors: sensors.length, sensorList: sensors };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // ============================================
    // SETTINGS UI
    // ============================================
    
    function renderSettingsPanel() {
        return '<div class="gaip-hydrosight-settings" style="padding:15px;background:var(--gaip-surface-muted);border-radius:8px;margin:10px 0;">' +
            '<h4 style="margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:1.2em;">🛰️</span> Hydrosight Live Sensors</h4>' +
            '<div style="margin-bottom:12px;">' +
                '<label style="display:block;margin-bottom:4px;font-weight:500;">API Key</label>' +
                '<input type="password" id="gaip-hydrosight-apikey" placeholder="Enter your Hydrosight API key" ' +
                       'value="' + (state.apiKey || '') + '" style="width:100%;padding:8px;border:1px solid var(--gaip-border);border-radius:4px;"/></div>' +
            '<div style="margin-bottom:12px;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
                '<input type="checkbox" id="gaip-hydrosight-enabled" ' + (state.enabled ? 'checked' : '') + '/>' +
                '<span>Enable live sensor data</span></label></div>' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
                '<button type="button" onclick="GAIP_Hydrosight.testConnectionUI()" ' +
                    'style="padding:8px 16px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;">Test Connection</button>' +
                '<button type="button" onclick="GAIP_Hydrosight.saveSettingsUI()" ' +
                    'style="padding:8px 16px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;">Save Settings</button></div>' +
            '<div id="gaip-hydrosight-status"></div>' +
            '<div id="gaip-hydrosight-sensor-mapping" style="display:none;margin-top:15px;padding-top:15px;border-top:1px solid var(--gaip-border);">' +
                '<h5 style="margin:0 0 10px 0;">Sensor → Zone Mapping</h5>' +
                '<p style="font-size:0.85em;color:var(--gaip-text-secondary);margin-bottom:10px;">Optional: Rename sensors to match your course zones</p>' +
                '<div id="gaip-hydrosight-sensors"></div></div></div>';
    }

    async function testConnectionUI() {
        var statusDiv = document.getElementById('gaip-hydrosight-status');
        var apiKeyInput = document.getElementById('gaip-hydrosight-apikey');
        
        if (!apiKeyInput || !statusDiv) return;
        
        var testKey = apiKeyInput.value.trim();
        if (!testKey) {
            statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Please enter an API key</span>';
            return;
        }
        
        statusDiv.innerHTML = '<span style="color:var(--gaip-text-secondary);">⏳ Testing connection...</span>';
        
        try {
            var result = await testConnection(testKey);
            
            if (result.success) {
                statusDiv.innerHTML = '<span style="color:#28a745;">✅ Connected! Found ' + 
                    result.locations + ' location(s) and ' + result.sensors + ' sensor(s)</span>';
                renderSensorMappingUI(result.sensorList);
            } else {
                statusDiv.innerHTML = '<span style="color:#dc3545;">❌ ' + result.error + '</span>';
            }
        } catch (e) {
            statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Connection failed: ' + e.message + '</span>';
        }
    }

    function renderSensorMappingUI(sensors) {
        var container = document.getElementById('gaip-hydrosight-sensor-mapping');
        var sensorsDiv = document.getElementById('gaip-hydrosight-sensors');
        
        if (!container || !sensorsDiv) return;
        container.style.display = 'block';
        
        if (sensors.length === 0) {
            sensorsDiv.innerHTML = '<p style="color:var(--gaip-text-secondary);">No sensors found</p>';
            return;
        }
        
        var html = '<table style="width:100%;border-collapse:collapse;font-size:0.9em;">' +
            '<thead><tr style="background:#e9ecef;"><th style="padding:8px;text-align:left;">Sensor</th>' +
            '<th style="padding:8px;text-align:left;">Zone Name</th><th style="padding:8px;text-align:right;">Last Reading</th></tr></thead><tbody>';
        
        sensors.forEach(function(sensor) {
            var zoneName = state.sensorZoneMapping[sensor.sensorId] || sensor.name || '';
            var lastReading = sensor.lastReadings ? 
                (parseFloat(sensor.lastReadings.moisture).toFixed(1) + '% VWC, ' + 
                 parseFloat(sensor.lastReadings.temperature).toFixed(1) + '°C') : 
                '<span style="color:var(--gaip-text-secondary);">No data</span>';
            
            html += '<tr style="border-bottom:1px solid var(--gaip-border);"><td style="padding:8px;">' + 
                (sensor.name || sensor.sensorId.substring(0, 8)) + '</td>' +
                '<td style="padding:8px;"><input type="text" data-sensor-id="' + sensor.sensorId + '" ' +
                    'class="gaip-hydrosight-zone-input" placeholder="e.g. Green 1, Fairway 5" value="' + zoneName + '" ' +
                    'style="width:100%;padding:4px 8px;border:1px solid var(--gaip-border);border-radius:4px;"/></td>' +
                '<td style="padding:8px;text-align:right;">' + lastReading + '</td></tr>';
        });
        
        html += '</tbody></table>';
        sensorsDiv.innerHTML = html;
    }

    function saveSettingsUI() {
        var apiKeyInput = document.getElementById('gaip-hydrosight-apikey');
        var enabledInput = document.getElementById('gaip-hydrosight-enabled');
        var statusDiv = document.getElementById('gaip-hydrosight-status');
        
        if (!apiKeyInput || !enabledInput) return;
        
        var apiKey = apiKeyInput.value.trim();
        var enabled = enabledInput.checked;
        
        var zoneInputs = document.querySelectorAll('.gaip-hydrosight-zone-input');
        zoneInputs.forEach(function(input) {
            var sensorId = input.getAttribute('data-sensor-id');
            var zoneName = input.value.trim();
            if (sensorId && zoneName) state.sensorZoneMapping[sensorId] = zoneName;
        });
        
        configure(apiKey, enabled);
        
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color:#28a745;">✅ Settings saved' + 
                (enabled ? ' - live data enabled' : '') + '</span>';
        }
        
        if (enabled && apiKey) {
            fetchLiveData(true).catch(function(e) { console.error('[Hydrosight] Initial fetch failed:', e); });
        }
        
        document.dispatchEvent(new CustomEvent('gaip:hydrosight:configured', { detail: { enabled: enabled, apiKey: !!apiKey } }));
    }


    // ============================================
    // INITIALIZATION
    // ============================================
    
    var _siteReady = false;  // blocks saveConfig until siteId is properly resolved

    function reloadForSite() {
        // Stop any existing polling
        if (state.pollTimer) {
            clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
        // Reset state
        state.apiKey = null;
        state.keyConfigured = false;
        state.enabled = false;
        state.sensorZoneMapping = {};
        state.cachedReadings = null;
        state.lastFetch = null;
        state.connectionTested = false;

        // Load config for new site and restart if configured
        loadConfig();

        // Validate: if config says enabled but SensorManager has no mapping entry for
        // this site, the config key is stale (migration artefact). Force-disable and
        // delete the key so it self-heals permanently — no more manual localStorage cleanup.
        // NOTE: Use getSiteMappings() (synchronous, localStorage-backed) NOT getSensorsForSite()
        // which cross-references allSensors and returns [] before async discovery completes,
        // causing false-positive unmapped detection on legitimate sites like Sydney Uni.
        if (state.enabled) {
            var activeSiteId = getActiveSiteId();
            if (activeSiteId && activeSiteId !== 'default') {
                var SM = global.GAIP_SensorManager;
                if (SM && typeof SM.getSiteMappings === 'function') {
                    var mappings = SM.getSiteMappings();
                    var siteMapping = mappings[activeSiteId];
                    var hasMappingEntry = siteMapping && Object.keys(siteMapping).some(function(v) {
                        return siteMapping[v] && siteMapping[v].length > 0;
                    });
                    if (!hasMappingEntry) {
                        // b35fix230: Don't wipe apiKey/config on unmapped site detection.
                        // The mapping may not be loaded yet (hard reset clears localStorage
                        // before sensor mappings restore). Only disable polling — apiKey
                        // and stored config survive so the next proper load can map correctly.
                        console.log('[Hydrosight] No sensor mapping for site:', activeSiteId, '— disabling fetch but preserving config');
                        state.enabled = false;
                    }
                }
            }
        }

        if (state.enabled && state.keyConfigured) {
            fetchLiveData(false).then(function() { startPolling(); })
                .catch(function(e) { console.error('[Hydrosight] Initial fetch for site failed:', e); });
        } else {
            // Site has no Hydrosight sensor — clear HYDROSIGHT cached readings only.
            // b35fix108: do NOT call GAIP_Sensor.clear() here — that wipes TDR/CSV import
            // data which is independent of Hydrosight. CSV imports must survive site switches.
            state.cachedReadings = null;
            // Clear SSOT sensor block so dashboard dot disappears for unmapped sites
            if (global.GilbaHub && typeof GilbaHub.set === 'function') {
                GilbaHub.set('inputs.sensor', {
                    available: false, source: null, importDate: null,
                    vwc: null, ec: null, soilTemp: null, zoneCount: 0
                });
            }
            if (global.GAIP_CANONICAL_STATE && global.GAIP_CANONICAL_STATE.sensor) {
                global.GAIP_CANONICAL_STATE.sensor.soilTemp = null;
                global.GAIP_CANONICAL_STATE.sensor.available = false;
            }
        }
        console.log('[Hydrosight] Reloaded for site:', getActiveSiteId(),
                    state.enabled ? '(enabled)' : '(not configured for this site)');
    }

    function init() {
        // Delay migration + load until gaip:site-config-applied so GAIP_SampleManager
        // is ready and getActiveSiteId() returns the real site, not 'default'
        document.addEventListener('gaip:site-config-applied', function onSiteReady() {
            document.removeEventListener('gaip:site-config-applied', onSiteReady);
            _siteReady = true;
            migrateGlobalConfig();
            reloadForSite();
        });

        // Fallback: if site-config-applied never fires (no sites configured),
        // load after a short delay
        setTimeout(function() {
            if (!state.keyConfigured) {
                _siteReady = true;
                migrateGlobalConfig();
                loadConfig();
                if (state.enabled && state.keyConfigured) {
                    fetchLiveData(false).then(function() { startPolling(); })
                        .catch(function(e) { console.error('[Hydrosight] Fallback fetch failed:', e); });
                }
            }
        }, 5000);

        // Reload config when site changes
        document.addEventListener('gaip:site-changed', function() {
            reloadForSite();
        });

        console.log('[Hydrosight] Module initialized — awaiting site-config-applied');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================
    // EXPORTS
    // ============================================
    
    global.GAIP_Hydrosight = {
        configure: configure,
        testConnection: testConnection,
        setZoneMapping: setZoneMapping,
        renderSettingsPanel: renderSettingsPanel,
        testConnectionUI: testConnectionUI,
        saveSettingsUI: saveSettingsUI,
        hasData: hasData,
        getIrrigationData: getIrrigationData,
        getWaterQualityData: getWaterQualityData,
        getSummary: getSummary,
        getZones: getZones,
        getReadings: getReadings,
        getData: function() { return state.cachedReadings; },
        fetch: fetchLiveData,
        fetchLocations: fetchLocations,
        fetchSensors: fetchSensors,
        fetchSensorData: fetchSensorData,
        fetchSensorRawData: fetchSensorRawData,
        startPolling: startPolling,
        stopPolling: stopPolling,
        isEnabled: function() { return state.enabled; },
        isPolling: function() { return state.isPolling; },
        getLastFetch: function() { return state.lastFetch; },
        getState: function() { return state; },
        DEVICE: DEVICE_INFO,
        clearCache: clearCache
    };

    // ============================================
    // SENSOR MANAGER VENDOR INTERFACE
    // ============================================
    
    /**
     * Vendor interface for GAIP_SensorManager
     * Implements the standard vendor contract
     */
    var vendorInterface = {
        id: 'hydrosight',
        name: 'Hydrosight',
        
        hasCredentials: function() {
            return state.keyConfigured;
        },
        
        setCredentials: function(apiKey) {
            state.keyConfigured = !!apiKey;
            if (typeof apiKey === 'string') state.apiKey = apiKey;
            state.enabled = !!apiKey;
            saveConfig();
        },
        
        getCredentials: function() {
            return state.keyConfigured;
        },
        
        testConnection: async function() {
            if (!state.keyConfigured) {
                return { success: false, error: 'No API key configured' };
            }
            try {
                var locations = await fetchLocations();
                var sensors = await fetchSensors();
                return {
                    success: true,
                    sensors: sensors,
                    locations: locations
                };
            } catch (e) {
                return { success: false, error: e.message };
            }
        },
        
        fetchAllSensors: async function() {
            if (!state.keyConfigured) return [];
            try {
                var sensors = await fetchSensors();
                // Fetch full details for each sensor
                var detailed = [];
                for (var i = 0; i < sensors.length; i++) {
                    var s = sensors[i];
                    if (!s.lastReadings) {
                        try {
                            s = await fetchSensor(s.sensorId);
                        } catch (e) {
                            // Use basic info
                        }
                    }
                    detailed.push({
                        sensorId: s.sensorId,
                        name: s.name || 'Sensor ' + s.sensorId.substring(0, 8),
                        locationId: s.locationId,
                        coordinates: s.coordinates,
                        lastReadings: s.lastReadings
                    });
                }
                return detailed;
            } catch (e) {
                console.error('[Hydrosight] fetchAllSensors failed:', e);
                return [];
            }
        },
        
        fetchSensorData: async function(sensorIds) {
            if (!state.keyConfigured || !sensorIds || sensorIds.length === 0) return [];
            
            var readings = [];
            for (var i = 0; i < sensorIds.length; i++) {
                try {
                    var sensor = await fetchSensor(sensorIds[i]);
                    if (sensor && sensor.lastReadings) {
                        readings.push({
                            sensorId: sensor.sensorId,
                            name: sensor.name,
                            reading: sensor.lastReadings
                        });
                    }
                } catch (e) {
                    console.warn('[Hydrosight] Failed to fetch sensor', sensorIds[i], e);
                }
            }
            return readings;
        },
        
        transformReading: function(raw) {
            var reading = raw.reading || raw.lastReadings || raw;
            return {
                sensorId: raw.sensorId,
                name: raw.name,
                vwc: reading.moisture !== undefined ? parseFloat(reading.moisture) : null,
                ec: reading.salinity !== undefined ? parseFloat(reading.salinity) : null,
                soilTemp: reading.temperature !== undefined ? parseFloat(reading.temperature) : null,
                timestamp: reading.dateTime || new Date().toISOString()
            };
        }
    };

    // Register with SensorManager when it's available
    function registerWithManager() {
        if (global.GAIP_SensorManager && global.GAIP_SensorManager.registerVendor) {
            global.GAIP_SensorManager.registerVendor(vendorInterface);
            console.log('[Hydrosight] Registered with SensorManager');
        } else {
            // Manager not loaded yet, wait for it
            document.addEventListener('gaip:sensorManager:ready', function() {
                if (global.GAIP_SensorManager && global.GAIP_SensorManager.registerVendor) {
                    global.GAIP_SensorManager.registerVendor(vendorInterface);
                    console.log('[Hydrosight] Registered with SensorManager (delayed)');
                }
            });
        }
    }

    // Try to register immediately, or wait for manager
    setTimeout(registerWithManager, 50);
    
    console.log('[Hydrosight] Gilba Hub Hydrosight Adapter v1.2.0 loaded (WP-Ajax proxy + Manager interface)');

})(window);
