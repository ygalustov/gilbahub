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
 * GH-536 (stage 3) removed the read half. There is no browser copy of the
 * samples any more: no `gilba_samples` key, no StorageAdapter, no refresh on
 * unload. The server is read once on load and the answer is one of three
 * things -- rows, an empty account, or a failure -- and the third is now said
 * out loud instead of being papered over with whatever the last visit left in
 * localStorage.
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


    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        version: '1.0.0',
        debug: false,

        // GH-533 (stage 2): the 500 ms debounce is gone with the snapshot it
        // batched. There is nothing left to collapse -- twenty imported
        // samples are twenty creates, not one push repeated twenty times.

        // GH-536 (stage 3): `storageKey` and `sizeWarningBytes` are gone with
        // the browser copy they described.

        // How many samples one restore asks for. The route caps at 2000
        // (SampleController::index, GH-526). If more exist than this, `meta.total`
        // says so and the restore reports a partial read rather than showing a
        // short list as if it were the whole one.
        //
        // GH-537: on most pages this is now a limit on ONE SITE rather than on
        // the whole account -- see restoreSiteId() below. The most populous site
        // on the dev stand holds 31 rows, 29 of them live.
        restoreLimit: 200
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
    // THE SERVER
    //
    // GH-536 (stage 3): this heading used to read "STORAGE ADAPTER" and
    // described a local cache. There is no cache. Everything below talks to
    // the API and nothing else.
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

    // GH-536 (stage 3): StorageAdapter is gone. It was save/load/delete/getSize
    // over one localStorage key, `gilba_samples`, holding a snapshot of every
    // sample of every site. `assets/site-dashboard.js` declares a DIFFERENT
    // object of the same name under GaipSiteDashboard; that one stays.

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
    /**
     * GH-536 (stage 3): the chain continues past a FAILURE.
     *
     * This read `prev.then(step)`, which runs `step` only when `prev` RESOLVED.
     * Every write re-throws on failure so the caller sees it, so one refused
     * request left the queue for that record permanently rejected: each later
     * write to the same sample was skipped without a request and without a
     * word. Measured, not reasoned -- the Retry test would not send its second
     * request and this is why.
     *
     * The chain exists because a PATCH has no address until its POST has
     * answered, and that still holds: a PATCH after a failed create finds no
     * `serverId` and says so. What it must not do is refuse to run at all.
     */
    function enqueue(key, step) {
        var prev = _queues[key] || Promise.resolve();
        var next = prev.catch(function () {}).then(step);
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

    /**
     * GH-536 (stage 3) -- RETRY ONE RECORD.
     *
     * `markFailed()` has stamped `sample._dirty = {op, error}` since stage 2 and
     * nothing has ever read it: no marker in the UI, no way to send the record
     * again. That is the second silent loss this stage closes -- the first is a
     * failed READ, this is a failed WRITE. The client saw a sample on screen
     * that the database had never heard of.
     *
     * A failed DELETE cannot be retried from here and that is structural, not an
     * omission: markFailed() is called with `null` for a delete, because by then
     * the sample is out of the store and there is no row in the switcher to hang
     * a button on. It is named in the report rather than left to be discovered.
     */
    function retryRecord(dataType, sampleId) {
        var SM = global.GAIP_SampleManager;
        var sample = liveSample(dataType, sampleId);
        if (!sample || !sample._dirty) return false;

        var siteId = (SM && typeof SM.getActiveSiteId === 'function') ? SM.getActiveSiteId() : null;
        if (!siteId) return false;

        var op = sample._dirty.op;
        if (op === 'create') { writeCreate(siteId, dataType, sampleId, sample); return true; }
        if (op === 'update') { writeUpdate(siteId, dataType, sampleId, sample); return true; }
        return false;
    }

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

    /**
     * GH-536 (stage 3) -- READ THE SERVER, AND SAY WHICH OF THE THREE ANSWERS
     * CAME BACK.
     *
     * Until this stage the callback took a boolean, and `false` meant two
     * different things: this account has no samples, and this request failed.
     * `restore()` could not tell them apart, so it treated both as "fill the
     * store from localStorage" -- which is the mechanism the whole stage exists
     * to remove. `onComplete` now takes an object:
     *
     *   { outcome: 'server', count }             rows came back
     *   { outcome: 'empty',  count: 0 }          the account has none
     *   { outcome: 'error',  error, status }     the read failed
     *   { outcome: 'error',  partial: true, count, total }   short read
     *
     * THE SHORT READ is the fourth case and it is new here. The request asks
     * for `restoreLimit` rows; `meta.total` (added by GH-526 in stage 1) says
     * how many there are. Nothing read that field until now. While the browser
     * kept its own copy, reading 200 of 201 meant an incomplete cache. With the
     * copy gone the server is the only source, so it means one sample the
     * client cannot see and is not told about -- the same loss as the one
     * above, arriving by a different road.
     */
    /**
     * GH-537 -- WHOSE SAMPLES THIS PAGE ASKS FOR.
     *
     * Until now every page asked for `samples?limit=200` with no site: the
     * whole account, first 200 rows, on a page showing one site. The owner's
     * decision is that a page loads the samples of the site it is open on.
     *
     * The server half was already there and is not touched: `site_id` is a
     * `nullable` rule in `SampleController::index` and is applied to the query
     * when present. We are not tightening the server, we are stopping asking it
     * for everything.
     *
     * FOUR PAGES STILL ASK FOR ALL OF THEM, and this is the part that is a
     * judgement rather than a transcription of the decision. /hub and the three
     * /reports pages load `word-export-combined.js`, whose `enumerateSamples
     * ('all')` walks every site in the store and whose picker offers them in one
     * dialog -- measured on /reports/export the same evening: 35 samples in 9
     * site groups. The same four pages are also the only ones carrying a control
     * that switches site WITHOUT reloading (`site-selector-ui.js`,
     * `sample-switcher-ui.js`, `turf-profile-controller.js`); everywhere else a
     * site change goes through `dashboard-ui.js`, which PATCHes the pointer and
     * reloads, so the next restore asks for the new site anyway.
     *
     * The page is not asked to declare this with a new flag. It is read off what
     * the page actually loaded: `GAIP_CombinedExport` exists on exactly those
     * four views and nowhere else.
     *
     * WHAT MAKES THAT SAFE IS NOT THE SCRIPT ORDER, and it is worth saying so
     * plainly because the order runs the other way. On all four of those views
     * `sample-persistence.js` is loaded BEFORE `word-export-combined.js` (hub
     * 200 against 205, reports/export 276 against 287, scenarios 147 against
     * 156, forensic 128 against 137), and every one of those scripts is emitted
     * with `defer`, so `document.readyState` is already 'interactive' when this
     * file runs and `init()` fires immediately rather than waiting for
     * DOMContentLoaded. The global does not exist at the moment this module
     * loads, on any of them.
     *
     * It is there by the time the QUESTION IS ASKED. `restoreSiteId()` is
     * called inside `fetchSamplesFromServer()`, which is itself inside the
     * callback of `fetchSiteListFromServer()` -- so the decision is taken after
     * a network response has come back, and the whole deferred queue has run to
     * the end long before that. Move the read to module scope and script order
     * would start to matter; `gh537-restore-is-scoped-to-the-site.test.js` pins
     * that it has not been moved, and measures the case directly by defining
     * the global AFTER this module has loaded and started.
     *
     * An earlier version of this paragraph said the opposite on both counts --
     * that `restore()` waits for DOMContentLoaded and that the module is loaded
     * after this one. Both were wrong, and a reader who believed either would
     * conclude that the order protects them.
     *
     * `stadium.blade.php` loads the site-switching modules too and is NOT in
     * that set, which is correct: it loads sample-manager.js without
     * sample-persistence.js, so no restore happens there at all.
     */
    function restoreSiteId() {
        if (global.GAIP_CombinedExport) return null;
        var cfg = global.GAIP_HUB_CONFIG || global.GAIP_FIELD_LOG_CONFIG || {};
        return cfg.activeSiteId || null;
    }

    function fetchSamplesFromServer(onComplete) {
        var base = getApiBaseUrl();
        if (!base || typeof fetch === 'undefined' || !global.GAIP_SampleManager) {
            onComplete({ outcome: 'error', error: 'No API base URL, fetch or SampleManager on this page' });
            return;
        }

        var scopeSiteId = restoreSiteId();
        var url = base.replace(/\/?$/, '/') + 'samples?limit=' + CONFIG.restoreLimit
            + (scopeSiteId ? '&site_id=' + encodeURIComponent(scopeSiteId) : '');
        log('Restoring samples for ' + (scopeSiteId ? 'site ' + scopeSiteId : 'every site of the account'));

        apiFetchJson(url)
            .then(function(data) {
                // An unparseable 200 arrives here as `{}` (apiFetchJson swallows
                // the parse error and returns an object). No `data` array means
                // we did not read the list, which is an error and not an empty
                // account -- the difference this function exists to keep.
                if (!data || !Array.isArray(data.data)) {
                    onComplete({ outcome: 'error', error: 'The samples response had no data array' });
                    return;
                }

                var samples = data.data;
                var meta = data.meta || {};
                var total = (typeof meta.total === 'number') ? meta.total : null;
                var returned = (typeof meta.returned === 'number') ? meta.returned : samples.length;

                if (!samples.length) {
                    // A read that succeeded and found nothing. The store stays
                    // empty and stays UNLOCKED: this is a working account with
                    // no samples yet, and the empty states already say so.
                    onComplete({ outcome: 'empty', count: 0, total: total === null ? 0 : total,
                                 siteId: scopeSiteId });
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

                log('SERVER SYNC: Restored ' + restored + ' samples from MySQL');

                if (total !== null && returned < total) {
                    // The rows that did arrive are kept and shown; the store is
                    // locked by restore() so nothing is edited against a list
                    // known to be short. Throwing them away as well would be a
                    // second loss on top of the first.
                    warn('Partial sample read: ' + returned + ' of ' + total);
                    onComplete({ outcome: 'error', partial: true, count: returned, total: total,
                                 siteId: scopeSiteId });
                    return;
                }

                onComplete({ outcome: 'server', count: returned, total: total === null ? returned : total,
                             siteId: scopeSiteId });
            })
            .catch(function(err) {
                warn('Server sample fetch failed: ' + err.message);
                onComplete({ outcome: 'error', error: err && err.message, status: (err && err.status) || null });
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
                    // GH-536 (stage 3): the site list used to be written to the
                    // browser copy here "so next load is instant". Next load
                    // reads GET /api/sites, same as this one.
                    log('SERVER SYNC: Imported ' + added + ' sites from MySQL');
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

        /**
         * GH-536 (stage 3): one exit, and it names WHICH of the three answers
         * came back.
         *
         * `_gaipSamplePersistenceReady` is set in ALL THREE cases, error
         * included. turf-profile-controller.js gates its site switch on that
         * flag (`if (window._gaipSamplePersistenceReady)`), so leaving it unset
         * on a failure would stop the page switching sites for the rest of its
         * life -- a second defect hanging off the first.
         *
         * The lock is set here and nowhere else, and it is set to a VALUE on
         * every path, not only on the failing one: a Retry that succeeds has to
         * open it again.
         */
        function finishReady(detail) {
            var SM = global.GAIP_SampleManager;
            var failed = detail.source === 'error';

            if (SM && typeof SM.setReadOnly === 'function') {
                SM.setReadOnly(failed, failed ? (detail.reason || 'samples-load') : null);
            }

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

        // GH-536 (stage 3): restoreFromLocalFallback() is gone, and it is the
        // reason this stage exists. It ran whenever the server restore came
        // back without rows -- which, until the change above, was also what a
        // FAILED read looked like -- and filled the store out of
        // `gilba_samples`. Those samples carried no `serverId`, because only a
        // server restore writes one, so every edit the client then made left
        // `writeUpdate()` at `if (!sample.serverId)` with a line in the console
        // and nothing on the wire. The screen looked right the whole time.

        log('Attempting server-first sample restore');
        fetchSiteListFromServer(function(siteListLoaded) {
            if (!siteListLoaded) {
                // GH-441 (GH-439 stage 2): without the server's site list there
                // is no registry to put samples into, and building one from the
                // samples themselves is how sites acquired ID-shaped names. The
                // page reports the failure (dispatched above) and stops here
                // rather than showing a list it made up.
                //
                // GH-536 (stage 3): and it is an ERROR, so the store locks.
                // `reason` stays 'sites-list' -- settings-unavailable-banner.js
                // already speaks for this exact failure, and the samples banner
                // stands down rather than stacking a second red box saying the
                // same thing in other words.
                finishReady({
                    source: 'error',
                    restored: false,
                    count: 0,
                    total: null,
                    error: 'sites-list',
                    reason: 'sites-list',
                    samplesFromServer: false
                });
                return;
            }

            fetchSamplesFromServer(function(result) {
                var outcome = (result && result.outcome) || 'error';

                if (outcome === 'server') {
                    var serverSnap = global.GAIP_SampleManager.getAllSamples();
                    finishReady({
                        source: 'server',
                        restored: true,
                        count: countSnapshotSamples(serverSnap),
                        total: result.total,
                        // GH-537: whose samples these are, or null when the page
                        // asked for every site. Carried so a consumer can tell
                        // "this site has none" from "the account has none".
                        siteId: result.siteId || null,
                        samplesFromServer: true
                    });
                    return;
                }

                if (outcome === 'empty') {
                    // A successful read of an account with no samples. No
                    // banner, no lock -- the empty states on the page already
                    // say "no samples yet", and they are telling the truth.
                    finishReady({
                        source: 'empty',
                        restored: false,
                        count: 0,
                        total: 0,
                        siteId: result.siteId || null,
                        samplesFromServer: true
                    });
                    return;
                }

                finishReady({
                    source: 'error',
                    restored: false,
                    count: (result && result.count) || 0,
                    total: (result && result.total) || null,
                    partial: !!(result && result.partial),
                    siteId: (result && result.siteId) || null,
                    error: (result && result.error) || null,
                    status: (result && result.status) || null,
                    reason: (result && result.partial) ? 'samples-partial' : 'samples-load',
                    samplesFromServer: false
                });
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

        // GH-536 (stage 3): the `beforeunload` handler that wrote a snapshot of
        // every sample of every site into `gilba_samples` on the way out is
        // gone with the key. Nothing is written to the browser now.

        log('Bound ' + events.length + ' mutation events');
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
        // Manual operations. `restore` is also what the error banner's Retry
        // calls -- it is the whole retry, because the restore is the only read.
        restore: restore,

        // GH-536 (stage 3): send one failed record again. Called by the Retry
        // on the sample's own row in sample-switcher-ui.js.
        retryRecord: retryRecord,

        // GH-536 (stage 3): `clear`, `getStorageSize`, `getStorageSizeFormatted`
        // and `StorageAdapter` are gone. All four addressed the browser copy,
        // and there is no browser copy.

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
