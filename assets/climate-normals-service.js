/**
 * Gilba Hub — Climate Normals Service
 * ============================================================================
 * GH-245 (Hoxton audit D01-D03).
 *
 * Resolves real monthly climate normals (12-month temperature series) for a
 * site's coordinates, for renderers that need a whole year — Monthly N
 * Distribution, Monthly Schedule — as opposed to the single live reading
 * ClimateDataService (climate-engine-v2.js) provides for the "Climate &
 * Growth Conditions" dashboard card.
 *
 * Hoxton audit D02/D03 background: two independent latitude-guess fallbacks
 * previously fabricated a regional profile whenever real data wasn't wired
 * up — which was always, because nothing ever populated the "real" slot they
 * checked first. This service is that real source:
 *
 *   Tier 1: NASA POWER Climatology API — pre-computed multi-year climatology
 *           (currently 20-year, 2001-2020, MERRA-2-derived), one small
 *           request, global coverage, CC0 licensed. Verified against real
 *           NIWA normals for Auckland/Christchurch during the fix — max
 *           ~0.5degC error.
 *   Tier 2: Open-Meteo historical archive, averaged client-side over a short
 *           window. Fallback only — a short window reflects recent-years
 *           weather, not a true multi-decade normal.
 *   Tier 3: null. Callers must surface "climate data unavailable" rather
 *           than fabricate a value.
 *
 * Deliberately standalone — no GilbaHub / orchestrator dependency — because
 * some pages that need Monthly Schedule (plan.blade.php) are intentionally
 * lightweight and don't load climate-engine-v2.js or its dependencies. Pages
 * that DO load climate-engine-v2.js get this service too; ClimateFetchCoordinator
 * .ensureMonthlyNormals() there delegates to window.GilbaClimateNormalsService.ensure()
 * instead of duplicating the fetch/cache logic.
 *
 * Writes results to window.climateMetrics.monthlyTemps /
 * .monthlyTempsSource / .monthlyTempsPeriod — the same object
 * climate-engine-v2.js's legacy shim maintains — so every existing consumer
 * (nutrition-summary-integration.js, nutrition-calendar.js, word-export.js)
 * keeps reading from the one place they already check.
 *
 * @version 1.0.0
 */

