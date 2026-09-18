/**
 * =============================================================================
 * GILBA HUB SAMPLE PERSISTENCE v1.0.0
 * =============================================================================
 * 
 * Persistence layer for GAIP_SampleManager.
 * Listens for sample mutation events, sends ONE request per action, and
 * restores from the server on page load.
 *
 * GH-533 (PLAN-samples-sync-FINAL, stage 2) rewrote the write half of this
 * file. Before it, every mutation scheduled a 500 ms debounce, assembled a
 * snapshot of every sample of every site out of the browser's own store, and
 * sent the lot to POST /api/samples/sync. One added sample sent the whole
 * collection. This file no longer knows that route exists.
 *
 * STORAGE:
 *   localStorage is a read cache for fast boot, refreshed on unload and after
 *   a restore, and never a source for a write. It is removed in stage 3.
 *
 * ARCHITECTURE:
 *   sample-manager.js  ──dispatches events──>  sample-persistence.js
 *                                                    │
 *                        POST / PATCH / DELETE  /api/samples[/{id}]
 *                                                    │
 *                                                  MySQL
 *
 * EVENTS CONSUMED (mutation signals from sample-manager.js):
 *   - gaip:sample-added                 -> POST   /api/samples
 *   - gaip:samples-imported             -> POST   per named sample
 *   - gaip:sample-updated               -> PATCH  /api/samples/{serverId}
 *   - gaip:sample-renamed               -> PATCH
 *   - gaip:sample-turf-profile-changed  -> PATCH
 *   - gaip:sample-deleted               -> DELETE /api/samples/{serverId}
 *   - gaip:samples-cleared              -> DELETE per row
 *   - gaip:all-samples-cleared          -> DELETE per row
 *
 * DELIBERATELY NOT CONSUMED (each used to push the whole collection):
 *   - gaip:site-changed                 -- looking at a site is not editing it
 *   - gaip:site-added / -renamed / -removed  -- GH-441: the site registry
 *     travels one way, from GET /api/sites
 *
 * EVENTS PRODUCED:
 *   - gaip:samples-persistence-ready   (restore complete on page load)
 *   - gaip:samples-persistence-saved   ({op, sampleId, serverId})
 *   - gaip:samples-persistence-error   ({sampleId, op, status, error})
 *
 * DEPENDENCIES:
 *   - sample-manager.js (GAIP_SampleManager.getSample / getAllSamples /
 *     normalizeValues / restoreFromPersistence)
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

        // GH-533 (stage 2): the 500 ms debounce is gone with the snapshot it
        // batched. There is nothing left to collapse -- twenty imported
        // samples are twenty creates, not one push repeated twenty times.

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
                        var msg = (data && data.message)
                            || (data && data.data && data.data.message)
                            || (text && text.trim().slice(0, 160))
                            || ('HTTP ' + r.status);
                        var err = new Error(msg);
                        err.status = r.status;
                        err.responseText = text;
                        throw err;
                    }
                    return data || {};
                });
            });
    }

    // =========================================================================
    // GH-533 (stage 2) -- THE ENVELOPE
    //
    // A sample travels to the server as one `payload` object: the lab readings
    // plus five meta keys the server and the older sync path both understand.
    // One statement of what those keys are, used by the restore that unwraps
    // them and by every write that wraps them again -- two lists would drift
    // and the drift would look like data loss.
    // =========================================================================
    var PAYLOAD_META_KEYS = ['_label', '_zone', '_source', '_turfProfile', 'zone'];

    function stripPayloadMeta(payload) {
        var out = {};
        Object.keys(payload || {}).forEach(function (k) {
            if (PAYLOAD_META_KEYS.indexOf(k) === -1) out[k] = payload[k];
        });
        return out;
    }

    function buildPayload(sample) {
        var out = stripPayloadMeta(sample.rawData || sample.values || {});
        if (sample.label)       out._label = sample.label;
        if (sample.zoneType)    out._zone = sample.zoneType;
        if (sample.source)      out._source = sample.source;
        if (sample.turfProfile) out._turfProfile = sample.turfProfile;
        return out;
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
    // GH-533 (stage 2) -- PER-RECORD WRITES
    //
    // What stood here until this change: a 500 ms debounce, a snapshot of every
    // sample of every site assembled in the browser, and one
    // POST /api/samples/sync carrying the lot. One user action, one whole
    // collection sent. That is the shape the project rule in CLAUDE.md names:
    // "Send the change, not the state."
    //
    // What stands here now: one request per action, naming one record.
    //
    // Three things hold this together and none of them is optional.
    //
    //   The SITE comes from the event, not from the pointer. Every handler
    //   below is asynchronous, and the active-site pointer can move while a
    //   request is in flight. sample-manager.js reads the site at the moment of
    //   the action and puts it in `detail.siteId`. A handler that asked for
    //   itself would file a sample under whichever site the user switched to --
    //   GH-459, in the write direction.
    //
    //   The RECORD is resolved synchronously, before the first `then`. The
    //   live object -- the one whose `serverId` a POST has to write back -- is
    //   only reachable through the current site's store, so it is taken while
    //   the listener is still running and held across the request.
    //   `getAllSamples()` is no use for this: it returns a deep clone.
    //
    //   Operations on ONE record are a chain, operations on different records
    //   are independent. A PATCH has no address until its POST has answered.
    // =========================================================================

    /**
     * GH-533: writes are refused for a user who may not edit this site.
     *
     * Before per-record writes, a viewer added a sample in memory, the snapshot
     * push got a 403, and the failure went to `warn`. From this stage every
     * action is its own request, so the same viewer would generate a 403 per
     * keystroke-worth of work.
     *
     * An ABSENT flag is not `false`. It means the page did not say, which is
     * what every page did until db-shell.blade.php started saying it, and
     * treating silence as a refusal would stop writes on a page we simply have
     * not taught to answer. Only an explicit `false` refuses.
     */
    function canWriteSamples() {
        var cfg = global.GAIP_HUB_CONFIG || {};
        return cfg.canEditActiveSite !== false;
    }

    function samplesUrl(suffix) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined') return null;
        return base.replace(/\/?$/, '/') + 'samples' + (suffix || '');
    }

    function writeJson(url, method, body) {
        return apiFetchJson(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
    }

    // -------------------------------------------------------------------------
    // Per-record queues
    // -------------------------------------------------------------------------

    var _queues = {};

    function recordKey(siteId, dataType, sampleId) {
        return siteId + '|' + dataType + '|' + sampleId;
    }

    /**
     * GH-533: append a step to one record's chain.
     *
     * A failed step leaves the chain rejected, so the steps behind it do not
     * run. That is deliberate: if the POST that was to create a row failed,
     * the PATCH behind it has no row to address and no `serverId` to use, and
     * firing it anyway would produce a second, unrelated failure that reads
     * like a second defect. Retry is stage 3; until then the record carries
     * `_dirty` and the page has been told.
     */
    function enqueue(key, step) {
        var prev = _queues[key] || Promise.resolve();
        var next = prev.then(step);
        _queues[key] = next;
        next.catch(function () {});
        return next;
    }

    function markFailed(sample, sampleId, op, err) {
        if (sample) {
            sample._dirty = { op: op, error: err && err.message ? err.message : String(err) };
        }
        warn('Per-record ' + op + ' failed for ' + sampleId + ': ' + (err && err.message));
        document.dispatchEvent(new CustomEvent('gaip:samples-persistence-error', {
            detail: {
                sampleId: sampleId,
                op: op,
                status: (err && err.status) || null,
                error: err && err.message ? err.message : String(err)
            }
        }));
    }

    function announceWritten(op, sampleId, serverId) {
        document.dispatchEvent(new CustomEvent('gaip:samples-persistence-saved', {
            detail: { op: op, sampleId: sampleId, serverId: serverId || null }
        }));
    }

    // -------------------------------------------------------------------------
    // The three requests
    // -------------------------------------------------------------------------

    function writeCreate(siteId, dataType, sampleId, sample) {
        var url = samplesUrl();
        if (!url || !sample) return;

        enqueue(recordKey(siteId, dataType, sampleId), function () {
            return writeJson(url, 'POST', {
                site_id: siteId,
                sample_type: dataType,
                client_uid: sample.id || sampleId,
                sample_date: sample.date || null,
                lab_date: sample.date || null,
                notes: sample.notes || '',
                payload: buildPayload(sample)
            }).then(function (data) {
                var serverId = (data && data.data && data.data.id) || null;
                if (serverId) {
                    sample.serverId = serverId;
                    delete sample._dirty;
                }
                announceWritten('create', sampleId, serverId);
                log('Created ' + dataType + ' sample ' + sampleId + ' as ' + serverId);
            }).catch(function (err) {
                markFailed(sample, sampleId, 'create', err);
                throw err;
            });
        });
    }

    function writeUpdate(siteId, dataType, sampleId, sample) {
        if (!sample) return;

        enqueue(recordKey(siteId, dataType, sampleId), function () {
            // Read AFTER the chain reaches this step: a create queued in front
            // of this update is what puts `serverId` on the object, and it had
            // not answered yet when this handler ran.
            if (!sample.serverId) {
                warn('No serverId for ' + sampleId + ' — update not sent');
                return;
            }
            var url = samplesUrl('/' + sample.serverId);
            if (!url) return;

            // GH-533: `client_uid` is deliberately NOT sent. The route accepts
            // it and would overwrite the column (SampleController::update),
            // and the client_uid is the key a re-import matches on -- so a
            // rename, which is one of the actions arriving here, would quietly
            // move that key and orphan the sample from its own file. Renaming
            // changes `payload._label`, which is what the product displays.
            return writeJson(url, 'PATCH', {
                payload: buildPayload(sample),
                sample_date: sample.date || null,
                lab_date: sample.date || null,
                notes: sample.notes || ''
            }).then(function () {
                delete sample._dirty;
                announceWritten('update', sampleId, sample.serverId);
                log('Updated ' + dataType + ' sample ' + sampleId + ' (' + sample.serverId + ')');
            }).catch(function (err) {
                markFailed(sample, sampleId, 'update', err);
                throw err;
            });
        });
    }

    function writeDelete(siteId, dataType, sampleId, serverId) {
        if (!serverId) {
            // A record the server never received. Nothing to delete, and no
            // way to address it if there were.
            log('No serverId for deleted sample ' + sampleId + ' — nothing to send');
            return;
        }
        var url = samplesUrl('/' + serverId);
        if (!url) return;

        enqueue(recordKey(siteId, dataType, sampleId), function () {
            return writeJson(url, 'DELETE', { source: 'hub' }).then(function () {
                announceWritten('delete', sampleId, serverId);
                log('Deleted ' + dataType + ' sample ' + sampleId + ' (' + serverId + ')');
            }).catch(function (err) {
                markFailed(null, sampleId, 'delete', err);
                throw err;
            });
        });
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    function liveSample(dataType, sampleId) {
        var SM = global.GAIP_SampleManager;
        return (SM && typeof SM.getSample === 'function') ? SM.getSample(dataType, sampleId) : null;
    }

    function onSampleAdded(e) {
        var d = (e && e.detail) || {};
        if (!d.siteId || !d.dataType || !d.sampleId) return;
        writeCreate(d.siteId, d.dataType, d.sampleId, d.sample || liveSample(d.dataType, d.sampleId));
    }

    function onSamplesImported(e) {
        var d = (e && e.detail) || {};
        var ids = d.sampleIds || [];
        if (!d.siteId || !d.dataType || !ids.length) return;
        // Resolved here, synchronously, for the reason in the section header.
        ids.forEach(function (sampleId) {
            writeCreate(d.siteId, d.dataType, sampleId, liveSample(d.dataType, sampleId));
        });
    }

    function onSampleUpdated(e) {
        var d = (e && e.detail) || {};
        // GH-533: `reason` marks an event the PRODUCT raised about itself, not
        // an edit the user made. sample-manager.js's b35fix411 migration
        // re-normalises stale samples on load and announces each one this way;
        // without this line, opening a page would send a PATCH per migrated
        // sample, every time.
        if (d.reason) return;
        if (!d.siteId || !d.dataType || !d.sampleId) return;
        writeUpdate(d.siteId, d.dataType, d.sampleId, d.sample || liveSample(d.dataType, d.sampleId));
    }

    function onSampleDeleted(e) {
        var d = (e && e.detail) || {};
        if (!d.siteId || !d.dataType || !d.sampleId) return;
        writeDelete(d.siteId, d.dataType, d.sampleId, d.serverId);
    }

    function onSamplesCleared(e) {
        var d = (e && e.detail) || {};
        var ids = d.serverIds || [];
        if (!d.siteId || !d.dataType) return;
        ids.forEach(function (serverId, i) {
            writeDelete(d.siteId, d.dataType, 'cleared_' + i, serverId);
        });
    }

    function onAllSamplesCleared(e) {
        var d = (e && e.detail) || {};
        var ids = d.serverIds || [];
        if (!d.siteId) return;
        ids.forEach(function (serverId, i) {
            writeDelete(d.siteId, 'all', 'cleared_all_' + i, serverId);
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
                var restored = 0;

                // Build a per-site snapshot from server data. SM.addSample() always
                // writes to _currentSite, so calling it in a multi-site loop would
                // put every sample under 'default'. Instead, assemble the snapshot
                // structure directly and restore it all at once via restoreFromPersistence.
                var serverSnap = SM.getAllSamples();  // capture current site registry

                samples.forEach(function(sample) {
                    var siteId = sample.site_id;
                    if (!siteId || !sample.sample_type || !sample.payload) return;

                    // Ensure site exists in registry
                    if (!serverSnap.sites[siteId]) {
                        var siteLabel = (sample.summary && sample.summary.site_name) || siteId;
                        serverSnap.sites[siteId] = { label: siteLabel, createdAt: '' };
                    }

                    // Ensure per-site store and type bucket exist
                    if (!serverSnap.allSites[siteId]) serverSnap.allSites[siteId] = {};
                    if (!serverSnap.allSites[siteId][sample.sample_type]) {
                        serverSnap.allSites[siteId][sample.sample_type] = {};
                    }

                    var sampleId = sample.client_uid || (sample.payload && (sample.payload.label || sample.payload.sampleId)) || ('sample_' + sample.id);
                    var _existingSample263 = serverSnap.allSites[siteId][sample.sample_type][sampleId];
                    if (_existingSample263) {
                        // GH-263: samples synced into the client store before this fix
                        // landed are missing methodologySnapshot/soilTextureSnapshot --
                        // the "already present" early-return below meant they'd never
                        // pick the new fields up on a later sync, since a sample only
                        // gets built once. Backfill just those two fields in place
                        // (leave label/date/notes/zoneType/values untouched -- they may
                        // have been locally edited since the last full sync, so this
                        // must not re-run the full object-literal below).
                        // getAllSamples() returns a deep clone (JSON.parse(JSON.
                        // stringify(...))), so this mutation only reaches the live store
                        // once restoreFromPersistence(serverSnap) runs -- `restored` must
                        // count a backfill-only pass too, or the patch never sticks.
                        var _backfilled263 = false;
                        if (_existingSample263.methodologySnapshot == null && sample.methodology_snapshot != null) {
                            _existingSample263.methodologySnapshot = sample.methodology_snapshot;
                            _backfilled263 = true;
                        }
                        if (_existingSample263.soilTextureSnapshot == null && sample.soil_texture_snapshot != null) {
                            _existingSample263.soilTextureSnapshot = sample.soil_texture_snapshot;
                            _backfilled263 = true;
                        }
                        if (_backfilled263) restored++;
                        return;
                    }

                    // _label/_zone: stored by sync() alongside rawData since b35fix-label-roundtrip.
                    // Falls back to legacy fields (payload.label, payload.zone) for older records.
                    var pld = sample.payload || {};
                    serverSnap.allSites[siteId][sample.sample_type][sampleId] = {
                        id:       sampleId,
                        // GH-533 (stage 2, plan item 3): the row's address on
                        // the server. PATCH and DELETE are addressed by it and
                        // by nothing else -- `client_uid` cannot be an address:
                        // 27 of 147 rows on the stand have none (the Data page
                        // sends null), and a label-shaped uid like "Green 1"
                        // repeats between sites and between tabs.
                        serverId: sample.id,
                        label:    pld._label || pld.label || sampleId,
                        date:     sample.lab_date || sample.sample_date || null,
                        notes:    sample.notes || '',
                        zoneType: pld._zone  || pld.zone  || 'other',
                        source:   pld._source || 'server',
                        turfProfile: pld._turfProfile || null,
                        // GH-533: the lab readings, with the meta keys the
                        // server wraps them in taken back out and raised into
                        // fields of their own above. Until this stage a
                        // restored sample carried the whole envelope under
                        // `values` and nothing under `rawData`, which is the
                        // one reason the old snapshot push was harmless: it
                        // read `rawData` and so never saw a restored sample.
                        // That is why this line and the removal of the push
                        // could not be split across two deliveries.
                        rawData:  stripPayloadMeta(pld),
                        // GH-533: through `SM`, the reference this loop
                        // already holds, rather than reaching for the global
                        // again -- the loop is extracted and run on its own by
                        // two offline tests, and `SM` is what they hand it.
                        normalized: (typeof SM.normalizeValues === 'function')
                            ? SM.normalizeValues(stripPayloadMeta(pld), sample.sample_type)
                            : {},
                        // `values` stays as an alias for one more stage --
                        // read by sample-manager.js and hub-persistence.js.
                        // Removed in stage 3, with the browser copy.
                        values:   pld,
                        // GH-263 (D07): server computes these correctly at sample-creation
                        // time (SampleController.php samplePayload()/store() -- site.
                        // methodology_override/soil_texture_override falling back to
                        // account.methodology/soil_texture) and already returns them on
                        // every sample API response, but this sync previously discarded
                        // both -- only `values` (the lab payload) survived. Without them,
                        // the general soil-texture Settings field never reached mlsnEngine()
                        // at all: .gaip-soil-texture (the DOM field mlsnEngine reads) is a
                        // static "loam" default in legacy-hub-markup.blade.php with no sync
                        // path of its own. sample-manager.js's loadSample() now restores
                        // .gaip-soil-texture from soilTextureSnapshot when present (see that
                        // file's GH-263 change).
                        methodologySnapshot:  sample.methodology_snapshot  || null,
                        soilTextureSnapshot:  sample.soil_texture_snapshot || null
                    };
                    restored++;
                });

                if (restored > 0) {
                    SM.restoreFromPersistence(serverSnap);
                }

                // After syncing from DB, switch to the PHP-injected active site UUID
                // (GAIP_HUB_CONFIG.activeSiteId) so getSamples() returns samples for
                // the correct site.
                var configSiteId = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId) || null;
                var targetSite = configSiteId || (SM.getActiveSiteId ? SM.getActiveSiteId() : 'default');
                if (typeof SM.setActiveSite === 'function' && targetSite) {
                    SM.setActiveSite(targetSite);
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
    // GH-441 (GH-439 stage 2): syncSiteListToServer() is gone -- see the save
    // path above for why. POST /api/sites/sync has no caller left in the new
    // hub; the route itself is withdrawn in stage 3.

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
                    onComplete(true);
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

                onComplete(true);
            })
            .catch(function(err) {
                // GH-441 (GH-439 stage 2): the site list is the server's, and
                // if it cannot be read the page says so. It used to carry on,
                // and what filled the gap was the registry rebuilt from the
                // browser's own samples and config copy -- entries whose label
                // falls back to the site ID, which is what POST /api/sites/sync
                // then wrote as the site's name.
                warn('Could not load the site list from the server:', err && err.message);
                document.dispatchEvent(new CustomEvent('gaip:samples-persistence-error', {
                    detail: { error: err && err.message, reason: 'sites-list' }
                }));
                onComplete(false);
            });
    }

    // GH-533 (stage 2): forceSave() is gone with the snapshot. It flushed the
    // debounce and pushed the whole collection; there is no collection to
    // push and no debounce to flush. It had no caller in the tree beyond the
    // public `save` below, which goes with it.

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

        // GH-441 (GH-439 stage 2): recoverSitesFromLegacyConfig() is gone. It
        // rebuilt the site registry out of gilba_hub_site_configs -- a copy in
        // this browser -- and invented a label from whatever that copy held,
        // falling back to the site id prettified. Those labels were then
        // pushed as site names. The registry comes from GET /api/sites.

        function restoreFromLocalFallback() {
            StorageAdapter.load(CONFIG.storageKey)
                .then(function(data) {
                    if (!data) {
                        log('No local sample snapshot found after server restore miss');
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
        fetchSiteListFromServer(function(siteListLoaded) {
            if (!siteListLoaded) {
                // GH-441 (GH-439 stage 2): without the server's site list there
                // is no registry to put samples into, and building one from the
                // samples themselves is how sites acquired ID-shaped names. The
                // page reports the failure (dispatched above) and stops here
                // rather than showing a list it made up.
                finishReady({ restored: false, count: 0, samplesFromServer: false, error: 'sites-list' });
                return;
            }

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
     * GH-533 (stage 2): event -> the request it makes.
     *
     * This map used to be event -> a word for the debug log, because every one
     * of them did the same thing: push everything. Now each names its own
     * handler, and two entries are gone rather than re-pointed:
     *
     *   gaip:site-changed -- switching sites is not a change to data. It used
     *     to push the whole collection, which is how looking at a site could
     *     write to it. Zero requests.
     *
     *   gaip:site-added / -renamed / -removed -- GH-441 removed
     *     syncSiteListToServer() and said why: the browser's site registry was
     *     inventing labels out of a local copy and pushing them, and a live
     *     site came to be named after its own UUID. The registry travels one
     *     direction only, from GET /api/sites. So these do not write here
     *     either. (The plan's stage-2 table still routes them to
     *     syncSiteListToServer(); that function no longer exists, and the
     *     route is withdrawn in stage 3.)
     *
     * gaip:sample-renamed and gaip:sample-turf-profile-changed are updates:
     * both change what the sample's payload says about itself.
     */
    var MUTATION_HANDLERS = {
        'gaip:sample-added':                  onSampleAdded,
        'gaip:samples-imported':              onSamplesImported,
        'gaip:sample-updated':                onSampleUpdated,
        'gaip:sample-renamed':                onSampleUpdated,
        'gaip:sample-turf-profile-changed':   onSampleUpdated,
        'gaip:sample-deleted':                onSampleDeleted,
        'gaip:samples-cleared':               onSamplesCleared,
        'gaip:all-samples-cleared':           onAllSamplesCleared
    };

    function bindEvents() {
        var events = Object.keys(MUTATION_HANDLERS);
        for (var i = 0; i < events.length; i++) {
            (function(eventName) {
                document.addEventListener(eventName, function(e) {
                    if (!canWriteSamples()) {
                        log('Read-only on this site — ' + eventName + ' sent nothing');
                        return;
                    }
                    try {
                        MUTATION_HANDLERS[eventName](e);
                    } catch (err) {
                        warn('Handler for ' + eventName + ' threw: ' + err.message);
                    }
                });
            })(events[i]);
        }

        // GH-533: the browser copy is refreshed on the way out, and nowhere
        // else any more -- the per-record writes go straight to the database,
        // which is the source of truth. This whole block, and the key it
        // writes, are removed in stage 3.
        window.addEventListener('beforeunload', function() {
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

        // GH-533 (stage 2): `save()` is gone. It flushed a snapshot of the
        // whole collection to the server on demand, which is the write this
        // stage exists to remove, and nothing in the tree called it.
        // Manual operations
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
