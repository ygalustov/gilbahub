/**
 * ============================================================================
 * GAIP FIELD LOG — STANDALONE ANALYSIS  v1.0.0
 * ============================================================================
 *
 * Lightweight weather fetch + engine run for the [gaip_field_log] page.
 * Runs WITHOUT the full Hub asset stack (no gilba-hub-v2.js, no hub-tissue-v3.js).
 *
 * WHAT IT DOES:
 *   1. Reads saved site location from localStorage (gilba_hub_site_configs)
 *   2. Fetches Open-Meteo forecast for that location
 *   3. Computes growth potential via GilbaGrowthPotentialEngine (PACE)
 *   4. Runs DiseaseEnginePure.analyse() — loaded as a dependency
 *   5. Runs gaip_pgr_calculate_pure() if PGR is configured in saved site state
 *   6. Writes to window.GAIP_DISEASE_RESULT, window.GAIP_CLIMATE_STRESS_RESULT,
 *      window.GAIP_PGR_RESULT — the same globals gaip-field-log.js tile renderer reads
 *
 * DEPENDENCIES (enqueued by PHP before this file):
 *   - disease-engine-pure.js   → window.DiseaseEnginePure
 *   - gilba-pgr-module-v3.js   → window.gaip_pgr_calculate_pure
 *
 * FALLBACK:
 *   If location is missing, tiles show '--'.
 *   If disease engine is absent, disease tile shows '--'.
 *   If PGR not configured, PGR tile shows '--'.
 *   All failures are silent (warn only) — never breaks page.
 *
 * ============================================================================
 */