(function (global) {
    'use strict';

    var NASA_POWER_CLIMATOLOGY = 'https://power.larc.nasa.gov/api/temporal/climatology/point';
    var NASA_POWER_MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    var OPEN_METEO_HISTORICAL = 'https://archive-api.open-meteo.com/v1/archive';
    var OPEN_METEO_FALLBACK_YEARS = 5;

    function fmtDate(d) {
        return d.toISOString().slice(0, 10);
    }

    async function fetchNasaPower(lat, lon) {
        var params = new URLSearchParams({
            parameters: 'T2M',
            community: 'AG',
            longitude: lon,
            latitude: lat,
            format: 'JSON'
        });

        var resp = await fetch(NASA_POWER_CLIMATOLOGY + '?' + params);
        if (!resp.ok) throw new Error('NASA POWER climatology: ' + resp.status);
        var data = await resp.json();
        var t2m = data && data.properties && data.properties.parameter && data.properties.parameter.T2M;
        if (!t2m) throw new Error('NASA POWER climatology: missing T2M in response');

        var monthlyTemps = {};
        for (var m = 1; m <= 12; m++) {
            var v = t2m[NASA_POWER_MONTH_KEYS[m - 1]];
            if (typeof v !== 'number' || v <= -900) {
                throw new Error('NASA POWER climatology: invalid value for month ' + m);
            }
            monthlyTemps[m] = v;
        }

        return {
            monthlyTemps: monthlyTemps,
            source: 'nasa-power',
            period: (data.header && data.header.range) || '2001-2020'
        };
    }

    async function fetchOpenMeteoFallback(lat, lon) {
        var end = new Date();
        var start = new Date(end);
        start.setFullYear(start.getFullYear() - OPEN_METEO_FALLBACK_YEARS);

        var params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            start_date: fmtDate(start),
            end_date: fmtDate(end),
            daily: 'temperature_2m_mean',
            timezone: 'auto'
        });

        var resp = await fetch(OPEN_METEO_HISTORICAL + '?' + params);
        if (!resp.ok) throw new Error('Open-Meteo archive: ' + resp.status);
        var data = await resp.json();
        var times = (data.daily && data.daily.time) || [];
        var temps = (data.daily && data.daily.temperature_2m_mean) || [];
        if (!times.length) throw new Error('Open-Meteo archive: empty response');

        var buckets = {};
        for (var i = 0; i < times.length; i++) {
            var v = temps[i];
            if (v == null) continue;
            var m = parseInt(times[i].split('-')[1], 10);
            (buckets[m] = buckets[m] || []).push(v);
        }

        var monthlyTemps = {};
        for (var month = 1; month <= 12; month++) {
            var vals = buckets[month];
            if (!vals || !vals.length) throw new Error('Open-Meteo archive: no data for month ' + month);
            monthlyTemps[month] = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        }

        return {
            monthlyTemps: monthlyTemps,
            source: 'open-meteo-fallback',
            period: fmtDate(start) + '..' + fmtDate(end)
        };
    }

    /**
     * Resolve monthly climate normals for a site, trying real sources in
     * order and returning null (never a guess) if none succeed.
     */
    async function get(lat, lon) {
        try {
            return await fetchNasaPower(lat, lon);
        } catch (err) {
            console.warn('[GilbaClimateNormalsService] NASA POWER climatology failed, trying Open-Meteo fallback:', err.message);
        }
        try {
            return await fetchOpenMeteoFallback(lat, lon);
        } catch (err) {
            console.warn('[GilbaClimateNormalsService] Open-Meteo fallback also failed:', err.message);
        }
        return null;
    }

    // ------------------------------------------------------------------------
    // Caching — in-memory only, one resolve per site per page load.
    //
    // GH-245 follow-up: this used to also persist into GAIP_SiteConfig
    // (site-config-persistence.js) via mergeConfig(), so the fetch wouldn't
    // repeat on the next page load. Removed after it caused real data loss:
    // GAIP_SiteConfig.mergeConfig() is available as soon as site-config-
    // persistence.js parses, but the *full* site config (turf, species,
    // location) only lands in its in-memory _configs after init() runs
    // (setTimeout 500ms) and, if localStorage is empty, after an async
    // server pull on top of that. This service's auto-trigger fires on
    // DOMContentLoaded with no such delay. A NASA POWER round-trip easily
    // completes inside that window, and mergeConfig()'s fallback
    // (`_configs[siteId] || {turf:{}, location:{}}`) then wrote a
    // near-empty config over the real one — which pushConfigsToServer()
    // (a full PUT, not a partial patch) then persisted to the database,
    // wiping the site's turf identity. A single small NASA POWER/Open-Meteo
    // request is cheap enough to just repeat once per page load — not worth
    // this class of bug to avoid.
    // ------------------------------------------------------------------------

    // Per-coordinate cache — {} not Map so a plain `key in cache` check also
    // works in older environments. Values are the resolved {monthlyTemps,
    // source, period} object, or null for a confirmed "both tiers failed"
    // (cached too, so a broken site isn't re-queried on every sample in a
    // combined export).
    var _resolvedByCoord = {};
    var _inFlightByCoord = {};

    function coordKey(lat, lon) {
        return lat.toFixed(2) + ',' + lon.toFixed(2);
    }

    // Side-effect-free resolve+cache, keyed by coordinates rather than "the
    // current site". Shared by ensure() (below, for the page's own site) and
    // resolveFor() (for combined-export, where each sample can belong to a
    // genuinely different site — see GH-245 follow-up 2).
    function resolveCoord(lat, lon) {
        var key = coordKey(lat, lon);
        if (Object.prototype.hasOwnProperty.call(_resolvedByCoord, key)) {
            return Promise.resolve(_resolvedByCoord[key]);
        }
        if (_inFlightByCoord[key]) return _inFlightByCoord[key];

        _inFlightByCoord[key] = (async function () {
            try {
                var result = await get(lat, lon);
                _resolvedByCoord[key] = result;
                return result;
            } finally {
                delete _inFlightByCoord[key];
            }
        })();
        return _inFlightByCoord[key];
    }

    function applyResult(result) {
        if (!global.climateMetrics) global.climateMetrics = {};
        global.climateMetrics.monthlyTemps = result ? result.monthlyTemps : null;
        global.climateMetrics.monthlyTempsSource = result ? result.source : 'unavailable';
        global.climateMetrics.monthlyTempsPeriod = result ? result.period : null;

        // Mirror into GAIP_STATE.climate.monthlyTemps too — plan.blade.php's
        // GAIP_STATE bridge (and any other page reading state.climate
        // directly rather than window.climateMetrics) checks this as its
        // second-priority source.
        if (result && global.GAIP_STATE) {
            global.GAIP_STATE.climate = Object.assign({}, global.GAIP_STATE.climate || {}, {
                monthlyTemps: result.monthlyTemps
            });
        }

        if (typeof document !== 'undefined' && document.dispatchEvent && typeof CustomEvent !== 'undefined') {
            document.dispatchEvent(new CustomEvent('gaip:monthly-normals-ready', {
                detail: { available: !!result, source: result ? result.source : 'unavailable' }
            }));
        }
    }

    /**
     * Resolve for the page's own site and write to window.climateMetrics /
     * GAIP_STATE.climate (the "current site" slots every existing consumer —
     * nutrition-summary-integration.js, nutrition-calendar.js, word-export.js
     * single-export — already checks). Idempotent per coordinate pair within
     * this page load (see comment above on why this doesn't persist across
     * page loads).
     */
    async function ensure(lat, lon) {
        if (!lat || !lon) return;
        var result = await resolveCoord(lat, lon);
        applyResult(result);
    }

    /**
     * GH-245 follow-up 2: resolve for an arbitrary site's coordinates without
     * touching window.climateMetrics — for combined multi-site export, where
     * each sample can belong to a different site and writing to the single
     * "current site" slot would leak one site's normals onto every other
     * sample in the export. Pair with getResolvedSync() to read the result
     * back synchronously once resolved (word-export.js's _buildEngineInputs
     * runs synchronously per sample and can't itself await a fetch).
     */
    async function resolveFor(lat, lon) {
        if (!lat || !lon) return null;
        return resolveCoord(lat, lon);
    }

    /**
     * Synchronous read of whatever resolveFor()/ensure() already resolved
     * for these exact coordinates this page load. Returns null both when
     * nothing has resolved yet AND when both tiers genuinely failed for this
     * site — callers already treat null as "unavailable" either way, which
     * is the correct, non-fabricating behaviour in both cases.
     */
    function getResolvedSync(lat, lon) {
        if (!lat || !lon) return null;
        var key = coordKey(lat, lon);
        return Object.prototype.hasOwnProperty.call(_resolvedByCoord, key) ? _resolvedByCoord[key] : null;
    }

    /**
     * GH-245 follow-up 3: why getResolvedSync() returned null, for callers
     * that need to tell a client apart from a real "both tiers failed"
     * result — a site with no coordinates configured, or coordinates whose
     * fetch simply hasn't resolved yet this page load (service not loaded,
     * pre-pass skipped, or still in flight), previously surfaced the exact
     * same "climate data unavailable" message as a genuine NASA POWER +
     * Open-Meteo outage.
     */
    function getReason(lat, lon) {
        if (!lat || !lon) return 'no-coordinates';
        var key = coordKey(lat, lon);
        if (!Object.prototype.hasOwnProperty.call(_resolvedByCoord, key)) return 'not-attempted';
        return _resolvedByCoord[key] ? 'resolved' : 'fetch-failed';
    }

    // ------------------------------------------------------------------------
    // Auto-trigger on load — no event system required. Reads whatever
    // coordinate source this page actually has: DOM .gaip-lat/.gaip-lon
    // (hub.blade.php / reports pages) or GAIP_STATE.location (plan.blade.php,
    // set synchronously by its inline head script before this file loads).
    // ------------------------------------------------------------------------

    function readCoords() {
        var lat, lon;
        if (typeof document !== 'undefined') {
            var latEl = document.querySelector('.gaip-lat');
            var lonEl = document.querySelector('.gaip-lon');
            if (latEl && lonEl) {
                lat = parseFloat(latEl.value);
                lon = parseFloat(lonEl.value);
            }
        }
        if (!isFinite(lat) || !isFinite(lon)) {
            var loc = global.GAIP_STATE && global.GAIP_STATE.location;
            if (loc) {
                lat = parseFloat(loc.lat);
                lon = parseFloat(loc.lon != null ? loc.lon : loc.lng);
            }
        }
        if (isFinite(lat) && isFinite(lon) && lat && lon) {
            return { lat: lat, lon: lon };
        }
        return null;
    }

    // GH-246: pages that only ever need normals for an explicit user
    // action (Plan's "Generate Nutrition Program" button, not anything
    // rendered on load) can set this before this script loads to skip
    // the eager DOMContentLoaded fetch below and call ensureFromPage()
    // themselves at the point they actually need it.
    function autoTrigger() {
        if (global.GAIP_CLIMATE_NORMALS_SKIP_AUTOTRIGGER) return;
        var coords = readCoords();
        if (!coords) return;
        ensure(coords.lat, coords.lon).catch(function (err) {
            console.warn('[GilbaClimateNormalsService] auto-trigger ensure failed:', err && err.message);
        });
    }

    /**
     * GH-245 follow-up: awaitable version of the auto-trigger, for flows
     * that read window.climateMetrics.monthlyTemps synchronously right
     * after calling this — Word export in particular. autoTrigger() alone
     * is fire-and-forget on page load; if the export button is clicked
     * before that fetch resolves (a single NASA POWER round-trip, but not
     * instant), _buildEngineInputs() would read an empty
     * window.climateMetrics.monthlyTemps and the report would say "climate
     * data unavailable" even though the Nutrition Program tab, generated a
     * minute earlier on a different page load, clearly had real data.
     * Callers should `await` this immediately before collecting export
     * data. No-ops (resolves immediately) if no coordinate source is found
     * or normals already resolved this page load.
     */
    async function ensureFromPage() {
        var coords = readCoords();
        if (!coords) return;
        return ensure(coords.lat, coords.lon);
    }

    global.GilbaClimateNormalsService = {
        get: get,
        ensure: ensure,
        ensureFromPage: ensureFromPage,
        resolveFor: resolveFor,
        getResolvedSync: getResolvedSync,
        getReason: getReason
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', autoTrigger);
        } else {
            autoTrigger();
        }
        // Coordinates can also become available slightly after this script
        // runs (site-config-persistence.js restore flow on hub.blade.php) —
        // retry on the same event nutrition-calendar.js already relies on.
        document.addEventListener('gaip:site-config-applied', autoTrigger);
    }

    if (typeof console !== 'undefined' && console.log) {
        console.log('[GilbaClimateNormalsService] v1.0.0 loaded');
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            get: get,
            ensure: ensure,
            ensureFromPage: ensureFromPage,
            resolveFor: resolveFor,
            getResolvedSync: getResolvedSync,
            getReason: getReason
        };
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
