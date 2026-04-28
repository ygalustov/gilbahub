/**
 * GAIP Soil Temperature Logger
 * v1.0.0
 *
 * Stores daily soil temperature readings per site so the pre-emergent
 * timing engine has a real measured trend rather than synthesised
 * forecast estimates.
 *
 * Storage: localStorage key 'gilba_soil_temp_log'
 * Structure: { siteId: [ { date: 'YYYY-MM-DD', temp: number, source: string }, ... ] }
 *
 * Behaviour:
 *   - Fires on gaip:orchestrator-complete
 *   - Reads soil temp from sensor (priority) or climate engine
 *   - One entry per site per calendar day (overwrites same-day entry)
 *   - Retains last RETENTION_DAYS days per site, prunes older entries
 *   - Exposes window.GAIP_SoilTempLogger.getHistory(siteId, days)
 *     for consumption by buildPreEmergentInputs()
 *
 * Gilba Solutions | March 2026
 */

(function (global) {
    'use strict';

    var VERSION        = '1.0.0';
    var STORAGE_KEY    = 'gilba_soil_temp_log';
    var RETENTION_DAYS = 30;   // keep 30 days per site
    var MIN_TEMP       = -5;   // sanity bounds
    var MAX_TEMP       = 60;

    // =========================================================================
    // STORAGE HELPERS
    // =========================================================================

    function loadStore() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('[SoilTempLogger] localStorage read error:', e);
            return {};
        }
    }

    function saveStore(store) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (e) {
            console.warn('[SoilTempLogger] localStorage write error:', e);
        }
    }

    function todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    function cutoffDate(days) {
        var d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
    }

    // =========================================================================
    // SITE ID HELPER
    // =========================================================================

    function getActiveSiteId() {
        try {
            var SM = global.GAIP_SampleManager;
            if (SM && typeof SM.getActiveSiteId === 'function') {
                return SM.getActiveSiteId() || 'default';
            }
        } catch (e) { /* ignore */ }
        return 'default';
    }

    // =========================================================================
    // SOIL TEMP READING
    // =========================================================================

    function readCurrentSoilTemp() {
        // Priority 1: sensor
        try {
            var sensor = global.GAIP_Sensor;
            if (sensor && typeof sensor.hasData === 'function' && sensor.hasData()) {
                var sd = sensor.getIrrigationData();
                if (sd && sd.soilTemp != null && !isNaN(sd.soilTemp)) {
                    return { temp: sd.soilTemp, source: 'sensor' };
                }
            }
        } catch (e) { /* ignore */ }

        // Priority 2: GAIP_SOIL_TEMP (physics model widget)
        try {
            var gst = global.GAIP_SOIL_TEMP;
            if (gst && gst.summary && gst.summary.depths) {
                var d = gst.summary.depths;
                // Prefer 50mm depth, fall back to 100mm then surface
                var t = (d.d50mm && d.d50mm.mean != null) ? d.d50mm.mean :
                        (d.d100mm && d.d100mm.mean != null) ? d.d100mm.mean :
                        (d.d10mm && d.d10mm.mean != null) ? d.d10mm.mean : null;
                if (t != null) return { temp: t, source: 'physics_model' };
            }
        } catch (e) { /* ignore */ }

        // Priority 3: GAIP_CANONICAL_STATE.soilTemp
        try {
            var cs = global.GAIP_CANONICAL_STATE && global.GAIP_CANONICAL_STATE.soilTemp;
            if (cs && cs.depths && cs.depths.d50mm != null) {
                return { temp: cs.depths.d50mm, source: cs.source || 'canonical' };
            }
            if (cs && cs.estimated != null) {
                return { temp: cs.estimated, source: cs.source || 'canonical' };
            }
        } catch (e) { /* ignore */ }

        // Priority 4: computed climate soilTemp
        try {
            var climate = global.GAIP_STATE && global.GAIP_STATE.computed && global.GAIP_STATE.computed.climate;
            if (climate && climate.soilTemp && climate.soilTemp.estimated != null) {
                return { temp: climate.soilTemp.estimated, source: climate.soilTemp.source || 'climate_engine' };
            }
        } catch (e) { /* ignore */ }

        // Priority 5: climateMetrics global
        try {
            var cm = global.climateMetrics;
            if (cm && cm.soilTemp && cm.soilTemp.estimated != null) {
                return { temp: cm.soilTemp.estimated, source: 'climateMetrics' };
            }
            if (cm && cm.temperature && cm.temperature.soil && cm.temperature.soil.mean != null) {
                return { temp: cm.temperature.soil.mean, source: 'climateMetrics_temp' };
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    // =========================================================================
    // LOG ENTRY
    // =========================================================================

    function logReading() {
        var reading = readCurrentSoilTemp();
        if (!reading) {
            console.log('[SoilTempLogger] No soil temp available to log');
            return;
        }

        var temp = reading.temp;

        // Only persist sensor readings — physics model / estimated sources must not
        // accumulate in the logger because they can bleed across sites and produce
        // false trend directions. The orchestrator's history chain handles non-sensor
        // sites via forecast synthesis instead.
        var sensorSources = ['sensor', 'hydrosight', 'tdr', 'pogo'];
        var isSensorSource = sensorSources.some(function(s) {
            return reading.source && reading.source.toLowerCase().indexOf(s) !== -1;
        });
        if (!isSensorSource) {
            console.log('[SoilTempLogger] Skipping log — non-sensor source:', reading.source);
            return;
        }

        // Sanity check
        if (temp < MIN_TEMP || temp > MAX_TEMP) {
            console.warn('[SoilTempLogger] Temp out of range, skipping:', temp);
            return;
        }

        var siteId = getActiveSiteId();
        var today  = todayISO();
        var store  = loadStore();

        if (!store[siteId]) store[siteId] = [];

        // Remove any existing entry for today (overwrite with latest reading)
        store[siteId] = store[siteId].filter(function (e) { return e.date !== today; });

        // Add today's entry
        store[siteId].push({
            date:   today,
            temp:   Math.round(temp * 10) / 10,
            source: reading.source
        });

        // Prune entries older than RETENTION_DAYS
        var cutoff = cutoffDate(RETENTION_DAYS);
        store[siteId] = store[siteId].filter(function (e) { return e.date >= cutoff; });

        // Keep sorted by date ascending
        store[siteId].sort(function (a, b) { return a.date < b.date ? -1 : 1; });

        saveStore(store);

        console.log('[SoilTempLogger] Logged ' + temp + '°C (' + reading.source + ') for site ' + siteId +
                    ' on ' + today + ' — ' + store[siteId].length + ' days stored');
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Get soil temperature history for a site.
     *
     * @param {string} siteId   — site ID (default: active site)
     * @param {number} days     — how many recent days to return (default: 14)
     * @returns {number[]}      — array of daily soil temps, oldest first
     *                           Returns empty array if insufficient data.
     */
    function getHistory(siteId, days) {
        siteId = siteId || getActiveSiteId();
        days   = days   || 14;

        var store = loadStore();
        var entries = store[siteId] || [];

        // Take the last N days
        var recent = entries.slice(-days);
        return recent.map(function (e) { return e.temp; });
    }

    /**
     * Get full entry objects (date + temp + source) for a site.
     * Useful for debugging and the future dashboard display.
     */
    function getEntries(siteId, days) {
        siteId = siteId || getActiveSiteId();
        days   = days   || 14;
        var store = loadStore();
        return (store[siteId] || []).slice(-days);
    }

    /**
     * Clear history for a site (or all sites if no siteId).
     */
    function clearHistory(siteId) {
        var store = loadStore();
        if (siteId) {
            delete store[siteId];
        } else {
            Object.keys(store).forEach(function (k) { delete store[k]; });
        }
        saveStore(store);
        console.log('[SoilTempLogger] Cleared history for', siteId || 'all sites');
    }

    /**
     * How many days of history are stored for the active site.
     */
    function daysStored(siteId) {
        siteId = siteId || getActiveSiteId();
        var store = loadStore();
        return (store[siteId] || []).length;
    }

    // =========================================================================
    // MIGRATION — strip pre-guard contamination
    // =========================================================================

    /**
     * One-time cleanup: remove any stored entries whose source is not a real
     * sensor source (physics_model, estimated, canonical, climate_engine etc.)
     * that leaked in before the sensor-only guard was added.
     * Runs once on init; skips if already clean (migration flag set).
     */
    var MIGRATION_KEY = 'gilba_soil_temp_log_migrated_v1';

    function runMigration() {
        try {
            if (localStorage.getItem(MIGRATION_KEY)) return; // already done
            var SENSOR_SOURCES = ['sensor', 'hydrosight', 'tdr', 'pogo'];
            var store = loadStore();
            var changed = false;
            Object.keys(store).forEach(function(siteId) {
                var before = store[siteId].length;
                store[siteId] = store[siteId].filter(function(entry) {
                    if (!entry.source) return false;
                    return SENSOR_SOURCES.some(function(s) {
                        return entry.source.toLowerCase().indexOf(s) !== -1;
                    });
                });
                if (store[siteId].length !== before) {
                    console.log('[SoilTempLogger] Migration: removed', before - store[siteId].length,
                                'non-sensor entries for site', siteId);
                    changed = true;
                }
            });
            if (changed) saveStore(store);
            localStorage.setItem(MIGRATION_KEY, '1');
        } catch (e) {
            console.warn('[SoilTempLogger] Migration error:', e);
        }
    }

    // =========================================================================
    // INIT — listen for orchestrator-complete
    // =========================================================================

    function init() {
        runMigration();
        document.addEventListener('gaip:orchestrator-complete', function () {
            logReading();
        });
        console.log('[SoilTempLogger] v' + VERSION + ' ready — ' +
                    daysStored() + ' days stored for active site');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    global.GAIP_SoilTempLogger = {
        VERSION:      VERSION,
        getHistory:   getHistory,
        getEntries:   getEntries,
        clearHistory: clearHistory,
        daysStored:   daysStored,
        logReading:   logReading   // expose for manual trigger / testing
    };

})(window);
