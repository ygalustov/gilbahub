/**
 * =============================================================================
 * GILBA HUB PERSISTENCE v1.1.2
 * =============================================================================
 * 
 * localStorage persistence layer for comprehensive hub state management.
 * Automatically saves and restores:
 * - Input data (soil, water, tissue, sensor imports)
 * - Sample collections from Sample Manager
 * - User preferences and card collapse states
 * - Last analysis results for quick restore on page load
 * 
 * CHANGELOG:
 * v1.1.2 - Fixed date inputs being parsed as numbers (2026-01-20 → 2026)
 *        - getInputValue() now preserves date/datetime-local values as strings
 * v1.1.1 - Fixed PGR date selector (.gaip-pgr-date not .gaip-pgr-last-app)
 * v1.1.0 - Fixed PGR field names to match GAIP_STATE (productType, applicationDate, rateLperHa)
 *        - Added backwards compatibility for old field names
 * 
 * STORAGE STRUCTURE:
 * - gilba_hub_state: Complete input state
 * - gilba_hub_samples: Sample Manager collections
 * - gilba_hub_prefs: User preferences (card states, toggles)
 * - gilba_hub_cache: Last analysis results (for quick dashboard)
 * 
 * USAGE:
 * - GilbaPersistence.save() - Save current state (auto-called on changes)
 * - GilbaPersistence.restore() - Restore saved state (auto-called on init)
 * - GilbaPersistence.clear() - Clear all saved data
 * - GilbaPersistence.export() - Export state as JSON
 * - GilbaPersistence.import(json) - Import state from JSON
 * 
 * @author Gilba Solutions
 * @version 1.1.2
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // RE-RUN IFRAME SIGNALLING
    // We only want to signal the parent dashboard after the SECOND orchestrator
    // pass — the one that runs after gaip:weather-ready with full weather data.
    // Sequence we wait for:
    //   1. gaip:weather-ready  → _weatherReady = true
    //   2. gaip:orchestrator-complete (second pass) → _readyToSignal = true
    //   3. syncToServer().then() → postMessage fires
    // =========================================================================
    var _rerunIframe     = (window.parent !== window);
    var _weatherReady    = false;
    var _readyToSignal   = false;
    var _rerunSignalSent = false;

    function _signalRerunComplete() {
        if (!_rerunIframe || _rerunSignalSent) return;
        _rerunSignalSent = true;
        try { window.parent.postMessage('gilba:analysis-complete', window.location.origin); } catch (e) {}
    }

    if (_rerunIframe) {
        /* Shared: do a dedicated DB write then signal the parent. */
        function _doRerunSync(source) {
            if (_rerunSignalSent) return;
            var snap    = cacheAnalysisResults();
            var siteId  = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId)
                          || (snap && snap.siteId);
            console.log('[GilbaRerun] _doRerunSync called from:', source || 'unknown',
                '| siteId:', siteId,
                '| GP(growth.weighted):', window.climateMetrics && window.climateMetrics.growth && window.climateMetrics.growth.weighted,
                '| diseaseRisk:', window.GAIP_DISEASE_RESULT && window.GAIP_DISEASE_RESULT.overallScore,
                '| snap.dashboard:', snap && snap.dashboard);
            if (!siteId) { _signalRerunComplete(); return; }
            var csrf    = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.csrfToken)
                          || ((document.querySelector('meta[name="csrf-token"]') || {}).content);
            var restUrl = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.restUrl) || '/api/';
            fetch(restUrl + 'analysis-cache', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf || '', 'Accept': 'application/json' },
                body: JSON.stringify({
                    site_id:     siteId,
                    analyzed_at: (snap.dashboard && snap.dashboard.timestamp) || snap.cachedAt || new Date().toISOString(),
                    metrics:     snap.dashboard,
                    computed:    snap.computed || null,
                }),
            }).then(function (r) {
                console.log('[GilbaRerun] POST /api/analysis-cache success, signalling parent');
                _signalRerunComplete();
            }).catch(function (e) {
                console.warn('[GilbaRerun] POST /api/analysis-cache FAILED:', e, '— signalling anyway');
                _signalRerunComplete();
            });
        }

        document.addEventListener('gaip:weather-ready', function () {
            console.log('[GilbaRerun] gaip:weather-ready received, setting _weatherReady=true');
            _weatherReady = true;
        });

        /* FAST PATH — standard case: weather loads from API after hub starts.
           gaip:weather-ready fires → _weatherReady = true → next orchestrator-complete
           triggers a 3s delayed sync (gives async calcs time to finish). */
        document.addEventListener('gaip:orchestrator-complete', function () {
            console.log('[GilbaRerun] gaip:orchestrator-complete | _weatherReady:', _weatherReady, '| _readyToSignal:', _readyToSignal);
            if (_weatherReady && !_readyToSignal) {
                _readyToSignal = true;
                setTimeout(function() { _doRerunSync('fast-path-3s'); }, 3000);
            }
        });

        /* SLOW PATH — catches the case where gaip:weather-ready fired from a
           localStorage cache *before* hub-persistence.js registered its listener
           (weather-resilience.js runs earlier in the script list).  By 10 s the
           single weather-inclusive analysis pass and all async calculations are
           guaranteed to have finished. */
        setTimeout(function () {
            console.log('[GilbaRerun] 10s slow path | _readyToSignal:', _readyToSignal, '| _weatherReady:', _weatherReady);
            if (!_readyToSignal) {
                _readyToSignal = true;
                _doRerunSync('slow-path-10s');
            }
        }, 10000);

        /* Absolute fallback: if nothing saved to DB, just signal at 20 s */
        setTimeout(function () {
            console.log('[GilbaRerun] 20s absolute fallback firing, _rerunSignalSent:', _rerunSignalSent);
            _signalRerunComplete();
        }, 20000);
    }

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        version: '1.1.2',
        debug: false,
        
        // Storage keys — scoped to userId to prevent cross-user data leaks on shared devices
        keys: (function() {
            var uid = (window.GAIP_HUB_CONFIG && GAIP_HUB_CONFIG.userId) || 0;
            var suffix = uid ? '_' + uid : '';
            return {
                state: 'gilba_hub_state' + suffix,
                samples: 'gilba_hub_samples' + suffix,
                prefs: 'gilba_hub_prefs' + suffix,
                cache: 'gilba_hub_cache' + suffix
            };
        })(),
        
        // Debounce delay for auto-save (ms)
        saveDebounce: 1000,
        
        // Max age for cached analysis results (hours)
        cacheMaxAge: 24,
        
        // Version for migration handling
        schemaVersion: 1
    };

    // =========================================================================
    // STATE
    // =========================================================================

    let _saveTimer = null;
    let _initialized = false;
    let _lastSaveTime = 0;

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(category, message, data) {
        if (!CONFIG.debug) return;
        const prefix = `[Persistence:${category}]`;
        if (data !== undefined) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    }

    function warn(category, message, data) {
        const prefix = `[Persistence:${category}]`;
        if (data !== undefined) {
            console.warn(prefix, message, data);
        } else {
            console.warn(prefix, message);
        }
    }

    // =========================================================================
    // STORAGE UTILITIES
    // =========================================================================

    /**
     * Check if localStorage is available
     */
    function storageAvailable() {
        try {
            const test = '__gilba_storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Safe JSON parse with fallback
     */
    function safeJsonParse(str, fallback = null) {
        if (!str) return fallback;
        try {
            return JSON.parse(str);
        } catch (e) {
            warn('parse', 'Failed to parse JSON', e);
            return fallback;
        }
    }

    /**
     * Safe localStorage get
     */
    function storageGet(key) {
        if (!storageAvailable()) return null;
        try {
            return localStorage.getItem(key);
        } catch (e) {
            warn('storage', 'Failed to get ' + key, e);
            return null;
        }
    }

    /**
     * Safe localStorage set
     */
    function storageSet(key, value) {
        if (!storageAvailable()) return false;
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            // Check if quota exceeded
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                warn('storage', 'Storage quota exceeded for ' + key);
                // Try to free up space by clearing old cache
                clearOldCache();
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch (e2) {
                    warn('storage', 'Still cannot save after cleanup', e2);
                }
            }
            return false;
        }
    }

    /**
     * Clear old cached data to free space
     */
    function clearOldCache() {
        try {
            // Remove analysis cache (least critical)
            localStorage.removeItem(CONFIG.keys.cache);
            log('storage', 'Cleared cache to free space');
        } catch (e) {
            // Ignore
        }
    }

    // =========================================================================
    // INPUT STATE COLLECTION
    // =========================================================================

    /**
     * Collect all current input values from the DOM
     */
    function collectInputState() {
        const state = {
            schemaVersion: CONFIG.schemaVersion,
            savedAt: new Date().toISOString(),
            
            // Location
            location: collectLocation(),
            
            // Turf profile (delegate to TurfProfile if available)
            turf: collectTurfProfile(),
            
            // Soil data
            soil: collectSoilData(),
            
            // Water data
            water: collectWaterData(),
            
            // Tissue data
            tissue: collectTissueData(),
            
            // Climate settings
            climate: collectClimateSettings(),
            
            // Traffic/schedule
            traffic: collectTrafficSettings(),
            
            // Shade settings
            shade: collectShadeSettings(),
            
            // PGR settings
            pgr: collectPgrSettings(),
            
            // Irrigation settings
            irrigation: collectIrrigationSettings()
        };
        
        return state;
    }

    function collectLocation() {
        const latEl = document.querySelector('.gaip-lat');
        const lonEl = document.querySelector('.gaip-lon');
        const nameEl = document.querySelector('.gaip-location-name');
        
        return {
            lat: latEl ? parseFloat(latEl.value) || null : null,
            lon: lonEl ? parseFloat(lonEl.value) || null : null,
            name: nameEl ? nameEl.value || '' : ''
        };
    }

    function collectTurfProfile() {
        // Use TurfProfile state if available
        if (global.GaipTurfProfile && global.GaipTurfProfile.state) {
            return { ...global.GaipTurfProfile.state };
        }
        
        // Fallback to DOM collection
        return {
            turfType: getSelectedTurfType(),
            subCategory: getSelectedSubCategory(),
            species: getSelectValue('.gaip-species'),
            variety: getSelectValue('.gaip-variety'),
            construction: getSelectValue('.gaip-construction'),
            drainage: getSelectValue('.gaip-drainage'),
            hoc: getInputValue('.gaip-hoc'),
            nProgram: getInputValue('.gaip-n-program'),
            overseedSpecies: getSelectValue('.gaip-cool-overseed'),
            overseedVariety: getSelectValue('.gaip-overseed-variety'),
            overseedIntent: getSelectValue('.gaip-overseed-summer-intent'),
            poaPercent: getInputValue('.gaip-poa-percent')
        };
    }

    function getSelectedTurfType() {
        const selected = document.querySelector('.gaip-turf-type-option.selected');
        return selected ? selected.dataset.type : null;
    }

    function getSelectedSubCategory() {
        const selected = document.querySelector('.gaip-subcategory-option.selected');
        return selected ? (selected.dataset.surface || selected.dataset.sport) : null;
    }

    function collectSoilData() {
        const data = {
            ph: getInputValue('.gaip-soil-ph'),
            ec: getInputValue('.gaip-soil-ec'),
            cec: getInputValue('.gaip-cec'),
            texture: getSelectValue('.gaip-soil-texture'),
            methodology: getSelectValue('.gaip-soil-methodology'),
            
            // Sample identification
            sampleLabel: getInputValue('.gaip-soil-sample-label'),
            labRef: getInputValue('.gaip-soil-lab-ref'),
            testDate: getInputValue('.gaip-soil-date'),
            
            // LOI (single or stratified)
            loi: getInputValue('.gaip-loi'),
            loi_0_2: getInputValue('.gaip-loi-0-2'),
            loi_2_4: getInputValue('.gaip-loi-2-4'),
            loi_4_6: getInputValue('.gaip-loi-4-6'),
            
            // Nutrients
            nutrients: {}
        };
        
        // Collect MLSN nutrient values
        document.querySelectorAll('[data-mlsn]').forEach(el => {
            const nutrient = el.dataset.mlsn;
            const value = parseFloat(el.value);
            if (nutrient && !isNaN(value)) {
                data.nutrients[nutrient] = value;
            }
        });
        
        return data;
    }

    function collectWaterData() {
        const data = {
            ph: getInputValue('.gaip-water-ph'),
            ec: getInputValue('.gaip-ecw'),
            source: getSelectValue('.gaip-water-source'),
            recycledWater: !!(document.querySelector('.gaip-recycled-water-flag')?.checked),
            
            // Sample identification
            sourceLabel: getInputValue('.gaip-water-source-label'),
            labRef: getInputValue('.gaip-water-lab-ref'),
            testDate: getInputValue('.gaip-water-date'),
            
            // Ions
            ions: {}
        };
        
        // Collect ion values
        document.querySelectorAll('[data-ion]').forEach(el => {
            const ion = el.dataset.ion;
            const value = parseFloat(el.value);
            if (ion && !isNaN(value)) {
                data.ions[ion] = value;
            }
        });
        
        return data;
    }

    function collectTissueData() {
        const data = {
            elements: {}
        };
        
        // Collect tissue values (multiple possible selectors)
        document.querySelectorAll('[data-tissue], [data-val]').forEach(el => {
            const element = el.dataset.tissue || el.dataset.val;
            const value = parseFloat(el.value);
            if (element && !isNaN(value)) {
                data.elements[element] = value;
            }
        });
        
        return data;
    }

    function collectClimateSettings() {
        return {
            // useLiveWeather is intentionally NOT persisted here.
            // The HTML checkbox defaults to checked=true, so live weather is always on
            // at page load. Persisting this value created a stuck-false loop where an
            // old save (from a session where restore had unchecked it) would be re-read
            // and re-saved before the user had a chance to interact.
            // If users want live weather off, they toggle it each session.
            manualTemp: getInputValue('.gaip-manual-temp'),
            manualPrecip: getInputValue('.gaip-manual-precip'),
            manualHumidity: getInputValue('.gaip-manual-humidity'),
            forecastDays: getInputValue('.gaip-forecast-days') || 7
        };
    }

    function collectTrafficSettings() {
        return {
            enabled: isChecked('.gaip-enable-turf-traffic'),
            eventsPerWeek: getInputValue('.gaip-events-per-week'),
            eventDuration: getInputValue('.gaip-event-duration'),
            recoveryDays: getInputValue('.gaip-recovery-days'),
            trafficIntensity: getSelectValue('.gaip-traffic-intensity')
        };
    }

    function collectShadeSettings() {
        return {
            enabled: isChecked('.gaip-enable-shade'),
            percentShade: getInputValue('.gaip-shade-percent'),
            shadeHours: getInputValue('.gaip-shade-hours'),
            ledSupplemental: isChecked('.gaip-led-supplemental'),
            ledHours: getInputValue('.gaip-led-hours')
        };
    }

    function collectPgrSettings() {
        var enabled = isChecked('.gaip-enable-pgr');
        return {
            enabled: enabled,
            productType: getSelectValue('.gaip-pgr-product'),
            // Only persist date/rate when PGR is actively enabled — prevents stale
            // dates coming back after the user disables or clears PGR.
            applicationDate: enabled ? getInputValue('.gaip-pgr-date') : null,
            rateLperHa: enabled ? getInputValue('.gaip-pgr-rate') : null
        };
    }

    function collectIrrigationSettings() {
        return {
            enabled: isChecked('.gaip-enable-irrigation'),
            cycleTime: getInputValue('.gaip-irrigation-cycle'),
            efficiency: getInputValue('.gaip-irrigation-efficiency'),
            allowableDepletion: getInputValue('.gaip-allowable-depletion')
        };
    }

    // =========================================================================
    // DOM HELPERS
    // =========================================================================

    function getSelectValue(selector) {
        const el = document.querySelector(selector);
        return el ? el.value : null;
    }

    function getInputValue(selector) {
        const el = document.querySelector(selector);
        if (!el) return null;
        
        // Preserve date strings as-is (don't parse as numbers)
        if (el.type === 'date' || el.type === 'datetime-local') {
            return el.value || null;
        }
        
        const val = parseFloat(el.value);
        return isNaN(val) ? el.value : val;
    }

    function isChecked(selector) {
        const el = document.querySelector(selector);
        return el ? el.checked : false;
    }

    // =========================================================================
    // INPUT STATE RESTORATION
    // =========================================================================

    /**
     * Restore saved input state to the DOM
     */
    function restoreInputState(state) {
        if (!state || state.schemaVersion !== CONFIG.schemaVersion) {
            log('restore', 'Skipping restore - schema mismatch or no state');
            return false;
        }
        
        log('restore', 'Restoring saved state from', state.savedAt);
        
        // Restore location first (affects variety databases)
        if (state.location) {
            restoreLocation(state.location);
        }
        
        // Restore turf profile (handled by TurfProfile if available)
        if (state.turf) {
            restoreTurfProfile(state.turf);
        }
        
        // Restore soil data
        if (state.soil) {
            restoreSoilData(state.soil);
        }
        
        // Restore water data
        if (state.water) {
            restoreWaterData(state.water);
        }
        
        // Restore tissue data
        if (state.tissue) {
            restoreTissueData(state.tissue);
        }
        
        // Restore climate settings
        if (state.climate) {
            restoreClimateSettings(state.climate);
        }
        
        // Restore traffic settings
        if (state.traffic) {
            restoreTrafficSettings(state.traffic);
        }
        
        // Restore shade settings
        if (state.shade) {
            restoreShadeSettings(state.shade);
        }
        
        // Restore PGR settings
        if (state.pgr) {
            restorePgrSettings(state.pgr);
        }
        
        // Restore irrigation settings
        if (state.irrigation) {
            restoreIrrigationSettings(state.irrigation);
        }
        
        return true;
    }

    function restoreLocation(loc) {
        setInputValue('.gaip-lat', loc.lat);
        setInputValue('.gaip-lon', loc.lon);
        setInputValue('.gaip-location-name', loc.name);
    }

    function restoreTurfProfile(turf) {
        // If TurfProfile controller exists, use it for proper cascade
        if (global.GaipTurfProfile && typeof global.GaipTurfProfile.loadProfile === 'function') {
            // TurfProfile handles its own persistence - skip here
            return;
        }
        
        // Fallback manual restoration
        if (turf.turfType) {
            const typeBtn = document.querySelector(`.gaip-turf-type-option[data-type="${turf.turfType}"]`);
            if (typeBtn) typeBtn.click();
        }
        
        if (turf.subCategory) {
            setTimeout(() => {
                const subBtn = document.querySelector(`.gaip-subcategory-option[data-surface="${turf.subCategory}"], .gaip-subcategory-option[data-sport="${turf.subCategory}"]`);
                if (subBtn) subBtn.click();
            }, 50);
        }
        
        setTimeout(() => {
            setSelectValue('.gaip-species', turf.species);
            setSelectValue('.gaip-variety', turf.variety);
            setSelectValue('.gaip-construction', turf.construction);
            setSelectValue('.gaip-drainage', turf.drainage);
            setInputValue('.gaip-hoc', turf.hoc);
            setInputValue('.gaip-n-program', turf.nProgram);
            setSelectValue('.gaip-cool-overseed', turf.overseedSpecies);
            setSelectValue('.gaip-overseed-variety', turf.overseedVariety);
            setSelectValue('.gaip-overseed-summer-intent', turf.overseedIntent);
            setInputValue('.gaip-poa-percent', turf.poaPercent);
        }, 100);
    }

    function restoreSoilData(soil) {
        setInputValue('.gaip-soil-ph', soil.ph);
        setInputValue('.gaip-soil-ec', soil.ec);
        setInputValue('.gaip-cec', soil.cec);
        setSelectValue('.gaip-soil-texture', soil.texture);
        setSelectValue('.gaip-soil-methodology', soil.methodology);
        
        // Sample identification
        if (soil.sampleLabel) setInputValue('.gaip-soil-sample-label', soil.sampleLabel);
        if (soil.labRef) setInputValue('.gaip-soil-lab-ref', soil.labRef);
        if (soil.testDate) setInputValue('.gaip-soil-date', soil.testDate);
        
        setInputValue('.gaip-loi', soil.loi);
        setInputValue('.gaip-loi-0-2', soil.loi_0_2);
        setInputValue('.gaip-loi-2-4', soil.loi_2_4);
        setInputValue('.gaip-loi-4-6', soil.loi_4_6);
        
        // Restore nutrients
        if (soil.nutrients) {
            Object.entries(soil.nutrients).forEach(([nutrient, value]) => {
                setInputValue(`[data-mlsn="${nutrient}"]`, value);
            });
        }
    }

    function restoreWaterData(water) {
        setInputValue('.gaip-water-ph', water.ph);
        setInputValue('.gaip-ecw', water.ec);
        setSelectValue('.gaip-water-source', water.source);

        // Recycled water toggle
        const rwFlag = document.querySelector('.gaip-recycled-water-flag');
        if (rwFlag && typeof water.recycledWater !== 'undefined') {
            rwFlag.checked = !!water.recycledWater;
        }
        
        // Sample identification
        if (water.sourceLabel) setInputValue('.gaip-water-source-label', water.sourceLabel);
        if (water.labRef) setInputValue('.gaip-water-lab-ref', water.labRef);
        if (water.testDate) setInputValue('.gaip-water-date', water.testDate);
        
        // Restore ions
        if (water.ions) {
            Object.entries(water.ions).forEach(([ion, value]) => {
                setInputValue(`[data-ion="${ion}"]`, value);
            });
        }
    }

    function restoreTissueData(tissue) {
        if (tissue.elements) {
            Object.entries(tissue.elements).forEach(([element, value]) => {
                setInputValue(`[data-tissue="${element}"], [data-val="${element}"]`, value);
            });
        }
    }

    function restoreClimateSettings(climate) {
        // useLiveWeather is no longer persisted — checkbox always starts at HTML default (true).
        // Manual weather panel visibility is controlled by the checkbox change handler in hub-tissue-v3.
        setInputValue('.gaip-manual-temp', climate.manualTemp);
        setInputValue('.gaip-manual-precip', climate.manualPrecip);
        setInputValue('.gaip-manual-humidity', climate.manualHumidity);
        setInputValue('.gaip-forecast-days', climate.forecastDays);
    }

    function restoreTrafficSettings(traffic) {
        setCheckbox('.gaip-enable-turf-traffic', traffic.enabled);
        setInputValue('.gaip-events-per-week', traffic.eventsPerWeek);
        setInputValue('.gaip-event-duration', traffic.eventDuration);
        setInputValue('.gaip-recovery-days', traffic.recoveryDays);
        setSelectValue('.gaip-traffic-intensity', traffic.trafficIntensity);
    }

    function restoreShadeSettings(shade) {
        setCheckbox('.gaip-enable-shade', shade.enabled);
        setInputValue('.gaip-shade-percent', shade.percentShade);
        setInputValue('.gaip-shade-hours', shade.shadeHours);
        setCheckbox('.gaip-led-supplemental', shade.ledSupplemental);
        setInputValue('.gaip-led-hours', shade.ledHours);
    }

    function restorePgrSettings(pgr) {
        setCheckbox('.gaip-enable-pgr', pgr.enabled);
        setSelectValue('.gaip-pgr-product', pgr.productType || pgr.product);
        // Only restore date/rate if PGR was enabled when saved — prevents ghost dates returning
        if (pgr.enabled) {
            setInputValue('.gaip-pgr-date', pgr.applicationDate || pgr.lastAppDate);
            setInputValue('.gaip-pgr-rate', pgr.rateLperHa || pgr.rate);
        } else {
            // Explicitly clear date field in case DOM has a stale value
            var dateEl = document.querySelector('.gaip-pgr-date');
            if (dateEl && dateEl.value) {
                dateEl.value = '';
                dateEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    function restoreIrrigationSettings(irrigation) {
        setCheckbox('.gaip-enable-irrigation', irrigation.enabled);
        setInputValue('.gaip-irrigation-cycle', irrigation.cycleTime);
        setInputValue('.gaip-irrigation-efficiency', irrigation.efficiency);
        setInputValue('.gaip-allowable-depletion', irrigation.allowableDepletion);
    }

    // =========================================================================
    // DOM SETTERS
    // =========================================================================

    function setInputValue(selector, value) {
        if (value === null || value === undefined) return;
        const el = document.querySelector(selector);
        if (el && el.value !== String(value)) {
            el.value = value;
            // Dispatch change event for listeners
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function setSelectValue(selector, value) {
        if (value === null || value === undefined) return;
        const el = document.querySelector(selector);
        if (el) {
            // Check if option exists
            const option = el.querySelector(`option[value="${value}"]`);
            if (option) {
                el.value = value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    function setCheckbox(selector, checked) {
        const el = document.querySelector(selector);
        if (el && el.checked !== checked) {
            el.checked = checked;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /** Like setCheckbox but does NOT fire a change event — for restoring state
     *  where the change handler would cause side effects (e.g. weather panel). */
    function setCheckboxSilent(selector, checked) {
        const el = document.querySelector(selector);
        if (el) {
            el.checked = !!checked;
        }
    }

    // =========================================================================
    // PREFERENCES (Card States, Toggles)
    // =========================================================================

    function collectPreferences() {
        const prefs = {
            schemaVersion: CONFIG.schemaVersion,
            savedAt: new Date().toISOString(),
            
            // Collapsed cards
            collapsedCards: [],
            
            // Module enable states
            enabledModules: {}
        };
        
        // Collect collapsed card states
        document.querySelectorAll('.gaip-card.collapsed').forEach(card => {
            const cardId = card.id || card.dataset.card;
            if (cardId) {
                prefs.collapsedCards.push(cardId);
            }
        });
        
        // Collect module enable checkboxes
        document.querySelectorAll('[class*="gaip-enable-"]').forEach(checkbox => {
            if (checkbox.type === 'checkbox') {
                const match = checkbox.className.match(/gaip-enable-(\w+)/);
                if (match) {
                    prefs.enabledModules[match[1]] = checkbox.checked;
                }
            }
        });
        
        return prefs;
    }

    function restorePreferences(prefs) {
        if (!prefs || prefs.schemaVersion !== CONFIG.schemaVersion) return false;
        
        // Restore collapsed cards
        if (prefs.collapsedCards && prefs.collapsedCards.length > 0) {
            prefs.collapsedCards.forEach(cardId => {
                const card = document.getElementById(cardId) || 
                            document.querySelector(`[data-card="${cardId}"]`);
                if (card && !card.classList.contains('collapsed')) {
                    card.classList.add('collapsed');
                }
            });
        }
        
        // Restore module enables
        if (prefs.enabledModules) {
            Object.entries(prefs.enabledModules).forEach(([module, enabled]) => {
                const checkbox = document.querySelector(`.gaip-enable-${module}`);
                if (checkbox && checkbox.checked !== enabled) {
                    checkbox.checked = enabled;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        
        return true;
    }

    // =========================================================================
    // SAMPLES (From Sample Manager)
    // =========================================================================

    function collectSamples() {
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getAllSamples === 'function') {
            return {
                schemaVersion: CONFIG.schemaVersion,
                savedAt: new Date().toISOString(),
                ...global.GAIP_SampleManager.getAllSamples()
            };
        }
        return null;
    }

    function restoreSamples(samples) {
        if (!samples || samples.schemaVersion !== CONFIG.schemaVersion) return false;
        
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.restoreFromPersistence === 'function') {
            var restored = global.GAIP_SampleManager.restoreFromPersistence(samples);
            log('restore', 'Samples restored: ' + restored);
            return restored;
        }
        return false;
    }

    // =========================================================================
    // ANALYSIS CACHE (For Dashboard)
    // =========================================================================

    function cacheAnalysisResults() {
        // Stamp the active siteId so standalone pages (e.g. morning briefing)
        // can identify which site this cache belongs to without SampleManager.
        // b35fix271: use GAIP_SiteContext for correct site ID on both GAIP and GSSH pages
        const activeSiteId = global.GAIP_SiteContext
            ? (global.GAIP_SiteContext.getSiteId() || 'default')
            : ((global.GAIP_SampleManager && global.GAIP_SampleManager.getActiveSiteId)
                ? global.GAIP_SampleManager.getActiveSiteId()
                : 'default');

        const cache = {
            schemaVersion: CONFIG.schemaVersion,
            cachedAt: new Date().toISOString(),
            siteId: activeSiteId,
            
            // Orchestrator computed results
            computed: null,
            
            // Key metrics for dashboard
            dashboard: collectDashboardMetrics()
        };
        
        // Get orchestrator results if available
        if (global.GaipOrchestrator && typeof global.GaipOrchestrator.getState === 'function') {
            const state = global.GaipOrchestrator.getState();
            if (state && state.computed) {
                cache.computed = state.computed;
            }
        }
        
        return cache;
    }

    function collectDashboardMetrics() {
        // Collect key metrics from various sources for dashboard display
        const metrics = {
            timestamp: new Date().toISOString()
        };
        
        // Growth potential — prefer live global, fall back to orchestrator computed state
        const _cm = global.climateMetrics;
        const _cc = global.GaipOrchestrator && typeof global.GaipOrchestrator.getState === 'function'
            ? global.GaipOrchestrator.getState()?.computed?.climate : null;
        if (_cm) {
            metrics.growthPotential = _cm.growth?.weighted;
            metrics.gdd             = _cm.gdd?.today;
            metrics.et              = _cm.et?.daily;
            metrics.soilTemp        = _cm.soilTemp?.d100mm;
        } else if (_cc) {
            metrics.growthPotential = _cc.growth?.weighted;
            metrics.soilTemp        = _cc.soilTemp?.d100mm ?? _cc.soilTemp;
        }
        
        // Disease risk — GAIP_DISEASE_RESULT is the live global (disease-engine-pure shape:
        // overallScore 0-100, topThreats[].disease). GAIP_DiseaseResults is a legacy alias
        // that was never reliably set; fall back to it for safety only.
        const _dr = global.GAIP_DISEASE_RESULT || global.GAIP_DiseaseResults;
        if (_dr) {
            metrics.diseaseRisk = _dr.overallScore !== undefined ? _dr.overallScore : (_dr.overall || null);
            metrics.topDisease  = (_dr.topThreats && _dr.topThreats[0])
                                ? _dr.topThreats[0].disease
                                : (_dr.highestRisk || null);
            // Forecast peak + disease name for dashboard alert
            const _fc = global.GAIP_DISEASE_FORECAST;
            if (_fc && _fc.summary) {
                metrics.forecastPeak    = _fc.summary.peakRisk   || null;
                metrics.peakDay         = _fc.summary.peakDay    != null ? _fc.summary.peakDay : null;
                metrics.forecastDisease = _fc.summary.topThreat  || null;
            }
        }
        
        // Stress trajectory — result is on GAIP_TRAJECTORY_RESULT (set by hub-orchestrator after
        // GAIP_StressTrajectory.project() runs). GAIP_StressTrajectory itself is the engine object.
        const _st = global.GAIP_TRAJECTORY_RESULT || global.GAIP_STRESS_TRAJECTORY_RESULT;
        if (_st) {
            metrics.stressIndex    = (_st.summary && _st.summary.currentScore != null)
                                   ? _st.summary.currentScore
                                   : (_st.currentStress || null);
            metrics.trendDirection = (_st.summary && _st.summary.trend) ? _st.summary.trend : null;
        }
        
        // Irrigation need — mirror daily-dashboard.js fallback chain
        const _ir = global.GAIP_IrrigationResults || global.GAIP_IRRIGATION_RESULT;
        if (_ir) {
            metrics.irrigationNeed = _ir.weeklyNeed
                != null ? _ir.weeklyNeed
                : _ir.summary && _ir.summary.totalIrrigation != null ? _ir.summary.totalIrrigation
                : _ir.schedule ? _ir.schedule.reduce(function(s, d) { return s + ((d.irrigation && d.irrigation.totalDepth) || 0); }, 0)
                : null;
        }
        
        return metrics;
    }

    function getCachedResults() {
        const cached = safeJsonParse(storageGet(CONFIG.keys.cache));
        if (!cached) return null;
        
        // Check cache age
        const cacheAge = (Date.now() - new Date(cached.cachedAt).getTime()) / (1000 * 60 * 60);
        if (cacheAge > CONFIG.cacheMaxAge) {
            log('cache', 'Cache expired', { age: cacheAge.toFixed(1) + 'h' });
            return null;
        }
        
        return cached;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    const GilbaPersistence = {
        version: CONFIG.version,

        /**
         * Initialize persistence layer
         * Called automatically on DOMContentLoaded
         */
        init: function() {
            if (_initialized) return;
            
            log('init', 'Initializing Gilba Persistence v' + CONFIG.version);
            
            if (!storageAvailable()) {
                warn('init', 'localStorage not available - persistence disabled');
                return;
            }
            
            // Bind auto-save events
            this.bindAutoSave();
            
            // Restore state after a short delay (let other modules init first)
            setTimeout(() => {
                this.restore();
            }, 200);
            
            _initialized = true;
            log('init', 'Persistence ready');
        },

        /**
         * Bind auto-save to input changes
         */
        bindAutoSave: function() {
            // Listen for all input changes in the hub
            const hub = document.getElementById('gaip-hub');
            if (!hub) return;
            
            hub.addEventListener('change', (e) => {
                this.scheduleSave();
            });
            
            hub.addEventListener('input', (e) => {
                // Debounce input events more aggressively
                this.scheduleSave();
            });
            
            // Listen for custom GAIP events
            const gaipEvents = [
                'gaip:samples-imported',
                'gaip:sample-loaded',
                'gaip:sample-renamed',
                'gaip:turf-profile-change',
                'gaip:analysis-complete',
                'gaip:orchestrator-complete', // fires after computeAll — captures irrigation, PGR, etc.
                'gaip:weather-ready',         // weather-ready may trigger a second computeAll with full data
                'gaip:site-added',
                'gaip:site-removed',
                'gaip:site-renamed',
                'gaip:site-changed'
            ];
            
            gaipEvents.forEach(event => {
                document.addEventListener(event, () => {
                    this.scheduleSave();
                });
            });
            
            // Save before page unload
            window.addEventListener('beforeunload', () => {
                this.saveImmediate();
            });
            
            log('events', 'Auto-save bound');
        },

        /**
         * Schedule a debounced save
         */
        scheduleSave: function() {
            if (_saveTimer) {
                clearTimeout(_saveTimer);
            }
            
            _saveTimer = setTimeout(() => {
                this.saveImmediate();
            }, CONFIG.saveDebounce);
        },

        /**
         * Perform immediate save (no debounce)
         */
        saveImmediate: function() {
            const now = Date.now();
            
            // Prevent saves more than once per second
            if (now - _lastSaveTime < 1000) {
                return;
            }
            _lastSaveTime = now;
            
            this.save();
        },

        /**
         * Save all state to localStorage
         */
        save: function() {
            log('save', 'Saving state...');
            
            // Save input state
            const state = collectInputState();
            storageSet(CONFIG.keys.state, JSON.stringify(state));
            
            // Save preferences
            const prefs = collectPreferences();
            storageSet(CONFIG.keys.prefs, JSON.stringify(prefs));
            
            // Save samples
            const samples = collectSamples();
            if (samples) {
                storageSet(CONFIG.keys.samples, JSON.stringify(samples));
            }
            
            // Cache analysis results (localStorage for same-session use)
            const cache = cacheAnalysisResults();
            storageSet(CONFIG.keys.cache, JSON.stringify(cache));

            // Persist to DB via API so the dashboard can read without localStorage
            this.syncToServer(cache);

            log('save', 'State saved');

            // Dispatch event
            document.dispatchEvent(new CustomEvent('gaip:state-saved', {
                detail: { timestamp: state.savedAt }
            }));
        },

        /**
         * POST analysis cache to the server so the dashboard can read from the DB.
         * Fires after every save that has a valid site_id and metrics.
         */
        syncToServer: function(cache) {
            if (!cache || !cache.dashboard) return;

            // Use the Laravel UUID from GAIP_HUB_CONFIG — not cache.siteId which is the
            // Hub's internal string identifier (e.g. "burns_gc") rather than the DB primary key.
            const siteId = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId)
                || cache.siteId;
            if (!siteId) return;

            const csrfToken = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.csrfToken)
                || document.querySelector('meta[name="csrf-token"]')?.content;
            const restUrl = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.restUrl) || '/api/';

            fetch(restUrl + 'analysis-cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    site_id:     siteId,
                    analyzed_at: cache.dashboard.timestamp || cache.cachedAt || new Date().toISOString(),
                    metrics:     cache.dashboard,
                    computed:    cache.computed || null,
                }),
            }).then(function() {
                // Signal is sent by the dedicated 3s timer in orchestrator-complete handler
            }).catch(function() {
                // Silently ignore — localStorage remains the fallback
            });
        },

        /**
         * Restore all state from localStorage
         */
        restore: function() {
            log('restore', 'Restoring state...');
            
            // Purge stale useLiveWeather=false from any existing saved climate state.
            // v10.8.3 stopped persisting this value (checkbox always defaults to true in HTML).
            // Old saves may have it stored as false, which would survive here as dead data.
            try {
                const existingState = safeJsonParse(storageGet(CONFIG.keys.state));
                if (existingState && existingState.climate && 'useLiveWeather' in existingState.climate) {
                    delete existingState.climate.useLiveWeather;
                    storageSet(CONFIG.keys.state, JSON.stringify(existingState));
                    log('restore', 'Purged stale useLiveWeather from saved state');
                }
            } catch (e) { /* ignore */ }
            
            // Restore preferences first (card states)
            const prefs = safeJsonParse(storageGet(CONFIG.keys.prefs));
            if (prefs) {
                restorePreferences(prefs);
                log('restore', 'Preferences restored');
            }
            
            // Restore input state
            const state = safeJsonParse(storageGet(CONFIG.keys.state));
            if (state) {
                // Use a slight delay to ensure DOM is ready
                setTimeout(() => {
                    restoreInputState(state);
                    log('restore', 'Input state restored');
                    
                    // Dispatch event
                    document.dispatchEvent(new CustomEvent('gaip:state-restored', {
                        detail: { savedAt: state.savedAt }
                    }));
                }, 100);
            } else {
                // No saved state (first visit or incognito). Still dispatch gaip:state-restored
                // so the auto-run gate in hub-tissue-v3 doesn't wait for the 4.5s safety fallback.
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('gaip:state-restored', {
                        detail: { savedAt: null, fresh: true }
                    }));
                }, 100);
            }
            
            // Restore samples from persistence
            const samples = safeJsonParse(storageGet(CONFIG.keys.samples));
            if (samples) {
                // Delay to ensure SampleManager is initialized
                setTimeout(() => {
                    restoreSamples(samples);
                }, 200);
            }
        },

        /**
         * Clear all saved data
         */
        clear: function() {
            Object.values(CONFIG.keys).forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    // Ignore
                }
            });
            
            log('clear', 'All saved data cleared');
            
            document.dispatchEvent(new CustomEvent('gaip:state-cleared'));
        },

        /**
         * Export current state as JSON string
         */
        export: function() {
            const exportData = {
                version: CONFIG.version,
                exportedAt: new Date().toISOString(),
                state: collectInputState(),
                prefs: collectPreferences(),
                samples: collectSamples()
            };
            
            return JSON.stringify(exportData, null, 2);
        },

        /**
         * Import state from JSON string
         */
        import: function(jsonString) {
            const data = safeJsonParse(jsonString);
            if (!data) {
                warn('import', 'Invalid JSON');
                return false;
            }
            
            // Validate version compatibility
            if (!data.version) {
                warn('import', 'No version in import data');
                return false;
            }
            
            // Store imported data
            if (data.state) {
                storageSet(CONFIG.keys.state, JSON.stringify(data.state));
            }
            if (data.prefs) {
                storageSet(CONFIG.keys.prefs, JSON.stringify(data.prefs));
            }
            if (data.samples) {
                storageSet(CONFIG.keys.samples, JSON.stringify(data.samples));
            }
            
            // Restore immediately
            this.restore();
            
            log('import', 'Data imported successfully');
            return true;
        },

        /**
         * Get cached dashboard metrics
         */
        getCachedDashboard: function() {
            const cached = getCachedResults();
            return cached ? cached.dashboard : null;
        },

        /**
         * Check if state is saved
         */
        hasSavedState: function() {
            return storageGet(CONFIG.keys.state) !== null;
        },

        /**
         * Get last save timestamp
         */
        getLastSaveTime: function() {
            const state = safeJsonParse(storageGet(CONFIG.keys.state));
            return state ? state.savedAt : null;
        }
    };

    // =========================================================================
    // AUTO-INITIALIZE
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => GilbaPersistence.init(), 300);
        });
    } else {
        setTimeout(() => GilbaPersistence.init(), 300);
    }

    // Export to global
    global.GilbaPersistence = GilbaPersistence;

})(typeof window !== 'undefined' ? window : this);
