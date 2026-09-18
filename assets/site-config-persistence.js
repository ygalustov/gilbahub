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

    /**
     * GH-441 (GH-439 stage 2): four functions lived here and are gone.
     *
     * getLiveSiteIdMap() / pruneConfigKeys() decided which sites this browser
     * believed in and deleted the rest of the cache; syncSiteRegistryToServer()
     * pushed the browser's own site labels, which is how a live site was
     * renamed to its own ID; saveLocationToServer() wrote coordinates read out
     * of that cache. All four treated a copy held in the page as something the
     * server should be told about. The cache is filled from the server now and
     * is never a source for a write.
     */

    // =========================================================================
    // STORAGE
    // =========================================================================

    var _configs = {};  // { siteId: { turf, location, savedAt } }

    /**
     * GH-473 — the site rows from GET /api/sites, whole, by id.
     *
     * `sites.name`, `location_name`, `latitude`, `longitude` and `timezone`
     * are the OWNER of those facts: all three write paths reach the column
     * (site creation, PATCH /api/sites/{id}, and the mirror out of a config
     * patch), while the copy in `config.location` is reached by one of them. A
     * site created through `store()` has the column filled and the config
     * empty by construction — which is the state Russley was found in, and why
     * reading the copy puts the export one write path behind.
     *
     * Held the same way as the configs: filled by the same pull, replaced
     * whole, never written back.
     */
    var _siteRows = {};  // { siteId: <sitePayload() row> }
    var _previousSiteId = null;

    /**
     * GH-441 (GH-439 stage 2): loadFromStorage() is gone.
     *
     * The cache is what the server said, and nothing else fills it: the
     * injected config for the active site, then GET /api/sites for the rest.
     * Reading localStorage back into it is what let a copy from an earlier
     * session -- of a site the page was not even looking at -- become the
     * configuration this page then pushed back.
     *
     * _cleanupLocationBleed() and the two one-time migrations that lived here
     * went with it: each existed to repair damage the snapshots did to this
     * cache, and each edited the cache in place. With the cache coming from
     * the database there is nothing here to repair, and an edit would only
     * put this page's opinion back on top of the server's answer.
     *
     * GH-442 (stage 3): the mirror that stood here went too -- see
     * forgetStoredConfigs() below.
     */

    /**
     * GH-442 (GH-439 stage 3): the browser copy is gone.
     *
     * saveToStorage() wrote every site's config into
     * `gilba_hub_site_configs` on each change. Stage 2 stopped anything
     * reading it back into the cache, which left it as a mirror for a handful
     * of pages that read it directly; those pages read the in-memory cache or
     * the server-rendered config now, so the key has no readers and no
     * writers. It is deleted once, here, so a browser that still holds one
     * stops carrying a stale copy of someone's configuration around.
     *
     * The cache lives in `_configs` for the life of the page and nowhere else.
     */
    function forgetStoredConfigs() {
        var keys = [STORAGE_KEY];
        try {
            // The namespaced variant gilba-storage-migrate.js used to create.
            var ns = global.GilbaStorageNS && typeof global.GilbaStorageNS.prefix === 'function'
                ? global.GilbaStorageNS.prefix() : '';
            if (ns) keys.push(ns + STORAGE_KEY);
        } catch (e) { /* namespace helper absent */ }

        keys.forEach(function(key) {
            try { localStorage.removeItem(key); } catch (e) { /* private window */ }
            try { if (_ls && _ls !== localStorage) _ls.removeItem(key); } catch (e) { /* ditto */ }
        });
    }

    // Pull: called once on init. There is no push and no local copy.
    // =========================================================================

    var _serverSyncPending = false;
    var _serverSyncTimer = null;
    // b35fix179a: companion species value to apply once #gaip-companion-species
    // exists. Set by restoreConfig() when the element is absent at restore time
    // (element is injected by daily-dashboard after orchestrator-complete, which
    // fires after the 300ms site-switch restore window).
    var _pendingCompanionRestore = null;

    /**
     * GH-440 (GH-439 stage 1): the sections the server merges field by field.
     * A null inside one of these is a field being emptied, which travels as
     * `clear`; a null anywhere else is the whole key being emptied.
     */
    var PATCHABLE_SECTIONS = ['turf', 'location', 'pgr', 'traffic', 'irrigation', 'weatherOverride', 'wizard'];

    /**
     * GH-440: split a caller's patch into what PATCH accepts.
     *
     * The route refuses null outright -- a client sending its own empty state
     * is indistinguishable from a person clearing a field, which is how a
     * page's load-time defaults once became a site's configuration -- so
     * emptying something is said explicitly through `clear`. Forms reach here
     * carrying nulls for unset numbers (irrigation.efficiency, every
     * weatherOverride field, location.elevation), and those are exactly the
     * "no value" cases `clear` is for.
     */
    /**
     * GH-440: the fields the server refuses to empty. A caller offering one of
     * them as blank is offering a control that had nothing in it, so it is
     * left out of the request and keeps what the database holds.
     */
    var IDENTITY_FIELDS = ['turf.species', 'turf.methodology', 'turf.turfType', 'location.lat', 'location.lon'];

    function splitPatchAndClear(patch) {
        var outPatch = {};
        var clear = [];

        function isEmpty(value) {
            return value === null || value === undefined
                || (typeof value === 'string' && value.trim() === '');
        }

        Object.keys(patch).forEach(function(key) {
            var value = patch[key];

            if (value === null || value === undefined) {
                clear.push(key);
                return;
            }

            if (PATCHABLE_SECTIONS.indexOf(key) !== -1 && value && typeof value === 'object' && !Array.isArray(value)) {
                var section = {};
                Object.keys(value).forEach(function(field) {
                    var fieldValue = value[field];
                    if (!isEmpty(fieldValue)) {
                        section[field] = fieldValue;
                        return;
                    }
                    if (IDENTITY_FIELDS.indexOf(key + '.' + field) !== -1) return;
                    clear.push(key + '.' + field);
                });
                if (Object.keys(section).length) outPatch[key] = section;
                return;
            }

            // Everything else -- scalars, arrays, and the three programme
            // objects -- is replaced whole, nulls inside it included.
            outPatch[key] = value;
        });

        return { patch: outPatch, clear: clear };
    }

    /**
     * GH-440: send a change to the server and take the result back from its
     * answer.
     *
     * This is the only way this file writes a config now. What goes up is the
     * patch the caller passed and nothing else -- never `_configs[siteId]`,
     * which is a copy this page holds and which has been wrong often enough
     * to be the subject of GH-439. What comes back replaces the copy, so the
     * page shows what the database has rather than what it hoped it wrote.
     *
     * The iframe rule from pushConfigsToServer() is kept: the hidden /hub
     * runner recomputes an analysis for a site the parent page owns, and a
     * write from in there is never a person changing something.
     */
    function patchConfigOnServer(siteId, patch, clear) {
        if (window !== window.top) return Promise.resolve(false);

        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') return Promise.resolve(false);
        if (!siteId || siteId === 'default') return Promise.resolve(false);

        var body = {};
        if (patch && Object.keys(patch).length) body.patch = patch;
        if (clear && clear.length) body.clear = clear;
        if (!body.patch && !body.clear) return Promise.resolve(false);

        return apiFetchJson(base.replace(/\/?$/, '/') + 'sites/' + encodeURIComponent(siteId) + '/config/gaip', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
            .then(function(response) {
                var saved = response && response.data && response.data.config;
                if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
                    _configs[siteId] = saved;
                }
                log('Config patched for', siteId, 'keys:', Object.keys(body.patch || {}).join(', '),
                    'cleared:', (body.clear || []).join(', '));
                return true;
            })
            .catch(function(err) {
                warn('Config patch failed:', err.message);
                return false;
            });
    }

    /**
     * GH-441 (GH-439 stage 2): pushConfigsToServer() is gone.
     *
     * It sent every site's cached config to the server, wholesale, whenever
     * anything touched the cache -- including on a plain page load, before
     * the server's own answer had arrived. Measured on the dev stack: one
     * load of /reports/forensic fired fourteen of them, and the body for the
     * active site carried the species and methodology of a DIFFERENT site,
     * because the cache entry had been keyed from the page's own DOM. Writes
     * go through patchConfigOnServer() above, one change at a time.
     */

    /**
     * Pull site configs from server and merge into localStorage.
     * Server wins for turf identity fields (species, turfType, variety, subCategory).
     * Called once on init when localStorage has no configs or is missing a site.
     * @param {function} onComplete  called when done
     */
    function pullConfigsFromServer(onComplete) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') {
            if (onComplete) onComplete(false, 'unavailable');
            return;
        }

        apiFetchJson(base.replace(/\/?$/, '/') + 'sites')
            .then(function(data) {
                var rows = (data && data.data) || [];

                var serverConfigs = {};
                var serverRows = {};
                rows.forEach(function(site) {
                    var config = site && site.configs && site.configs.gaip && site.configs.gaip.config;
                    if (site && site.id && config && typeof config === 'object' && !Array.isArray(config)) {
                        serverConfigs[site.id] = config;
                    }
                    // GH-473: the site ROW is kept too, whole, exactly as the
                    // server sent it. It is the owner of the facts about the
                    // site itself — name, place, coordinates, time zone — and
                    // the resolver reads it rather than the copy in
                    // config.location. See getSite() below.
                    if (site && site.id) {
                        serverRows[site.id] = site;
                    }
                });

                // GH-441 (GH-439 stage 2): replace, do not merge.
                //
                // What stood here was a per-field negotiation between this
                // page's cache and the database -- identity fields taken from
                // the server only when its savedAt looked newer, programme
                // keys always taken, everything else left as the browser had
                // it. Every one of those rules existed because the cache was
                // also a source of writes and could therefore be "ahead" of
                // the server. It cannot be any more: the only writes are
                // single-change PATCHes, and each one takes its answer back
                // from the response. So the database is simply right, whole,
                // and a site the database does not mention is a site this
                // browser has no business holding a config for.
                _configs = serverConfigs;
                _siteRows = serverRows;
                log('Site configs loaded from server for', Object.keys(_configs).length, 'sites');
                if (onComplete) onComplete(true, 'loaded');
            })
            .catch(function(err) {
                warn('Could not load site configs from the server:', err && err.message);
                if (onComplete) onComplete(false, 'failed');
            });
    }

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

    /**
     * GH-441 (GH-439 stage 2): snapshotConfig() is gone.
     *
     * It read the legacy form and returned it as a site's configuration. Every
     * caller it had -- the page-load finalise, the first-visit capture, the
     * site-switch save, four event listeners and the /hub Save button -- has
     * been removed in this stage, because each of them turned whatever the form
     * happened to hold into what the database held. The form belongs to
     * whichever site was rendered into it last, which is how one site's species
     * and methodology reached another site's row.
     *
     * Nothing reads the DOM for a value to store any more. The config is what
     * the server sent, and changes travel as patches from the pages where a
     * person actually edits them.
     */

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

    /**
     * GH-498: the one place that says "this site's configuration is now on the
     * page", and it says it AT THE MOMENT THAT BECOMES TRUE.
     *
     * What stood here were two timers wearing the event's name. One fired 150
     * ms after a site switch, the other 1200 ms after a restore, and neither
     * knew anything about the page: a timer reports that time has passed, not
     * that a fact has happened. The comment beside the 150 ms one said in as
     * many words that without it "site-switch always produces the wrong GP on
     * first run" — it was a second guess at a duration, and the export's own
     * 300 ms wait guessed a third. Measured: the first report of every export
     * printed a growth potential of 0% while its own Monthly Schedule in the
     * same report said 13%.
     *
     * The event now carries the FACT — which site, and whether a stored
     * configuration was actually restored — so a consumer can check what it
     * was waiting for instead of trusting that the name of the event means
     * what it says.
     */
    function announceConfigApplied(siteId, restored, source) {
        global.GAIP_SITE_CONFIG_PENDING = false;
        global.GAIP_SITE_CONFIG_FAILED = false;
        var detail = { siteId: siteId, restored: !!restored };
        if (source) detail.source = source;
        log('Config applied for', siteId, '— restored:', !!restored,
            source ? '(' + source + ')' : '');
        document.dispatchEvent(new CustomEvent('gaip:site-config-applied', { detail: detail }));
    }

    function restoreConfig(config, siteId, source) {
        if (!config) return;
        _isRestoring = true;

        var turf = config.turf || {};
        var location = config.location || {};
        var tp = global.GaipTurfProfile;

        console.log('[SiteConfig] persist-debug: restoreConfig() keys=', Object.keys(config),
            'hasNutritionProgram=', !!config.nutritionProgram,
            'hasNutritionCalendarProgram=', !!config.nutritionCalendarProgram);

        // GH-371 (D01): both fields come from this same restored `config`
        // blob — no race between two separate reads, unlike the live-page
        // checks elsewhere. nutritionProgramCoords is the stamp
        // mergeConfig() wrote from computeProgram()'s own meta.lat/lon at
        // the moment the cached programmes were last generated (see that
        // function's comment); location is this SAME config's current
        // coordinates. A real mismatch here means the site's coordinates
        // were changed after this config was saved (client-side write that
        // predates this fix, or a server-side edit that didn't go through
        // the client's own carry-forward check) — restoring the cached
        // programmes onto a mismatched location is exactly the D01 bug.
        // Absent nutritionProgramCoords (data saved before this fix
        // deployed) is treated as "unknown, trust it" — this is a forward-
        // looking guard for newly-generated programmes, not a retroactive
        // validation of every already-cached blob.
        var _coordsMismatch = false;
        if (config.nutritionProgramCoords &&
            typeof config.nutritionProgramCoords.lat === 'number' &&
            typeof config.nutritionProgramCoords.lon === 'number' &&
            typeof location.lat === 'number' && typeof location.lon === 'number') {
            var _restoreLatDrift = Math.abs(config.nutritionProgramCoords.lat - location.lat);
            var _restoreLonDrift = Math.abs(config.nutritionProgramCoords.lon - location.lon);
            if (_restoreLatDrift > 0.01 || _restoreLonDrift > 0.01) {
                _coordsMismatch = true;
                console.warn('[SiteConfig] GH-371 (D01): cached nutrition programmes were computed for (' +
                    config.nutritionProgramCoords.lat + ',' + config.nutritionProgramCoords.lon +
                    ') but this site\'s saved coordinates are now (' + location.lat + ',' + location.lon +
                    ') — not restoring the stale programmes. Plan page will show "please regenerate".');
            }
        }

        // GH-377: the same same-blob comparison for the programme's own
        // computation inputs. `turf` above is this SAME config's current
        // species/methodology; config.nutritionCalendarProgram.meta records
        // what the cached programmes were computed against (species = the
        // nutrient-engine key, methodology = upper-cased). A real mismatch
        // means the site's turf was changed after the programmes were
        // generated without going through a regenerate — concretely, any
        // config/gaip PUT that carries a new `turf` but no fresh stamp
        // (Settings' turf form, the import-bundle flow in settings-init.js's
        // applySiteConfig()), which the server-side resolveGaipConfigWrite()
        // deliberately answers by carrying the existing DB programme forward
        // (GH-371 follow-up) — so the cached copy arrives here alongside the
        // new turf, and this is the point that must refuse it. Comparison
        // rules, tolerances and the forward-looking "absent means trust"
        // policy all live in nutrition-calendar.js (programInputsDrift and
        // the GH-377 block above it) — shared with restoreFromPersisted()
        // and word-export.js, not re-implemented here. When that module is
        // not on this page the check is simply unavailable and the cached
        // programme is restored as before (unknown, trust it).
        var _inputsMismatch = false;
        var _NC377 = global.GilbaNutritionCalendar;
        if (!_coordsMismatch && config.nutritionCalendarProgram && config.nutritionCalendarProgram.meta &&
            _NC377 && typeof _NC377.programInputsDrift === 'function' &&
            typeof _NC377.collectProgramInputCandidates === 'function') {
            try {
                // GH-521: the coordinates are no longer passed. They were here to
                // feed collectProgramInputCandidates' NZ fold, which is gone: the
                // methodology a cached programme is compared against is now the
                // one the site has saved, whatever region it sits in.
                var _restoreDrift = _NC377.programInputsDrift(
                    config.nutritionCalendarProgram.meta,
                    _NC377.collectProgramInputCandidates({ turfs: turf })
                );
                if (_restoreDrift.length) {
                    _inputsMismatch = true;
                    console.warn('[SiteConfig] GH-377: cached nutrition programmes were computed for ' +
                        _restoreDrift.map(function (d) { return d.field + '=' + d.was; }).join(', ') +
                        ' but this site\'s saved config now says ' +
                        _restoreDrift.map(function (d) { return d.field + '=' + d.now; }).join(', ') +
                        ' — not restoring the stale programmes. Plan page will show "please regenerate".');
                }
            } catch (_gh377Err) {
                console.warn('[SiteConfig] GH-377: input staleness check failed, restoring as-is:', _gh377Err && _gh377Err.message);
            }
        }

        // Restore the last-generated Nutrition Program (if any) so Reports > Export —
        // a fresh page load with no in-memory GAIP_NUTRITION_PROGRAM of its own — can
        // still find and print it. Written by GAIP_SiteConfig.mergeConfig() from
        // nutrition-*-integration.js when the user clicks "Generate Nutrition Program".
        if (config.nutritionProgram && !_coordsMismatch && !_inputsMismatch) {
            global.GAIP_NUTRITION_PROGRAM = config.nutritionProgram;
        }
        // Base N/P/K/Ca/Mg/S calendar (nutrition-calendar.js computeProgram() output) —
        // different shape/consumer than nutritionProgram above. Picked up by
        // NutritionCalendar.restoreFromPersisted() to redisplay the Plan > Nutrition
        // results panel after reload without requiring the user to regenerate.
        if (config.nutritionCalendarProgram && !_coordsMismatch && !_inputsMismatch) {
            global.GAIP_NUTRITION_CALENDAR_PROGRAM = config.nutritionCalendarProgram;
            console.log('[SiteConfig] persist-debug: set GAIP_NUTRITION_CALENDAR_PROGRAM');
        }

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
                            var _wasSiteSwitch = _isSiteSwitch;  // b35fix504: capture BEFORE clearing
                            _isRestoring = false;
                            _isSiteSwitch = false;
                            // b35fix504: use tp.state.species (post-location-update) not turf.species
                            // (stored value).  Location preloader fires ~150ms into cascade and calls
                            // selectSpecies() which updates tp.state.  By 500ms the final species is set.
                            var finalSpecies = (tp && tp.state && tp.state.species) || turf.species || null;
                            log('Restore cascade complete for', skipTurfIdentity ? tp.state.turfType : turf.turfType, finalSpecies);

                            // b35fix504: write auto-profile for the CURRENT active site and point _last at it.
                            // Uses SM.getActiveSiteId() at cascade-end time — always the correct final site,
                            // regardless of whether we arrived here from a site-switch or a page-load cascade.
                            //
                            // Previous approaches failed because they relied on _restoringSiteId (a module
                            // variable set in restoreNewSiteConfig), which was silently skipped when
                            // gaip:site-changed fired AFTER the 800ms page-load timer had already set
                            // _previousSiteId = Russley — causing the duplicate-event guard (line 1225)
                            // to skip restoreNewSiteConfig entirely, leaving _restoringSiteId null.
                            //
                            // SM.getActiveSiteId() always reflects the live active site; no guard needed.
                            if (finalSpecies) {
                                try {
                                    var _sm504 = global.GAIP_SampleManager;
                                    var _sid504 = _sm504 && typeof _sm504.getActiveSiteId === 'function'
                                        ? _sm504.getActiveSiteId() : null;
                                    if (_sid504) {
                                        var _tp504 = global.GaipTurfProfile;
                                        var _lk504 = (_tp504 && _tp504.STORAGE_KEY ? _tp504.STORAGE_KEY : 'gilba_turf_profiles') + '_last';
                                        var _pk504 = _tp504 && _tp504.STORAGE_KEY ? _tp504.STORAGE_KEY : 'gilba_turf_profiles';
                                        var _key504 = '__site__' + _sid504;
                                        var _profs504 = JSON.parse(_ls.getItem(_pk504) || '{}');
                                        _profs504[_key504] = {
                                            turfType:    (tp && tp.state && tp.state.turfType)    || turf.turfType    || null,
                                            subCategory: (tp && tp.state && tp.state.subCategory) || turf.subCategory || null,
                                            species:     finalSpecies,
                                            variety:     (tp && tp.state && tp.state.variety)     || turf.variety     || null,
                                            construction: turf.construction || null,
                                            _siteId:     _sid504,
                                            _auto:       true,
                                            _savedAt:    new Date().toISOString()
                                        };
                                        _ls.setItem(_pk504, JSON.stringify(_profs504));
                                        // b35fix504b: for site-switch cascades use the explicit target
                                        // site (from gaip:site-changed), not SM which may lag.
                                        // For page-load cascades: skip _last if a site switch already
                                        // happened — restoreNewSiteConfig wrote it immediately.
                                        if (_wasSiteSwitch) {
                                            var _lastSite504 = _lastSwitchedToSiteId || _sid504;
                                            _ls.setItem(_lk504, '__site__' + _lastSite504);
                                            log('b35fix504: _last → "__site__' + _lastSite504 + '" species=' + finalSpecies + ' [switch]');
                                        } else if (!_lastSwitchedToSiteId) {
                                            _ls.setItem(_lk504, _key504);
                                            log('b35fix504: _last → "' + _key504 + '" species=' + finalSpecies + ' [page-load]');
                                        }

                                        // Also update _configs[siteId].turf.species so next cascade
                                        // uses the correct (location-resolved) species, not a stale
                                        // stored value.  Without this, the cascade calls
                                        // selectSpecies(storedStaleSpecies) before the location
                                        // preloader corrects it, causing intermediate wrong dispatches
                                        // and the auto-run to fire with the wrong species.
                                        if (_configs[_sid504] && _configs[_sid504].turf) {
                                            var _prevSpecies = _configs[_sid504].turf.species;
                                            if (_prevSpecies !== finalSpecies) {
                                                _configs[_sid504].turf.species = finalSpecies;
                                                if ((tp && tp.state && tp.state.variety) && tp.state.variety !== 'generic') {
                                                    _configs[_sid504].turf.variety = tp.state.variety;
                                                }
                                                log('b35fix504: corrected _configs[' + _sid504 + '].turf.species ' + _prevSpecies + ' → ' + finalSpecies);
                                            }
                                        }
                                    }
                                } catch (_e504) { /* non-fatal */ }
                            }

                            // Sync corrected species/turfType back into the last-loaded saved profile.
                            // ONLY on page-load restore (_wasSiteSwitch=false): the last profile belongs
                            // to the current site so syncing species is safe.
                            // On site-switch (_wasSiteSwitch=true): lastProfileName is the PREVIOUS site's
                            // profile — do NOT write new-site species into it (would corrupt it).
                            // b35fix504: fixed guard — was using _isSiteSwitch after it was already cleared.
                            if (!_wasSiteSwitch) {
                                try {
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
                                } catch (e) { /* non-fatal */ }
                            }

                            // GH-498: the announcement, at the end of the write
                            // and not before it.
                            //
                            // The analyst's design said "synchronously, from
                            // the end of restoreConfig". Measured against this
                            // file, that end is not where the write finishes:
                            // the turf identity — subCategory, species,
                            // variety, overseed — is written by the nested
                            // cascade above, 100+200+200+50+500 = 1050 ms after
                            // the synchronous body has returned. Announcing at
                            // the synchronous end would say "applied" while the
                            // species field was still the previous site's, which
                            // is the defect this ticket is about, moved rather
                            // than removed. So the announcement stands at the
                            // end of the LAST write of the cascade. It is still
                            // the writer speaking at the moment of the fact; the
                            // writer simply finishes inside its own callback.
                            //
                            // That also explains the 1200 ms someone once chose:
                            // it was a guess that had to cover 1050.
                            announceConfigApplied(siteId, true, source);
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
        // GH-482: `turf.aaTexture` is not written by anything — no file in
        // assets or on the server sets it — so this line only ever wrote ''
        // into the field, clearing it on every restore. The key itself is not
        // a fact either: it is a copy of the sands|others bucket, which is
        // derived on read from the site's soil texture
        // (nutrition-program-inputs.js `aaTextureKey`). The export stopped
        // reading that field in GH-480, and the setting it stood for is read
        // from the column that owns it (GH-482), so the copy has no reader
        // left to keep in step.

        // Traffic
        if (turf.trafficEnabled !== undefined) setChecked('.gaip-enable-turf-traffic', turf.trafficEnabled);
        setDomVal('.gaip-traffic-level', turf.trafficLevel || '');
        setDomVal('.gaip-events-per-week', turf.eventsPerWeek || '');

        // Clegg hammer — saved by the Settings > Traffic & Wear form.
        // GH-394: that form now persists the whole schedule server-side as
        // config.traffic.schedule, so prefer it and fall back to the
        // same-device localStorage mirror; on a second browser the mirror is
        // empty and the Clegg readings used to vanish with it.
        try {
            var _cleggSid = (global.GAIP_HUB_CONFIG || {}).activeSiteId || 'default';
            var _tst = (config.traffic && config.traffic.schedule) ||
                JSON.parse(localStorage.getItem('gilba_traffic_state_' + _cleggSid) || '{}');
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
        //
        // b35fix506: before treating location as absent, fall back to the DB
        // (sites.latitude/longitude, exposed as GAIP_HUB_CONFIG.savedLocation —
        // the same source already used to render .gaip-lat/.gaip-lon on first
        // paint), but ONLY when restoring the page's own server-rendered site.
        // config.location comes from the separate gaip-namespace JSON config,
        // which can lag behind sites.latitude/longitude for a site whose local
        // cache was just seeded from the server (new/rarely-visited sites) —
        // clearing on that empty lag was wiping correct coordinates that were
        // already sitting in the DOM. For a different (switched-to) site,
        // savedLocation isn't relevant, so the clear-on-absent guard still applies.
        var dbLocation = (siteId && global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId === siteId)
            ? (global.GAIP_HUB_CONFIG.savedLocation || {})
            : null;
        var effectiveLat = location.lat || (dbLocation && dbLocation.lat);
        var effectiveLon = location.lon || (dbLocation && dbLocation.lon);
        if (effectiveLat) {
            setDomVal('.gaip-lat', effectiveLat);
        } else {
            // No saved location — clear to prevent bleed from previous site
            setDomVal('.gaip-lat', '');
        }
        if (effectiveLon) {
            setDomVal('.gaip-lon', effectiveLon);
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
        if (effectiveLat && effectiveLon) {
            document.dispatchEvent(new CustomEvent('gaip:location-restored', {
                detail: { lat: effectiveLat, lon: effectiveLon, name: location.name || '' }
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
        // GH-441 (GH-439 stage 2): switching away from a site saves nothing.
        //
        // It used to snapshot the legacy form for the site being left and
        // write that as its configuration -- on a switch, when the form is
        // mid-cascade between two sites, which is exactly when the snapshot is
        // least trustworthy. Both sites' configurations are already in the
        // cache, exactly as the database has them, so there is nothing to
        // capture and nothing that could be captured correctly.
    }

    function restoreNewSiteConfig(newSiteId) {
        _isSiteSwitch = true;

        // b35fix504b: write _last immediately on site switch.
        // Cascade end is ~1350ms away and SM timing can cause it to write the wrong
        // site (e.g. page-load cascade still running Burns GC fires after Russley
        // cascade end, overwriting _last).  We KNOW the target site here — write now.
        // Cascade end still updates the auto-profile species (post-location-update).
        try {
            var _tp_sw = global.GaipTurfProfile;
            var _pk_sw = _tp_sw && _tp_sw.STORAGE_KEY ? _tp_sw.STORAGE_KEY : 'gilba_turf_profiles';
            var _lk_sw = _pk_sw + '_last';
            var _key_sw = '__site__' + newSiteId;
            _ls.setItem(_lk_sw, _key_sw);
            // Create stub auto-profile if absent so TPC can load it on next page init
            var _profs_sw = JSON.parse(_ls.getItem(_pk_sw) || '{}');
            if (!_profs_sw[_key_sw]) {
                var _cfg_sw = _configs[newSiteId];
                var _turf_sw = _cfg_sw && _cfg_sw.turf ? _cfg_sw.turf : {};
                _profs_sw[_key_sw] = {
                    turfType:    _turf_sw.turfType    || null,
                    subCategory: _turf_sw.subCategory || null,
                    species:     _turf_sw.species     || null,
                    variety:     _turf_sw.variety     || null,
                    _siteId:     newSiteId,
                    _auto:       true,
                    _savedAt:    new Date().toISOString()
                };
                _ls.setItem(_pk_sw, JSON.stringify(_profs_sw));
            }
            log('b35fix504b: immediate _last → "' + _key_sw + '"');
        } catch (_e_sw) { /* non-fatal */ }

        var config = _configs[newSiteId];
        if (config) {
            restoreConfig(config, newSiteId, 'site-switch');
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
            // GH-498: nothing was restored, and that is also a fact about this
            // site — said here, where it becomes true, with `restored: false`
            // so a consumer waiting for a restore knows this was not one.
            //
            // The 150 ms timer that stood here is gone. Its own comment said
            // that without it "site-switch always produces the wrong GP on
            // first run (42% vs correct value)", which was true of the symptom
            // and wrong about the cause: a dispatch 150 ms after the switch
            // announces that 150 ms have passed, not that the configuration is
            // on the page. When a config IS restored the announcement now comes
            // out of the end of restoreConfig() itself.
            announceConfigApplied(newSiteId, false, 'site-switch');
        }
    }

    // =========================================================================
    // INIT
    // =========================================================================

    var _initRetries = 0;
    var _isRestoring = false;
    var _isSiteSwitch = false;  // True during site-switch restores — prevents profile name sync
    var _bootCooldown = true;  // Prevent auto-save during page initialization
    var _lastSwitchedToSiteId = null;  // b35fix504b: set on gaip:site-changed; cascade end uses this

    function init() {
        // GH-442 (GH-439 stage 3): drop any copy this browser still holds from
        // before the cache became memory-only.
        forgetStoredConfigs();

        // GH-441 (GH-439 stage 2): the cache starts from the server-rendered
        // config for the active site, then the rest of the sites arrive from
        // GET /api/sites. Nothing is read out of localStorage into it.
        (function seedFromInjectedConfig() {
            var hubCfg = global.GAIP_HUB_CONFIG || {};
            var injected = hubCfg.gaipConfig || hubCfg.siteConfig;
            var siteId = hubCfg.activeSiteId;
            if (!injected || typeof injected !== 'object' || Array.isArray(injected) || !siteId) return;

            // Every key, always -- including `wizard`, which the old seed
            // skipped, and which is the section whose absence reopened the
            // setup wizard on a site that had completed it. There is nothing
            // to merge with: whatever this page holds came from the server
            // too, and this value is newer.
            _configs[siteId] = JSON.parse(JSON.stringify(injected));
            log('Seeded site config for', siteId, 'from the server-rendered config');
        })();

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

        // Record the currently active site
        _previousSiteId = SM.getActiveSiteId();

        // GH-441 (GH-439 stage 2): restore when the server has answered, not
        // when a timer says it probably has.
        //
        // This used to wait 800 ms (or 3000 ms when the cache looked empty),
        // restore whatever was in the cache by then, and 1600 ms later
        // snapshot the DOM back into the cache as the site's configuration.
        // The timers were the reason a slow page pushed its own form defaults
        // to the server, and the snapshot at the end was what it pushed. The
        // page now waits for GET /api/sites and restores from what it returns.
        //
        // When that request fails there is nothing legitimate to restore: the
        // DOM at this moment holds the form's defaults, and computing on those
        // produces a number that looks exactly like a real one. The page says
        // so instead -- `gaip:site-config-failed` -- and the analysis is not
        // started, which is the same rule the Plan page's pre-Generate re-read
        // follows.
        pullConfigsFromServer(function(loaded, outcome) {
            var currentId = SM.getActiveSiteId();
            _previousSiteId = currentId;
            _bootCooldown = false;

            if (outcome === 'failed') {
                global.GAIP_SITE_CONFIG_PENDING = false;
                global.GAIP_SITE_CONFIG_FAILED = true;
                warn('Site settings could not be loaded — analysis not started for', currentId);
                document.dispatchEvent(new CustomEvent('gaip:site-config-failed', {
                    detail: { siteId: currentId, reason: 'sites-fetch' }
                }));
                return;
            }

            var config = _configs[currentId];
            if (config) {
                log('Restoring config for', currentId, 'from the server response');
                restoreConfig(config, currentId);
            } else {
                // A site the database has no gaip config for -- a brand-new
                // one. There is nothing to restore and nothing to invent; the
                // page runs on what the form itself holds, as it did before
                // this site had any settings.
                log('No stored config for', currentId, '— nothing to restore');
            }

            // GH-498: the 1200 ms timer is gone. Where there was a config,
            // restoreConfig() has already announced — synchronously, at the end
            // of its own cascade of DOM writes, which is the moment the fact
            // became true. Where there was none, the fact is that nothing was
            // restored, and it is announced here.
            if (!config) {
                announceConfigApplied(currentId, false);
            }
        });

        // Listen for site changes — fires AFTER the switch is complete
        document.addEventListener('gaip:site-changed', function(e) {
            var newSiteId = e.detail ? e.detail.siteId : null;
            if (!newSiteId) return;

            // Skip if it's the same site (e.g. restore-triggered duplicate events)
            if (newSiteId === _previousSiteId) return;

            log('Site switch detected:', _previousSiteId, '->', newSiteId);

            // b35fix504b: record last explicit switch so cascade end knows the target site
            _lastSwitchedToSiteId = newSiteId;

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
                log('Deleted config for removed site:', siteId);
            }
        });

        // GH-441 (GH-439 stage 2): four listeners are gone --
        // gaip:turf-profile-change, gaip:site-save-requested,
        // gaip:config-save-requested and gaip:analysis-complete. Each took a
        // snapshot of the legacy form and made it the site's configuration.
        //
        // That is where the cross-site damage came from: the form belongs to
        // whichever site was last rendered into it, so a snapshot taken while
        // another site's profile cascade was still finishing wrote that site's
        // species and methodology under this site's id. Nothing here reads the
        // DOM for a value to save any more. Editing the legacy form on /hub
        // therefore no longer saves anything -- decision 1, taken 16.09.2026:
        // those fields are edited in Settings.

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
        restore: restoreConfig,
        isRestoring: function() { return _isRestoring; },
        getConfig: function(siteId) { return _configs[siteId] || null; },
        // GH-473: the site row, by id — the owner of the facts about the site
        // itself. Answers null for a site this browser was not told about,
        // never another site's row.
        getSite: function(siteId) { return (siteId && _siteRows[siteId]) || null; },
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

            // GH-371 (D01): the nutritionProgramCoords stamp (coordinates the
            // cached nutritionCalendarProgram/nutritionProgram were actually
            // computed against) is computed once, upstream, in
            // NutritionCalendar.persistSiteConfigPatch() — the one place
            // genuinely common to every caller of THIS function (both the
            // hub-page path that reaches here and Plan's own direct-PUT
            // fallback that never loads this file at all — see that
            // function's own comment for why stamping only here would have
            // missed Plan entirely). By the time a patch arrives here it
            // already carries nutritionProgramCoords as a plain key when
            // relevant, so the generic per-key merge loop above handles it
            // with no special-casing needed. Read by snapshotConfig()'s
            // carry-forward step and restoreConfig() below, and by
            // word-export.js's stale-cache check.

            // GH-440 (GH-439 stage 1): the merged copy above is what this
            // page renders from until the server answers; what is SENT is the
            // caller's patch alone. The server does its own merge and returns
            // the result, and patchConfigOnServer() replaces this copy with
            // that -- so a stale field this page happened to hold cannot ride
            // along into the database.
            next.savedAt = new Date().toISOString();
            _configs[siteId] = next;

            var split = splitPatchAndClear(patch);
            patchConfigOnServer(siteId, split.patch, split.clear);
            log('Merged config for', siteId, 'keys:', Object.keys(patch).join(', '));
            return true;
        },
        removeConfig: function(siteId) {
            if (!siteId || !_configs[siteId]) return false;
            delete _configs[siteId];
            log('Removed config for', siteId);
            return true;
        },
        // Direct companion species write — bypasses timing guards intentionally.
        // Called by the Save button in daily-dashboard.js companion selector.
        setCompanionSpecies: function(siteId, value) {
            if (!siteId) return;
            if (!_configs[siteId]) _configs[siteId] = { turf: {}, location: {} };
            if (!_configs[siteId].turf) _configs[siteId].turf = {};
            _configs[siteId].turf.companionSpecies = value;
            // GH-440: one field, sent as one field. An empty selection is the
            // field being emptied, which the route only accepts as `clear`.
            if (value === '' || value === null || value === undefined) {
                patchConfigOnServer(siteId, null, ['turf.companionSpecies']);
            } else {
                patchConfigOnServer(siteId, { turf: { companionSpecies: value } }, null);
            }
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
            patchConfigOnServer(siteId, { multiSiteTurf: !!enabled }, null);
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
