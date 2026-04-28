/**
 * Gilba Hub - Live Sensor API Bridge
 * Version 1.0.0
 * 
 * Bridges live sensor APIs (Hydrosight, future: Soil Scout, SpecConnect) 
 * with the existing GAIP_Sensor interface.
 * 
 * Priority order:
 * 1. Live API data (if enabled and fresh)
 * 2. CSV import data (existing GAIP_Sensor)
 * 3. Manual input / estimated
 */

(function(global) {
    'use strict';

    var CONFIG = {
        maxApiDataAge: 60 * 60 * 1000 // 1 hour - how stale before falling back
    };

    function hydrosightHasData() {
        if (!global.GAIP_Hydrosight) return false;

        // Mapping check runs FIRST — before isEnabled/hasData — to prevent stale data
        // from a previously active mapped site bleeding into an unmapped site during
        // the reloadForSite() race window where state.enabled briefly flickers true.
        var SM = global.GAIP_SensorManager;
        if (SM && typeof SM.getSiteMappings === 'function') {
            // b35fix272: GAIP_SiteContext is the single source of truth
            var activeSiteId = global.GAIP_SiteContext
                ? global.GAIP_SiteContext.getSiteId()
                : (global.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSiteId === 'function' ? GAIP_SampleManager.getActiveSiteId() : null);
            if (activeSiteId) {
                var mappings = SM.getSiteMappings();
                var siteMap = mappings[activeSiteId];
                var mappedIds = (siteMap && siteMap.hydrosight) ? siteMap.hydrosight : [];
                if (mappedIds.length === 0) return false;
            }
        }

        if (!GAIP_Hydrosight.isEnabled()) return false;
        if (!GAIP_Hydrosight.hasData()) return false;

        var lastFetch = GAIP_Hydrosight.getLastFetch();
        if (lastFetch && (Date.now() - lastFetch.getTime() > CONFIG.maxApiDataAge)) {
            console.log('[SensorBridge] Hydrosight data is stale, triggering refresh');
            GAIP_Hydrosight.fetch(true).catch(function(e) {
                console.warn('[SensorBridge] Background refresh failed:', e);
            });
        }
        
        return true;
    }

    // b35fix190: store original GAIP_Sensor.hasData before the bridge patches it,
    // so csvHasData() can correctly test for CSV-only data independent of Hydrosight.
    var _originalSensorHasData = null;

    function csvHasData() {
        if (!global.GAIP_Sensor) return false;
        // Use the pre-patch original if available; otherwise fall back to current
        // (which may return true for Hydrosight — the lesser evil on first load)
        var fn = _originalSensorHasData || GAIP_Sensor.hasData;
        return fn.call(GAIP_Sensor);
    }

    function getIrrigationData() {
        if (hydrosightHasData()) {
            var data = GAIP_Hydrosight.getIrrigationData();
            if (data) {
                console.log('[SensorBridge] Using Hydrosight live data');
                return data;
            }
        }
        
        if (csvHasData()) {
            var csvData = GAIP_Sensor.getIrrigationData();
            if (csvData) {
                console.log('[SensorBridge] Using CSV import data');
                return csvData;
            }
        }
        
        return null;
    }

    function getWaterQualityData() {
        if (hydrosightHasData()) {
            var data = GAIP_Hydrosight.getWaterQualityData();
            if (data) return data;
        }
        
        if (csvHasData()) {
            return GAIP_Sensor.getWaterQualityData();
        }
        
        return null;
    }

    function getSummary() {
        var sources = [];
        
        if (hydrosightHasData()) {
            sources.push({ source: 'Hydrosight', isLive: true, data: GAIP_Hydrosight.getSummary() });
        }
        
        if (csvHasData()) {
            sources.push({ source: 'CSV Import', isLive: false, data: GAIP_Sensor.getSummary() });
        }
        
        return sources;
    }

    function getZones() {
        var zones = {};
        
        if (csvHasData()) {
            var csvZones = GAIP_Sensor.getZones();
            for (var key in csvZones) {
                zones[key] = csvZones[key];
                zones[key]._source = 'csv';
            }
        }
        
        if (hydrosightHasData()) {
            var apiZones = GAIP_Hydrosight.getZones();
            for (var key in apiZones) {
                zones[key] = apiZones[key];
                zones[key]._source = 'hydrosight';
                zones[key]._isLive = true;
            }
        }
        
        return zones;
    }

    function hasData() {
        return hydrosightHasData() || csvHasData();
    }

    function getSourceInfo() {
        var sources = [];
        
        if (global.GAIP_Hydrosight) {
            var lastFetch = hydrosightHasData() ? GAIP_Hydrosight.getLastFetch() : null;
            sources.push({
                name: 'Hydrosight',
                type: 'live_api',
                enabled: GAIP_Hydrosight.isEnabled(),
                hasData: hydrosightHasData(),
                lastFetch: lastFetch ? lastFetch.toISOString() : null,
                isPolling: GAIP_Hydrosight.isPolling()
            });
        }
        
        if (csvHasData()) {
            var sensorInfo = GAIP_Sensor.getSensorInfo ? GAIP_Sensor.getSensorInfo() : {};
            sources.push({
                name: sensorInfo.deviceType || 'CSV Import',
                type: 'csv_import',
                enabled: true,
                hasData: true,
                deviceConfig: sensorInfo.deviceConfig
            });
        }
        
        return {
            primarySource: sources.find(function(s) { return s.hasData; }) || null,
            sources: sources,
            hasLiveData: hydrosightHasData(),
            hasCSVData: csvHasData()
        };
    }

    function renderStatusBadge() {
        var info = getSourceInfo();

        if (info.hasLiveData) {
            var lastFetch = GAIP_Hydrosight.getLastFetch();
            var ageMinutes = lastFetch ? Math.round((Date.now() - lastFetch.getTime()) / 60000) : 0;
            var freshness = ageMinutes < 5 ? 'live' : (ageMinutes < 30 ? 'recent' : 'stale');

            return '<span class="gaip-sensor-badge gaip-sensor-badge-' + freshness + '" ' +
                   'title="Last update: ' + ageMinutes + ' minutes ago">' +
                   '🛰️ Live (' + ageMinutes + 'm ago)</span>';
        }

        // Connected to Hydrosight but no sensor mapped to this site
        if (global.GAIP_Hydrosight && GAIP_Hydrosight.isEnabled()) {
            return '<span class="gaip-sensor-badge gaip-sensor-badge-unmapped" ' +
                   'title="Hydrosight connected but no sensor mapped to this site">' +
                   '⚠️ No sensor mapped</span>';
        }

        if (info.hasCSVData) {
            return '<span class="gaip-sensor-badge gaip-sensor-badge-csv">' +
                   '📊 CSV Import</span>';
        }

        return '<span class="gaip-sensor-badge gaip-sensor-badge-none">' +
               '⚠️ No sensor data</span>';
    }

    function renderCombinedSettingsPanel() {
        var html = '<div class="gaip-sensor-api-settings">' +
            '<h3 style="margin:0 0 15px 0;">📡 Live Sensor Integration</h3>' +
            '<p style="color:var(--gaip-text-secondary);margin-bottom:20px;">Connect wireless soil sensors for real-time data.</p>';
        
        if (global.GAIP_Hydrosight) {
            html += GAIP_Hydrosight.renderSettingsPanel();
        }
        
        html += '<div style="margin-top:20px;padding-top:15px;border-top:1px solid var(--gaip-border);">' +
            '<h4 style="margin:0 0 10px 0;">Current Status</h4>' +
            '<div id="gaip-sensor-bridge-status">' + renderStatusBadge() + '</div></div></div>';
        
        return html;
    }

    document.addEventListener('gaip:hydrosight:updated', function(e) {
        var statusDiv = document.getElementById('gaip-sensor-bridge-status');
        if (statusDiv) statusDiv.innerHTML = renderStatusBadge();

        document.dispatchEvent(new CustomEvent('gaip:sensor:updated', {
            detail: { source: 'hydrosight', data: e.detail }
        }));
    });

    // Refresh badge on site switch — mapped vs unmapped state changes per site
    document.addEventListener('gaip:site-changed', function() {
        setTimeout(function() {
            var statusDiv = document.getElementById('gaip-sensor-bridge-status');
            if (statusDiv) statusDiv.innerHTML = renderStatusBadge();
        }, 400); // brief delay to let mappings load for new site
    });

    global.GAIP_SensorBridge = {
        hasData: hasData,
        getIrrigationData: getIrrigationData,
        getWaterQualityData: getWaterQualityData,
        getSummary: getSummary,
        getZones: getZones,
        getSourceInfo: getSourceInfo,
        renderStatusBadge: renderStatusBadge,
        renderCombinedSettingsPanel: renderCombinedSettingsPanel,
        hydrosight: function() { return global.GAIP_Hydrosight; },
        csv: function() { return global.GAIP_Sensor; }
    };

    // ============================================
    // MONKEY-PATCH GAIP_Sensor for seamless integration
    // ============================================
    
    function patchGAIPSensor() {
        if (!global.GAIP_Sensor) {
            // GAIP_Sensor not loaded yet, try again shortly
            setTimeout(patchGAIPSensor, 100);
            return;
        }
        
        // Store original methods
        var originalHasData = GAIP_Sensor.hasData;
        _originalSensorHasData = originalHasData; // b35fix190: expose to csvHasData()
        var originalGetIrrigationData = GAIP_Sensor.getIrrigationData;
        var originalGetWaterQualityData = GAIP_Sensor.getWaterQualityData;
        
        // Override hasData to check live sources first
        GAIP_Sensor.hasData = function() {
            if (hydrosightHasData()) return true;
            return originalHasData.call(GAIP_Sensor);
        };
        
        // Override getIrrigationData to prioritize live data
        GAIP_Sensor.getIrrigationData = function() {
            if (hydrosightHasData()) {
                var liveData = GAIP_Hydrosight.getIrrigationData();
                if (liveData) {
                    console.log('[SensorBridge] GAIP_Sensor.getIrrigationData() returning Hydrosight live data');
                    return liveData;
                }
            }
            return originalGetIrrigationData.call(GAIP_Sensor);
        };
        
        // Override getWaterQualityData to prioritize live data
        GAIP_Sensor.getWaterQualityData = function() {
            if (hydrosightHasData()) {
                var liveData = GAIP_Hydrosight.getWaterQualityData();
                if (liveData) {
                    console.log('[SensorBridge] GAIP_Sensor.getWaterQualityData() returning Hydrosight live data');
                    return liveData;
                }
            }
            return originalGetWaterQualityData.call(GAIP_Sensor);
        };
        
        console.log('[SensorBridge] GAIP_Sensor patched for live data priority');
    }
    
    // Run patch after a short delay to ensure GAIP_Sensor is loaded
    setTimeout(patchGAIPSensor, 50);

    console.log('[SensorBridge] Gilba Hub Sensor Bridge v1.0.0 loaded');

})(window);