(function (global) {
    'use strict';
    // b35fix272: namespaced storage — prevents cross-mode key bleed
    var _ls = window.GilbaStorageNS ? window.GilbaStorageNS.get() : localStorage;


    var VERSION = '1.0.0';
    var OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

    // GP delegated to GilbaGrowthPotentialEngine (PACE, b35fix473).

    function log()  { var a = Array.prototype.slice.call(arguments); a.unshift('[FieldAnalysis]'); console.log.apply(console, a); }
    function warn() { var a = Array.prototype.slice.call(arguments); a.unshift('[FieldAnalysis WARN]'); console.warn.apply(console, a); }

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
            .then(function(res) {
                return res.json().then(function(data) {
                    if (!res.ok) throw new Error((data && data.message) || ('HTTP ' + res.status));
                    return data;
                });
            });
    }

    // -------------------------------------------------------------------------
    // GP CURVE — delegates to GilbaGrowthPotentialEngine (PACE model)
    // -------------------------------------------------------------------------
    function calcGP(tempC, type) {
        if (tempC == null) { return null; }
        var GPE = global.GilbaGrowthPotentialEngine;
        if (!GPE) { return null; }
        return GPE.compute(tempC, { model: 'pace', species: (type === 'c4' ? 'c4' : 'c3') });
    }

    // Weighted GP for mixed C3/C4 profiles
    function calcWeightedGP(tempC, c3Frac, c4Frac) {
        var c3 = calcGP(tempC, 'c3');
        var c4 = calcGP(tempC, 'c4');
        if (c3 == null && c4 == null) { return null; }
        c3 = c3 || 0;
        c4 = c4 || 0;
        return Math.round(((c3 * c3Frac) + (c4 * c4Frac)) * 1000) / 1000;
    }

    // -------------------------------------------------------------------------
    // SITE CONFIG  — read saved turf profile + location from localStorage
    // -------------------------------------------------------------------------
    function getSavedSiteConfig(siteId) {
        try {
            // 1. Try hub site configs (written by site-config-persistence.js)
            var raw = _ls.getItem('gilba_hub_site_configs');
            if (raw) {
                var configs = JSON.parse(raw);
                if (configs[siteId]) { return configs[siteId]; }
            }

            // 2. Try disease cache — it was written for this siteId so location
            //    must have been known at write time. Extract location from it.
            var cacheRaw = _ls.getItem('gilba_disease_cache_' + siteId);
            if (cacheRaw) {
                var cachePayload = JSON.parse(cacheRaw);
                if (cachePayload && cachePayload.result && cachePayload.result.location) {
                    return { location: cachePayload.result.location, turf: cachePayload.result.turf || {} };
                }
            }

            // 3. Try GAIP_SampleManager site metadata if available
            if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getSiteList === 'function') {
                var sites = global.GAIP_SampleManager.getSiteList();
                for (var i = 0; i < sites.length; i++) {
                    if (sites[i].id === siteId && sites[i].lat && sites[i].lon) {
                        return { location: { lat: sites[i].lat, lon: sites[i].lon, name: sites[i].label }, turf: {} };
                    }
                }
            }

            // 4. No match — do NOT fall back to a different site's config
            warn('No saved config for site "' + siteId + '" — skipping analysis');
            return null;
        } catch (e) {
            warn('Could not read site config:', e.message);
            return null;
        }
    }

    function getActiveSiteId() {
        if (global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getActiveSiteId === 'function') {
            return global.GAIP_SampleManager.getActiveSiteId();
        }
        return _ls.getItem('gaip_active_site') || 'default';
    }

    // -------------------------------------------------------------------------
    // REGION DETECTION from lat/lon
    // -------------------------------------------------------------------------
    function detectRegion(lat, lon) {
        if (lat == null || lon == null) { return 'AU'; }
        // NZ: lon 165-180, lat -48 to -34
        if (lon >= 165 && lon <= 180 && lat >= -48 && lat <= -34) { return 'NZ'; }
        // UK/IE: lon -11 to 2, lat 49-61
        if (lon >= -11 && lon <= 2 && lat >= 49 && lat <= 61) { return 'GB'; }
        // EU: lon 2-30, lat 35-72
        if (lon >= 2 && lon <= 30 && lat >= 35 && lat <= 72) { return 'EU'; }
        // Japan: lon 128-146, lat 30-46
        if (lon >= 128 && lon <= 146 && lat >= 30 && lat <= 46) { return 'JP'; }
        return 'AU';
    }

    // -------------------------------------------------------------------------
    // SPECIES CLASSIFICATION
    // -------------------------------------------------------------------------
    function classifySpecies(turfObj) {
        // Accept either a turf config object (preferred) or a plain species string (legacy).
        var turf = (typeof turfObj === 'object' && turfObj) ? turfObj : {};
        var species = (typeof turfObj === 'string') ? turfObj
            : (turf.grassSpecies || turf.species || '');
        if (!species) { return { key: 'perennialRyegrass', isC4: false, c3: 1, c4: 0 }; }

        var s = species.toLowerCase();
        var isC4 = /couch|bermuda|kikuyu|zoysia|buffalo|paspalum|seashore/.test(s);
        var key = isC4 ? 'couch' : 'perennialRyegrass';
        if (/bent/.test(s))     { key = 'bentgrass'; }
        if (/poa|annual blue/.test(s)) { key = 'poaAnnua'; }
        if (/fescue/.test(s))   { key = 'tallFescue'; }
        if (/rye/.test(s))      { key = 'perennialRyegrass'; }
        if (/blue|kbg/.test(s)) { key = 'kentuckyBluegrass'; }

        // b35fix300a: Read actual C3/C4 fractions from turf config.
        // Only applies to C4 base species with a cool-season overseed.
        // For pure C3 species, c3Cover=0 means "no overseed configured"
        // not "0% C3", so we must not read it.
        var c3 = isC4 ? 0 : 1;
        var c4 = isC4 ? 1 : 0;

        if (isC4) {
            // C4 base — check for overseed fractions
            var c3Cover = turf.c3Cover != null ? parseFloat(turf.c3Cover) : null;
            if (c3Cover != null && !isNaN(c3Cover) && c3Cover > 0 && c3Cover <= 100) {
                c3 = c3Cover / 100;
                c4 = 1 - c3;
            } else if (turf.c3Fraction != null && parseFloat(turf.c3Fraction) > 0) {
                c3 = parseFloat(turf.c3Fraction);
                c4 = parseFloat(turf.c4Fraction) || (1 - c3);
            } else if (turf.percentC3Cover != null && parseFloat(turf.percentC3Cover) > 0) {
                c3 = parseFloat(turf.percentC3Cover) / 100;
                c4 = 1 - c3;
            }
        }

        return { key: key, isC4: isC4, c3: c3, c4: c4 };
    }

    // -------------------------------------------------------------------------
    // ONE-TIME CACHE MIGRATION
    // Purge any disease cache entries written before siteId tagging was added.
    // Runs once per page load, keyed by a localStorage flag so it doesn't
    // repeat on every visit.
    // -------------------------------------------------------------------------
    (function purgeLegacyDiseaseCache() {
        try {
            if (_ls.getItem('gilba_disease_cache_purged_v1')) { return; }
            var keys = Object.keys(localStorage);
            keys.forEach(function(key) {
                if (key.indexOf('gilba_disease_cache_') !== 0) { return; }
                try {
                    var payload = JSON.parse(_ls.getItem(key));
                    if (!payload || !payload.result || !payload.result.siteId) {
                        _ls.removeItem(key);
                    }
                } catch(e) { _ls.removeItem(key); }
            });
            _ls.setItem('gilba_disease_cache_purged_v1', '1');
        } catch(e) {}
    })();

    // -------------------------------------------------------------------------
    // OPEN-METEO FETCH
    // -------------------------------------------------------------------------
    function fetchWeather(lat, lon) {
        var hourly = [
            'temperature_2m',
            'relative_humidity_2m',
            'dew_point_2m',
            'precipitation',
            'wind_speed_10m',
            'shortwave_radiation'
        ].join(',');

        var daily = [
            'temperature_2m_max',
            'temperature_2m_min',
            'temperature_2m_mean',
            'precipitation_sum',
            'wind_speed_10m_max'
        ].join(',');

        var url = OPEN_METEO
            + '?latitude='  + lat
            + '&longitude=' + lon
            + '&hourly='    + hourly
            + '&daily='     + daily
            + '&timezone=auto'
            + '&forecast_days=5';

        return fetch(url).then(function (res) {
            if (!res.ok) { throw new Error('Open-Meteo HTTP ' + res.status); }
            return res.json();
        });
    }

    // -------------------------------------------------------------------------
    // WEATHER → ENGINE INPUT SHAPE
    // -------------------------------------------------------------------------
    function parseWeather(raw) {
        var h   = raw.hourly  || {};
        var d   = raw.daily   || {};
        var now = new Date();
        var hr  = now.getHours();

        // Current hour index
        var times = h.time || [];
        var curIdx = 0;
        for (var i = 0; i < times.length; i++) {
            if (new Date(times[i]) <= now) { curIdx = i; }
        }

        var tempCurrent = (h.temperature_2m   || [])[curIdx]  || null;
        var rhCurrent   = (h.relative_humidity_2m || [])[curIdx] || null;
        var dpCurrent   = (h.dew_point_2m     || [])[curIdx]  || null;

        // Daily for today (index 0)
        var tempMax   = (d.temperature_2m_max  || [])[0] || null;
        var tempMin   = (d.temperature_2m_min  || [])[0] || null;
        var tempMean  = (d.temperature_2m_mean || [])[0] || (tempMax != null && tempMin != null ? (tempMax + tempMin) / 2 : tempCurrent);
        var precip    = (d.precipitation_sum   || [])[0] || 0;

        // Estimate leaf wetness hours — hours where RH > 90
        var rhArr    = h.relative_humidity_2m || [];
        var wetHours = 0;
        rhArr.forEach(function (rh) { if (rh >= 90) { wetHours++; } });
        // Clamp to 24 (one day)
        wetHours = Math.min(24, wetHours);

        // Night RH (hours 20-06 local)
        var nightRHArr = [];
        times.forEach(function (t, idx) {
            var hr2 = new Date(t).getHours();
            if (hr2 >= 20 || hr2 <= 6) {
                nightRHArr.push((h.relative_humidity_2m || [])[idx] || 0);
            }
        });
        var nightRH = nightRHArr.length
            ? nightRHArr.reduce(function (a, b) { return a + b; }, 0) / nightRHArr.length
            : rhCurrent;

        // b35fix297: today's 24hr RH average, not single-hour snapshot.
        // Disease engine Fusarium moistureFactor expects a representative daily
        // value, not current-hour which swings wildly day vs night.
        var todayRH = rhArr.slice(0, 24);
        var rhMean = todayRH.length
            ? todayRH.reduce(function (a, b) { return a + b; }, 0) / todayRH.length
            : rhCurrent;

        // b35fix297: build dailyPattern from daily endpoint so disease engine's
        // get5DayAvgTemp() has real data instead of falling back to single-day mean.
        var dailyDates = d.time || [];
        var dailyMeans = d.temperature_2m_mean || [];
        var dailyMins  = d.temperature_2m_min  || [];
        var dailyMaxs  = d.temperature_2m_max  || [];
        var dailyPattern = [];
        for (var dp_i = 0; dp_i < dailyDates.length; dp_i++) {
            dailyPattern.push({
                date: dailyDates[dp_i],
                mean: dailyMeans[dp_i],
                min:  dailyMins[dp_i],
                max:  dailyMaxs[dp_i]
            });
        }

        return {
            temperature: {
                current: tempCurrent,
                mean:    tempMean,
                min:     tempMin,
                max:     tempMax,
                dailyPattern: dailyPattern  // b35fix297
            },
            moisture: {
                humidity: {
                    mean:  rhMean,  // b35fix297: was rhCurrent (single hour)
                    night: nightRH
                },
                precipitation: { total: precip }
            },
            dewpoint: { current: dpCurrent },
            // b35fix92-mobile: key names must match disease-engine-pure.js.
            // b35fix335: getSmithKernsConcurrentHours was retired in favour of
            // getSmithKerns2018Probability which uses the same hourlyData keys
            // (relative_humidity_2m and temperature_2m) but computes the
            // published Smith-Kerns 2018 logistic probability from 5-day means
            // rather than counting "favourable hours". Same input keys, correct
            // model, different output shape.
            hourlyData: {
                temperature_2m:       h.temperature_2m       || [],
                relative_humidity_2m: h.relative_humidity_2m || []
            }
        };
    }

    // -------------------------------------------------------------------------
    // DLI FROM RADIATION
    // Converts hourly shortwave_radiation (W/m²) to mol/m²/day DLI.
    // Formula: DLI = sum(W/m² × 0.0036) over daylight hours (radiation > 0)
    // -------------------------------------------------------------------------
    var DLI_TARGETS = {
        perennialRyegrass: { minimum: 12, optimal: 22 },
        bentgrass:         { minimum: 10, optimal: 18 },
        poaAnnua:          { minimum: 10, optimal: 18 },
        couch:             { minimum: 24, optimal: 35 },
        kikuyu:            { minimum: 22, optimal: 32 },
        zoysia:            { minimum: 18, optimal: 28 },
        default:           { minimum: 15, optimal: 25 }
    };

    function calcDLI(radiationArr) {
        if (!radiationArr || !radiationArr.length) { return null; }
        // Sum today's first 24 hours only, convert W/m² to mol/m²/hr (×0.0036)
        var sum = 0;
        var hrs = Math.min(24, radiationArr.length);
        for (var i = 0; i < hrs; i++) { sum += (radiationArr[i] || 0) * 0.0036; }
        return Math.round(sum * 10) / 10;
    }

    function calcShadeInput(dli, speciesKey) {
        var targets = DLI_TARGETS[speciesKey] || DLI_TARGETS.default;
        if (dli === null) { return { dliDeficit: { percentage: 0 }, stressFactor: 0, fungalRisk: 0 }; }
        var deficitPct = dli < targets.optimal
            ? Math.round((targets.optimal - dli) / targets.optimal * 100)
            : 0;
        var stressFactor = dli < targets.minimum ? Math.min(1, (targets.minimum - dli) / targets.minimum) : 0;
        var fungalRisk   = deficitPct > 30 ? Math.min(100, Math.round((deficitPct - 30) * 2)) : 0;
        return {
            dliDeficit:  { percentage: deficitPct, dli: dli, target: targets.optimal },
            stressFactor: stressFactor,
            fungalRisk:   fungalRisk
        };
    }

    // -------------------------------------------------------------------------
    // DISEASE ENGINE CALL
    // -------------------------------------------------------------------------
    function runDisease(climate, species, region, dewWetHours, shadeInput) {
        var engine = global.DiseaseEnginePure;
        if (!engine || typeof engine.analyse !== 'function') {
            warn('DiseaseEnginePure not available');
            return null;
        }

        try {
            return engine.analyse({
                climate:  climate,
                species:  species.key,
                region:   region,
                nitrogen: { status: 'adequate' },
                shade:    shadeInput || { dliDeficit: { percentage: 0 }, stressFactor: 0, fungalRisk: 0 },
                soil:     {},
                variety:  {},
                traffic:  {},
                mowing:   {},
                dewData:  { leafWetness: { averageWetHours: dewWetHours, totalWetHours: dewWetHours * 2 } },
                tissueNutrients: { hasData: false, compositeModifier: 1, modifiers: {} },
                poaPercent: 0,
                baseSpecies: species.key
            });
        } catch (e) {
            warn('Disease engine error:', e.message);
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // PGR ENGINE CALL
    // -------------------------------------------------------------------------

    // b35fix134: fetch historical daily temps from Open-Meteo archive API from
    // applicationDate to today, build dailyData array, return Promise<result|null>.
    // Without historical data g_pure gets null weatherData -> gddAccumulated=0 -> 0% suppression.
    function runPGRWithHistory(siteConfig, climate, lat, lon) {
        var fn = global.gaip_pgr_calculate_pure;
        if (typeof fn !== 'function') { return Promise.resolve(null); }

        var turf = (siteConfig && siteConfig.turf) || {};
        var pgr  = (siteConfig && siteConfig.pgr) || turf.pgr || {};

        if (!pgr.productType || !pgr.applicationDate) { return Promise.resolve(null); }

        var today    = new Date();
        var endStr   = today.toISOString().split('T')[0];
        var startStr = pgr.applicationDate;

        if (startStr >= endStr) {
            return Promise.resolve(_callPGRPure(fn, turf, pgr, climate, null));
        }

        var archiveUrl = 'https://archive-api.open-meteo.com/v1/archive'
            + '?latitude='   + lat
            + '&longitude='  + lon
            + '&start_date=' + startStr
            + '&end_date='   + endStr
            + '&daily=temperature_2m_max,temperature_2m_min'
            + '&timezone=auto';

        return fetch(archiveUrl)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var dailyData = [];
                if (data.daily && data.daily.time) {
                    for (var j = 0; j < data.daily.time.length; j++) {
                        dailyData.push({
                            date:   data.daily.time[j],
                            tmax:   data.daily.temperature_2m_max[j],
                            tmin:   data.daily.temperature_2m_min[j],
                            source: 'historical'
                        });
                    }
                }
                var weatherData = dailyData.length > 0
                    ? { dailyData: dailyData, source: 'archive' }
                    : null;
                return _callPGRPure(fn, turf, pgr, climate, weatherData);
            })
            .catch(function(err) {
                warn('PGR history fetch failed, falling back to estimate:', err.message);
                return _callPGRPure(fn, turf, pgr, climate, null);
            });
    }

    function _callPGRPure(fn, turf, pgr, climate, weatherData) {
        try {
            return fn({
                turf:        turf,
                pgr:         pgr,
                climate:     climate,
                weatherData: weatherData
            }, {
                applicationDate: pgr.applicationDate,
                productType:     pgr.productType,
                gddThreshold:    pgr.gddThreshold || null
            });
        } catch (e) {
            warn('PGR engine error:', e.message);
            return null;
        }
    }

    // Synchronous fallback — used when coordinates are unavailable
    function runPGR(siteConfig, climate) {
        var fn = global.gaip_pgr_calculate_pure;
        if (typeof fn !== 'function') { return null; }
        var turf = (siteConfig && siteConfig.turf) || {};
        var pgr  = (siteConfig && siteConfig.pgr) || turf.pgr || {};
        if (!pgr.productType || !pgr.applicationDate) { return null; }
        return _callPGRPure(fn, turf, pgr, climate, null);
    }

    // -------------------------------------------------------------------------
    // WRITE GLOBALS  (same keys gaip-field-log.js tile renderer reads)
    // -------------------------------------------------------------------------
    function writeGlobals(diseaseResult, gpData, pgrResult) {
        // Disease
        if (diseaseResult) {
            global.GAIP_DISEASE_RESULT = diseaseResult;
        }

        // Climate / GP  — minimal shape, only what tile renderer needs
        if (gpData) {
            global.GAIP_CLIMATE_STRESS_RESULT = {
                growthPotential: gpData.weighted,
                c3: gpData.c3,
                c4: gpData.c4,
                temperature: gpData.temp
            };
        }

        // PGR — tag with siteId so hub-sync path can validate it against active site.
        // Always write GAIP_PGR_RESULT (even null) so switching to a site with no PGR
        // clears the global — otherwise the tile renderer shows the previous site's value.
        if (pgrResult && pgrResult.success) {
            pgrResult._siteId = diseaseResult && diseaseResult.siteId
                ? diseaseResult.siteId
                : (global.GAIP_SampleManager && global.GAIP_SampleManager.getActiveSiteId
                    ? global.GAIP_SampleManager.getActiveSiteId() : null);
            global.GAIP_PGR_RESULT = pgrResult;
        } else {
            // No PGR for this site — clear the global so the tile shows '--'
            global.GAIP_PGR_RESULT = null;
        }
    }

    // -------------------------------------------------------------------------
    // NOTIFY FIELD LOG TO RE-RENDER TILES
    // -------------------------------------------------------------------------
    function notifyFieldLog() {
        if (global.GAIP_FieldLog && typeof global.GAIP_FieldLog.renderTiles === 'function') {
            global.GAIP_FieldLog.renderTiles();
            return;
        }
        // Fallback: dispatch a custom event field-log listens for
        document.dispatchEvent(new CustomEvent('gaip:field-analysis-complete', { detail: {} }));
    }

    // -------------------------------------------------------------------------
    // MAIN
    // -------------------------------------------------------------------------

    /**
     * Fetch site configs from server and merge into localStorage.
     * Used as a pre-flight on fresh devices where gilba_hub_site_configs is empty.
     * @param {function} onComplete  called when done (merged: true/false)
     */
    function fetchConfigsFromServer(onComplete) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') {
            onComplete(false); return;
        }
        apiFetchJson(base.replace(/\/?$/, '/') + 'sites')
            .then(function(data) {
                var rows = (data && data.data) || [];
                if (!rows.length) {
                    onComplete(false); return;
                }
                var serverConfigs = {};
                rows.forEach(function(site) {
                    var config = site && site.configs && site.configs.gaip && site.configs.gaip.config;
                    if (site && site.id && config) serverConfigs[site.id] = config;
                });
                if (Object.keys(serverConfigs).length === 0) {
                    onComplete(false); return;
                }
                // Merge into localStorage — server wins for species/identity
                var existing = {};
                try {
                    var raw = _ls.getItem('gilba_hub_site_configs');
                    if (raw) existing = JSON.parse(raw);
                } catch(e) {}
                var identityFields = ['turfType', 'subCategory', 'species', 'variety', 'grassSpecies'];
                Object.keys(serverConfigs).forEach(function(siteId) {
                    var srv = serverConfigs[siteId];
                    if (!srv || !srv.turf) return;
                    if (!existing[siteId]) {
                        existing[siteId] = srv;
                    } else {
                        var srvTime = srv.savedAt     ? new Date(srv.savedAt).getTime()             : 0;
                        var locTime = existing[siteId].savedAt ? new Date(existing[siteId].savedAt).getTime() : 0;
                        if (srvTime > locTime) {
                            identityFields.forEach(function(f) {
                                if (srv.turf[f] !== undefined) existing[siteId].turf[f] = srv.turf[f];
                            });
                        }
                    }
                });
                try {
                    _ls.setItem('gilba_hub_site_configs', JSON.stringify(existing));
                    log('Pre-flight: merged site configs from server');
                } catch(e) {}
                onComplete(true);
            })
            .catch(function() { onComplete(false); });
    }

    function run(siteId) {
        var activeSiteId = siteId || getActiveSiteId();

        // b35fix137: one-time cleanup for pgr bleed (mirrors site-config-persistence cleanup).
        // Runs on the field log page which doesn't load site-config-persistence.
        (function() {
            // b35fix137d: final pass — also catch bled entries with complete pgr but
            // same applicationDate shared across multiple sites (impossible legitimately).
            var cleanupKey = 'gilba_pgr_bleed_cleanup_b35fix137d';
            if (_ls.getItem(cleanupKey)) return;
            try {
                var raw = _ls.getItem('gilba_hub_site_configs');
                if (!raw) return;
                var cfgs = JSON.parse(raw);
                var dirty = false;

                // Build map: applicationDate -> [siteIds that have it]
                var dateMap = {};
                Object.keys(cfgs).forEach(function(id) {
                    var d = cfgs[id] && cfgs[id].pgr && cfgs[id].pgr.applicationDate;
                    if (d) { if (!dateMap[d]) dateMap[d] = []; dateMap[d].push(id); }
                });

                Object.keys(cfgs).forEach(function(id) {
                    var cfg = cfgs[id];
                    if (!cfg || !cfg.pgr || !cfg.pgr.productType) return;
                    var isBleed = false;
                    var reason = '';
                    // Case 1: no applicationDate
                    if (!cfg.pgr.applicationDate) { isBleed = true; reason = 'no applicationDate'; }
                    // Case 2: _savedForSite mismatch
                    if (cfg.pgr._savedForSite && cfg.pgr._savedForSite !== id) {
                        isBleed = true; reason = 'savedForSite=' + cfg.pgr._savedForSite;
                    }
                    // Case 3: same applicationDate shared with another site (bled snapshot)
                    var sharedWith = cfg.pgr.applicationDate && dateMap[cfg.pgr.applicationDate]
                        ? dateMap[cfg.pgr.applicationDate].filter(function(x) { return x !== id; })
                        : [];
                    if (sharedWith.length > 0) {
                        // Keep the site that explicitly saved (has _savedForSite == id), clear the rest
                        if (!cfg.pgr._savedForSite || cfg.pgr._savedForSite !== id) {
                            isBleed = true; reason = 'date shared with ' + sharedWith.join(',');
                        }
                    }
                    if (isBleed) {
                        console.log('[FieldAnalysis] PGR bleed cleanup: clearing pgr for', id,
                            '(' + reason + ')');
                        cfg.pgr = { productType: '', applicationDate: null, rateLperHa: null, enabled: false };
                        dirty = true;
                    }
                });
                if (dirty) _ls.setItem('gilba_hub_site_configs', JSON.stringify(cfgs));
                else { console.log('[FieldAnalysis] PGR bleed cleanup: no bleed detected'); }
                _ls.setItem(cleanupKey, '1');
            } catch(e) { /* ignore */ }
        })();

        // Pre-flight: if gilba_hub_site_configs is missing or doesn't have this site,
        // fetch from server before running. Handles fresh devices and cross-device updates.
        var hasLocalConfig = false;
        try {
            var raw = _ls.getItem('gilba_hub_site_configs');
            if (raw) {
                var localCfgs = JSON.parse(raw);
                hasLocalConfig = !!(localCfgs && localCfgs[activeSiteId]);
            }
        } catch(e) {}

        if (!hasLocalConfig) {
            return fetchConfigsFromServer(function() {
                runWithConfig(activeSiteId);
            });
        }
        return runWithConfig(activeSiteId);
    }

    function runWithConfig(activeSiteId) {
        var siteConfig   = getSavedSiteConfig(activeSiteId);
        var location     = siteConfig && siteConfig.location;

        if (!location || !location.lat || !location.lon) {
            warn('No saved location for site "' + activeSiteId + '" — skipping analysis');
            return Promise.resolve(null);
        }

        var lat    = parseFloat(location.lat);
        var lon    = parseFloat(location.lon);
        var turf   = (siteConfig && siteConfig.turf) || {};
        var species = classifySpecies(turf);
        var region  = detectRegion(lat, lon);

        log('Running for', location.name || (lat + ',' + lon), '— species:', species.key,
            '(c3:', species.c3, 'c4:', species.c4 + ')', '— region:', region);

        // b35fix92-mobile-sync: If the hub has already run a full disease analysis
        // (with shade coupling, nitrogen, tissue modifiers etc), use that result
        // directly rather than recalculating with stripped-down hardcoded inputs.
        // Checks window global first (same-page hub), then localStorage cache
        // (written by disease-integration.js after each hub run, TTL 24h).
        // GP is always calculated independently — hub stores it in a different shape.
        // b35fix104-auto-refresh: Cache TTL reduced from 24h to 6h.
        // If cache is stale (>6h), serve it immediately for instant display
        // then trigger a silent background recalculation to refresh the data.
        // This ensures a 4am check gets fresh numbers within ~5 seconds
        // rather than showing up to 24h old results.
        var DISEASE_CACHE_TTL     = 6  * 60 * 60 * 1000;   // 6h — fresh
        var DISEASE_CACHE_STALE   = 6  * 60 * 60 * 1000;   // same threshold for stale-while-revalidate
        var DISEASE_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;   // 24h — hard expiry, discard entirely

        function readCachedDiseaseResult(siteId) {
            try {
                var raw = _ls.getItem('gilba_disease_cache_' + siteId);
                if (!raw) { return null; }
                var payload = JSON.parse(raw);
                if (!payload || !payload.result || !payload.cachedAt) { return null; }
                var age = Date.now() - payload.cachedAt;
                if (age > DISEASE_CACHE_MAX_AGE) {
                    _ls.removeItem('gilba_disease_cache_' + siteId);
                    return null;
                }
                // Return result with staleness flag so caller can decide whether to background refresh
                payload.result._cacheAge    = age;
                payload.result._cacheStale  = age > DISEASE_CACHE_STALE;
                payload.result._cachedAt    = payload.cachedAt;
                return payload.result;
            } catch (e) { return null; }
        }

        /**
         * Run a background weather fetch + disease recalculation and update tiles silently.
         * Called when cache is stale but still valid (6h–24h old).
         * Does not block initial render — tiles update when the refresh completes.
         */
        function backgroundRefresh(activeSiteId, siteConfig, lat, lon, species, region) {
            log('Cache stale — triggering background refresh for', activeSiteId);
            fetchWeather(lat, lon).then(function(raw) {
                var climate    = parseWeather(raw);
                var tempMean   = climate.temperature.mean;
                var gpC3       = calcGP(tempMean, 'c3');
                var gpC4       = calcGP(tempMean, 'c4');
                var gpWeighted = calcWeightedGP(tempMean, species.c3, species.c4);
                var gpData     = { c3: gpC3, c4: gpC4, weighted: gpWeighted, temp: tempMean };

                var rhArr      = (raw.hourly && raw.hourly.relative_humidity_2m) || [];
                var wetHours   = Math.min(24, rhArr.filter(function(rh) { return rh >= 90; }).length);
                var dli        = calcDLI((raw.hourly || {}).shortwave_radiation || []);
                var shadeInput = calcShadeInput(dli, species.key);
                var diseaseResult = runDisease(climate, species, region, wetHours, shadeInput);
                if (diseaseResult) { diseaseResult.siteId = activeSiteId; }
                var pgrResult  = runPGR(siteConfig, climate);

                writeGlobals(diseaseResult, gpData, pgrResult);
                notifyFieldLog();
                log('Background refresh complete for', activeSiteId,
                    '| Top disease:', diseaseResult && diseaseResult.diseases && diseaseResult.diseases[0]
                        ? diseaseResult.diseases[0].displayName + ' ' + diseaseResult.diseases[0].adjustedRisk + '%'
                        : 'none');
            }).catch(function(err) {
                warn('Background refresh failed:', err.message);
            });
        }

        // Only use window.GAIP_DISEASE_RESULT if it was computed for this site.
        // Without this check all sites reuse the last hub run's result regardless of location.
        var windowResult = global.GAIP_DISEASE_RESULT || null;
        // Reject if siteId is missing (old result with no tag) or belongs to a different site
        if (windowResult && windowResult.siteId !== activeSiteId) {
            windowResult = null;
        }
        var hubDiseaseResult = windowResult || readCachedDiseaseResult(activeSiteId) || null;
        // Always calculate PGR independently from saved site config — do not rely on
        // GAIP_PGR_RESULT being set by the desktop hub. At 4am on mobile the hub
        // hasn't run, so the global is always null. runPGR() only needs the saved
        // applicationDate + product from siteConfig, which site-config-persistence
        // now correctly saves without requiring the enable checkbox.
        // Reject GAIP_PGR_RESULT if it was computed for a different site —
        // same guard used for GAIP_DISEASE_RESULT above.
        var _pgrGlobal = global.GAIP_PGR_RESULT || null;
        var hubPGRResult = (_pgrGlobal && _pgrGlobal._siteId && _pgrGlobal._siteId !== activeSiteId)
            ? null
            : _pgrGlobal;

        if (hubDiseaseResult && hubDiseaseResult.diseases && hubDiseaseResult.diseases.length) {
            // Still fetch weather for GP calculation and independent PGR
            return fetchWeather(lat, lon).then(function (raw) {
                var climate    = parseWeather(raw);
                var tempMean   = climate.temperature.mean;
                var gpC3       = calcGP(tempMean, 'c3');
                var gpC4       = calcGP(tempMean, 'c4');
                var gpWeighted = calcWeightedGP(tempMean, species.c3, species.c4);
                var gpData     = { c3: gpC3, c4: gpC4, weighted: gpWeighted, temp: tempMean };

                // Run PGR independently — never depend on desktop hub having run
                // b35fix134: use history-aware PGR so GDD accumulates correctly
                var _pgrPromise = (!hubPGRResult)
                    ? runPGRWithHistory(siteConfig, climate, lat, lon)
                    : Promise.resolve(hubPGRResult);
                return _pgrPromise.then(function(resolvedPGR) {
                    hubPGRResult = resolvedPGR;
                    writeGlobals(hubDiseaseResult, gpData, hubPGRResult);

                var topDisease = hubDiseaseResult.diseases[0];
                var cacheAgeHrs = hubDiseaseResult._cacheAge
                    ? Math.round(hubDiseaseResult._cacheAge / 3600000 * 10) / 10
                    : null;
                log('Analysis complete (hub sync' + (hubDiseaseResult._cacheStale ? ', stale — refreshing' : '') + ') — GP:', Math.round((gpWeighted || 0) * 100) + '%',
                    '| Top disease:', topDisease
                        ? topDisease.displayName + ' ' + topDisease.adjustedRisk + '%'
                        : 'none',
                    '| PGR:', hubPGRResult ? hubPGRResult.effect && hubPGRResult.effect.suppressionPct + '%' : 'none',
                    cacheAgeHrs ? '| Cache age: ' + cacheAgeHrs + 'h' : '');

                    notifyFieldLog();

                    // If cache is stale, kick off a background recalculation.
                    if (hubDiseaseResult._cacheStale) {
                        setTimeout(function() {
                            backgroundRefresh(activeSiteId, siteConfig, lat, lon, species, region);
                        }, 100);
                    }

                    return { gpData: gpData, diseaseResult: hubDiseaseResult, pgrResult: hubPGRResult };
                });
            }).catch(function (err) {
                warn('Weather fetch failed during hub sync:', err.message);
                notifyFieldLog();
                return { gpData: null, diseaseResult: hubDiseaseResult, pgrResult: hubPGRResult };
            });
        }

        // Hub result not available — fall back to independent calculation
        return fetchWeather(lat, lon).then(function (raw) {

            var climate  = parseWeather(raw);
            var tempMean = climate.temperature.mean;

            // Growth potential
            var gpC3       = calcGP(tempMean, 'c3');
            var gpC4       = calcGP(tempMean, 'c4');
            var gpWeighted = calcWeightedGP(tempMean, species.c3, species.c4);
            var gpData     = { c3: gpC3, c4: gpC4, weighted: gpWeighted, temp: tempMean };

            // Leaf wetness estimate from hourly RH
            var rhArr    = (raw.hourly && raw.hourly.relative_humidity_2m) || [];
            var wetHours = rhArr.filter(function (rh) { return rh >= 90; }).length;
            wetHours = Math.min(24, wetHours);

            var dli           = calcDLI((raw.hourly || {}).shortwave_radiation || []);
            var shadeInput    = calcShadeInput(dli, species.key);
            var diseaseResult = runDisease(climate, species, region, wetHours, shadeInput);
            // b35fix97 — tag siteId so the site-switch guard (windowResult.siteId !== activeSiteId)
            // correctly invalidates stale results rather than comparing undefined !== siteId
            if (diseaseResult) { diseaseResult.siteId = activeSiteId; }
            // b35fix134: fetch historical temps for correct GDD accumulation
            return runPGRWithHistory(siteConfig, climate, lat, lon).then(function(pgrResult) {
                writeGlobals(diseaseResult, gpData, pgrResult);

                log('Analysis complete — GP:', Math.round((gpWeighted || 0) * 100) + '%',
                    '| Top disease:', diseaseResult
                        ? (diseaseResult.diseases && diseaseResult.diseases[0]
                            ? diseaseResult.diseases[0].displayName + ' ' + diseaseResult.diseases[0].adjustedRisk + '%'
                            : 'none')
                        : 'engine absent',
                    '| PGR:', pgrResult ? pgrResult.effect && pgrResult.effect.suppressionPct + '%' : 'none');

                notifyFieldLog();
                return { gpData: gpData, diseaseResult: diseaseResult, pgrResult: pgrResult };
            });

        }).catch(function (err) {
            warn('Analysis failed:', err.message);
            return null;
        });
    }

    // -------------------------------------------------------------------------
    // INIT — run after DOM ready, small delay for dependencies to settle
    // -------------------------------------------------------------------------
    function init() {
        // Only run on field log pages
        if (!document.getElementById('gaip-field-log')) { return; }
        setTimeout(function () { run(); }, 600);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    global.GAIP_FieldAnalysis = { version: VERSION, run: run };
    log('v' + VERSION + ' loaded');

})(typeof window !== 'undefined' ? window : this);
