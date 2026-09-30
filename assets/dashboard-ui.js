/* Shared UI utilities for all dashboard pages
 * Handles: site switcher dropdown, Re-run button
 * Loaded before page-specific scripts on every page.
 */
(function (global) {
    'use strict';

    /**
     * GH-684 — THE SPECIES-TO-CULTIVAR-TABLE KEY, IN ONE PLACE.
     *
     * It lived in `settings-init.js` alone, and the wizard needs the same answer to offer the
     * cultivars of the species a person just chose. Copying it would have made two tables that
     * disagree the first time a species is added to one of them. Moved here, where the project
     * keeps shared UI logic: this file is loaded by the db-shell layout itself, so both Settings
     * and the dashboard have it before their own scripts run.
     *
     * It MOVED rather than being duplicated: `settings-init.js` reads this object now.
     */
    global.GAIP_SpeciesTraitsKey = {
        'Creeping Bentgrass (Greens)':              'bentgrass',
        'Creeping Bentgrass (Fairway)':             'bentgrass',
        'Creeping Bentgrass':                       'bentgrass',
        'Colonial Bentgrass':                       'bentgrass',
        'Browntop Bent':                            'browntopBent',
        'Browntop Bent (Greens)':                   'browntopBent',
        'Browntop Bent (Fairways)':                 'browntopBent',
        'Perennial Ryegrass':                       'perennialRyegrass',
        'Kentucky Bluegrass':                       'kentuckyBluegrass',
        'Tall Fescue':                              'tallFescue',
        'Fine Fescue':                              'fineFescue',
        'Chewings Fescue':                          'chewingsFescue',
        'Chewings Fescue (Greens)':                 'chewingsFescue',
        'Chewings Fescue (Fairways)':               'chewingsFescue',
        'Slender Creeping Red Fescue':              'slenderCreepingRedFescue',
        'Slender Creeping Red Fescue (Greens)':     'slenderCreepingRedFescue',
        'Slender Creeping Red Fescue (Fairways)':   'slenderCreepingRedFescue',
        'Strong Creeping Red Fescue':               'strongCreepingRedFescue',
        'Strong Creeping Red Fescue (Fairways)':    'strongCreepingRedFescue',
        'Poa annua':                                null,
        'Annual Bluegrass (Greens)':                null,
        'Annual Bluegrass (Fairway)':               null,
        'Couch':                                    'couch',
        'Bermuda':                                  'couch',
        'Kikuyu':                                   'kikuyu',
        'Zoysia':                                   'zoysia',
        'Seashore Paspalum':                        'seashore_paspalum',
        'Buffalo':                                  'buffalo',
        'Buffalograss':                             'buffalo',
        'Cotula':                                   null,
    };

    /**
     * GH-684 — ONE PRODUCER OF THE CULTIVAR LIST, for Settings and for the wizard.
     *
     * Both screens offer the cultivars of a species plus Generic / Unknown, and both were building
     * that list themselves: Settings in `repopulateVariety`, the wizard in its species step (added
     * by part 1 of this item, so the duplication is one this same work created). Two builders drift
     * the first time the rule changes — and the rule already has two parts that are easy to get
     * half right, seen here: Generic is OFFERED, and Generic is NOT what you get by not choosing.
     *
     * It returns data rather than markup, so a test can call it and read the answer instead of
     * searching the source for a line. The mutation that made this necessary passed a source check:
     * killing `if (!selectedValue)` left the line that adds the empty prompt exactly where it was.
     *
     * @param  {string} species        the species as the two screens name it
     * @param  {*}      selectedValue  what the site has stored, empty for a site with none
     * @returns {Array<{value: string, label: string, selected: boolean}>}
     */
    global.GAIP_CultivarOptions = function (species, selectedValue) {
        var key = (global.GAIP_SpeciesTraitsKey || {})[species];
        var traits = (global.GAIP_VARIETY_TRAITS || {})[key] || {};
        var chosen = selectedValue === null || selectedValue === undefined ? '' : String(selectedValue);
        var out = [];

        // NOTHING CHOSEN MEANS AN EMPTY PROMPT, and it is first. Without it a list rebuilt from
        // scratch shows its first entry, which is Generic — so a site with no cultivar would arrive
        // at one nobody picked, which is the thing the owner removed from the wizard.
        if (chosen === '') {
            out.push({ value: '', label: '\u2014 select \u2014', selected: true });
        }
        out.push({ value: 'generic', label: 'Generic / Unknown', selected: chosen === 'generic' });

        Object.keys(traits).forEach(function (name) {
            if (name.indexOf('_') === 0) return;
            var t = traits[name];
            out.push({
                value: name,
                label: (t && t.displayName) || name,
                selected: chosen === name,
            });
        });

        // A stored cultivar that is not in the table still shows, and shows as chosen: the table is
        // ours and the value is the site's, so an unknown name is a gap in the table, not a reason
        // to make the site look unanswered.
        if (chosen !== '' && chosen !== 'generic' && !out.some(function (o) { return o.value === chosen; })) {
            out.splice(chosen === '' ? 0 : 1, 0, { value: chosen, label: chosen, selected: true });
        }

        return out;
    };

    // ── Site switcher ─────────────────────────────────────────────────────────

    function initSiteSwitcher() {
        var btn      = document.getElementById('db-site-switcher-btn');
        var dropdown = document.getElementById('db-site-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = !dropdown.hidden;
            dropdown.hidden = open;
            btn.setAttribute('aria-expanded', String(!open));
        });

        document.addEventListener('click', function () {
            dropdown.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        });

        dropdown.addEventListener('click', function (e) {
            e.stopPropagation();
            var target = e.target.closest('[data-site-id]');
            if (!target) return;
            var csrfToken = document.querySelector('meta[name="csrf-token"]') &&
                            document.querySelector('meta[name="csrf-token"]').content ||
                            (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.csrfToken) || '';
            target.disabled = true;
            target.textContent = '…';
            fetch('/api/active-site', {
                method:  'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
                body:    JSON.stringify({ site_id: target.dataset.siteId }),
            })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function () { global.location.reload(); })
            .catch(function () {
                target.disabled = false;
                target.textContent = target.dataset.siteName || 'Error';
            });
        });

        dropdown.querySelectorAll('[data-site-id]').forEach(function (el) {
            el.dataset.siteName = el.textContent.trim();
        });
    }

    // ── Re-run button ─────────────────────────────────────────────────────────

    /**
     * GH-588 (link 4) — DOES THIS SITE HAVE A SOIL SAMPLE? ASKED BEFORE THE
     * RUN STARTS, BECAUSE THE SERVER KNOWS.
     *
     * Owner, 23.09.2026: "we have to wait, because if we have no sample then all
     * the data will be computed wrongly" — a run on a sample that has not
     * arrived produces WRONG NUMBERS, not empty ones. And: ask in advance rather
     * than wait blind.
     *
     * THREE ANSWERS, and the first and the last must never be confused:
     *   `'<id>'`   there is one, and the run must have it before it counts;
     *   `'none'`   there is none — nothing to wait for, and pressing again would
     *              change nothing, so nothing suggests it;
     *   `'unknown'` the question could not be put. NOT a quiet "none": a run
     *              told "none" stops waiting, and saying that because a request
     *              failed would turn a delivery problem into "you have no
     *              sample" — which is the substitution this whole question is
     *              about, wearing a helpful face.
     */
    /**
     * GH-724 (queue item 19) — THE SAME QUESTION, FOR ANY KIND OF SAMPLE.
     *
     * This asked about soil alone, so the runner was told which soil sample to compute on and was
     * told nothing about tissue. Measured on the stand: `computed.tissue` is empty in 66 of 66
     * stored rows while `Burns`, `Russley` and `Test5 - NZ` each hold live tissue samples.
     *
     * The choice is the SERVER'S, by the one rule it already applies to soil
     * (`COALESCE(lab_date, sample_date) DESC, id DESC`), and it is asked HERE rather than inside
     * the runner: awaiting anything in the runner's own handler stops the weather from ever being
     * fetched and the run dies having written nothing (GH-587, GH-588). The runner only ever
     * receives a fact.
     */
    function askServerForSample(kind, siteId) {
        return new Promise(function (resolve) {
            if (!siteId) return resolve('unknown');
            var url = '/api/samples?sample_type=' + encodeURIComponent(kind)
                + '&site_id=' + encodeURIComponent(siteId) + '&limit=1';
            fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (j) {
                    var rows = j && (j.data || j.samples);
                    if (!Array.isArray(rows)) return resolve('unknown');
                    if (!rows.length) return resolve('none');
                    var first = rows[0];
                    resolve(first && first.id != null ? String(first.id) : 'unknown');
                })
                .catch(function () { resolve('unknown'); });
        });
    }

    /**
     * GH-724 — THE ADDRESS OF A RUN FRAME, BUILT IN ONE PLACE.
     *
     * There are two openers — this page's Re-run button and the one in `settings-init.js` — and
     * the second passed neither `&soil=` nor `&tissue=`, so a run started from Settings took
     * whatever the frame happened to hold. Both ask the same question now, and a sample kind
     * added here reaches both without a second edit.
     */
    function buildRunFrameUrl(runId, siteId, waterSampleId) {
        return Promise.all([
            askServerForSample('soil', siteId),
            askServerForSample('tissue', siteId),
        ]).then(function (answers) {
            return '/hub?rerun=' + encodeURIComponent(runId) + '&site=' + encodeURIComponent(siteId)
                + (waterSampleId ? '&water=' + encodeURIComponent(waterSampleId) : '')
                + '&soil=' + encodeURIComponent(answers[0])
                + '&tissue=' + encodeURIComponent(answers[1]);
        });
    }

    function initRerun() {
        var btn = document.getElementById('db-rerun-btn');
        if (!btn) return;

        if (!document.getElementById('db-spin-style')) {
            var s = document.createElement('style');
            s.id = 'db-spin-style';
            s.textContent = '@keyframes db-spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(s);
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (btn.dataset.running === '1') return;
            btn.dataset.running = '1';
            btn.disabled = true;
            btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:db-spin 0.8s linear infinite"><path d="M4 12a8 8 0 018-8v4l4-4-4-4v4a10 10 0 100 10"/></svg> Running…';

            // GH-536 (PLAN-samples-sync-FINAL, stage 3): the stamp that stood
            // here is gone with the key it wrote. It copied the active site id
            // into `gilba_samples.currentSite` so the /hub iframe would restore
            // the right site out of the browser copy. The iframe restores from
            // the server now: /hub loads sample-persistence.js, and
            // layouts/app.blade.php puts the server's own `activeSiteId` into
            // GAIP_HUB_CONFIG before any of it runs. `gilba_wb_water_override`
            // used to be the one write that stayed here; GH-586 replaced it with
            // a run parameter, so nothing on this path touches `localStorage`.

            // GH-586 (D6) — THE CHOICE TRAVELS AS A RUN PARAMETER.
            //
            // This used to write `gilba_wb_water_override` into `localStorage`:
            // the id of the chosen water sample AND A COPY OF ITS PAYLOAD, for
            // the runner to pick up. It was never a store — it was a message to
            // `/hub` from the page that opened it, "compute on this water
            // sample" — and it went through the browser because until GH-547 the
            // runner was opened as a bare `/hub` with nowhere to put a parameter.
            //
            // It has parameters now. The choice goes in the URL beside the run
            // id and the site; the runner fetches the sample FROM THE SERVER by
            // that id. The payload no longer travels through the browser, so
            // there is no copy of the server's data to go stale.
            var _waterSampleId = '';
            try {
                /**
                 * GH-777 (queue item 4): THE ROW ID, like the other two kinds.
                 *
                 * Soil and tissue are named by asking the server, which answers with the row id. The water
                 * was taken off the page, where a sample carries the client store's own key -- so it
                 * happened to be found while the frame compared keys, and would stop being found the moment
                 * the frame compares row ids. Both sides name the same thing now: `samples.id`.
                 */
                var _aws = global._gilbaActiveWaterSample;
                if (_aws && _aws.serverId != null) _waterSampleId = String(_aws.serverId);
            } catch(_e) {}

            // GH-547 (stage 2): the runner is told WHAT it is and WHICH
            // site it is for. It used to be opened as a bare `/hub` and worked
            // out both for itself — "am I in a frame?" and "what does the active
            // site pointer say?" — and the pointer can move in another tab
            // between this press and the write.
            var runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            var siteId = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId) || '';

            var iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
            iframe.setAttribute('aria-hidden', 'true');
            document.body.appendChild(iframe);

            // GH-588: the frame exists and its listeners are set below; it does
            // not START until the server has answered, and the answer rides in
            // as a parameter. Waiting inside the RUNNER's own click handler was
            // tried and measured — an `await` there stops the weather from ever
            // being fetched and the run dies on its budget having written
            // nothing (GH-587). So the waiting happens here, before anything
            // begins, and the runner only ever receives a fact.
            buildRunFrameUrl(runId, siteId, _waterSampleId).then(function (src) {
                iframe.src = src;
            });

            var done = false;
            function cleanUp() {
                try { document.body.removeChild(iframe); } catch (e) {}
            }
            function succeed() {
                if (done) return;
                done = true;
                cleanUp();
                global.location.reload();
            }
            /**
             * A run that did not finish does NOT reload the page.
             *
             * It used to: any message at all, and a thirty-second timer besides,
             * called the same `finish()` — so a run that computed nothing, or was
             * refused by the server, ended with the page reloading onto the
             * PREVIOUS result while the button reported success. The previous
             * result is kept deliberately (owner's decision), but it is not
             * presented as new.
             */
            function stall(reason, detail) {
                if (done) return;
                done = true;
                cleanUp();
                btn.dataset.running = '';
                btn.disabled = false;
                btn.textContent = 'Re-run';
                global.GilbaRerunOutcome = { ok: false, reason: reason || 'run-not-completed', runId: runId };
                console.warn('[GilbaRerun] did not complete:', reason, '— the previous analysis is kept');

                // GH-548 (stage 3): the reason reaches the SCREEN, here and
                // now. The runner has also filed it with the server, so it is on
                // the panel again on the next load and on any other device — but
                // this page does not reload on a failure (GH-547), and the person
                // who pressed the button is the one who most needs to know why
                // nothing changed.
                showAnalysisNotice(analysisFailureText(reason, detail), 'warning');
            }

            global.addEventListener('message', function onMsg(e) {
                var d = e && e.data;
                if (!d || typeof d !== 'object' || d.runId !== runId) return;
                if (d.type === 'gilba:analysis-complete') {
                    global.removeEventListener('message', onMsg);
                    succeed();
                } else if (d.type === 'gilba:analysis-partial') {
                    // GH-557 (section 15): a run that finished without
                    // part of its result does NOT reload the page. The
                    // numbers on screen are the last complete ones, and
                    // reloading would replace them with blanks — the same
                    // rule as a failure (GH-548).
                    global.removeEventListener('message', onMsg);
                    stall('values-not-computed', { keys: d.nulls });
                } else if (d.type === 'gilba:analysis-failed') {
                    global.removeEventListener('message', onMsg);
                    stall(d.reason, d.detail);
                }
            });

            // The runner reports inside its own budget; this is only for a
            // runner that never spoke at all.
            setTimeout(function () { stall('no-report'); }, 30000);
        });
    }

    // ── Site label repair ───────────────────────────────────────────────────
    // A past bug could store a site's label as its raw internal storage key
    // ('__site__<UUID>') instead of its real name (e.g. shown in the Export
    // Report modal). Heal any such labels already sitting in localStorage by
    // recovering the real name from the topbar switcher, which is always
    // server-rendered from the sites.name DB column.

    function healAutoSiteLabels() {
        var sm = global.GAIP_SampleManager;
        if (!sm || typeof sm.renameSite !== 'function' || typeof sm.getSiteList !== 'function') return;

        sm.getSiteList().forEach(function (site) {
            if (!site || typeof site.label !== 'string' || !/^__site__/.test(site.label)) return;
            var topbarOption = document.querySelector('[data-site-id="' + site.id + '"]');
            var realName = topbarOption && (topbarOption.dataset.siteName || topbarOption.textContent).trim();
            if (realName) sm.renameSite(site.id, realName);
        });
    }

    // ── Tab badges ────────────────────────────────────────────────────────────
    // Reads GAIP_DASHBOARD_DATA.computed and populates the gl-badge-disease /
    // gl-badge-stress spans in the tabs bar consistently on all analysis pages.

    function initTabBadges() {
        var data     = global.GAIP_DASHBOARD_DATA;
        var computed = data && data.computed;
        if (!computed) return;

        var accEl = document.getElementById('gl-tab-accuracy');
        var conf  = computed.confidence;
        var confScore = conf && typeof conf === 'object' ? (conf.overall && conf.overall.score) : (typeof conf === 'number' ? conf : null);
        if (accEl && confScore != null) {
            accEl.textContent = 'Accuracy ' + Math.round(confScore) + '%';
            accEl.hidden = false;
        }
    }

    // ── Boot ──────────────────────────────────────────────────────────────────

    // ── The analysis notice — the one place any page shows it ──────────────
    //
    // GH-548 (stage 3). `initAnalysisTimestamp()` stood here and rebuilt the
    // topbar pill out of `analyzedAt` after load. It is gone: the pill is
    // rendered by the server (`partials/analysis-pill.blade.php`), which is the
    // only place that knows whether the last re-run failed. A label re-derived
    // from a date can only ever say the date, so this function overwrote that
    // mark every time the page finished loading.
    //
    // What is left is DISPLAY. The words come from `AnalysisNotice` in PHP and
    // reach the page as `GAIP_ANALYSIS_TEXTS`; nothing here composes a sentence,
    // because a reason map kept in two languages is two maps.

    /** Put a message into the page's notice panel. */
    function showAnalysisNotice(text, level) {
        var notice = document.getElementById('db-analysis-notice');
        var textEl = document.getElementById('db-analysis-notice-text');
        if (!notice || !textEl) return false;
        textEl.textContent = text;
        notice.className = 'db-verdict ' + (level || 'warning');
        notice.style.display = 'flex';
        return true;
    }

    /**
     * The sentence for a run that did not complete, in the words the server
     * would have used had the page been reloaded.
     */
    function analysisFailureText(reason, detail) {
        var texts   = global.GAIP_ANALYSIS_TEXTS || {};
        var reasons = texts.reasons || {};
        var why     = reasons[reason]
                   || (texts.unknown || 'the run reported "{code}"').replace('{code}', reason || 'run-not-completed');
        if (detail && detail.message) why += ' (' + detail.message + ')';
        else if (detail && detail.status) why += ' (HTTP ' + detail.status + ')';
        return (texts.frame || 'The re-run{when} did not complete: {reason}. Try Re-run again.')
            .replace('{when}', '')
            .replace('{reason}', why);
    }

    /**
     * The same sentence for pages that have no panel of their own.
     *
     * Settings runs a re-run after an import and prints its outcome in the
     * import box; it showed the raw code — "(run-not-completed)" — because the
     * words lived nowhere it could reach them.
     */
    global.GilbaAnalysisNotice = {
        failureText: analysisFailureText,
        show:        showAnalysisNotice,
    };

    /**
     * GH-724 — the one builder of a run frame's address, so both openers ask the same questions.
     */
    global.GilbaRunFrame = {
        url: buildRunFrameUrl,
    };

    /** Dismiss, shared by every page that carries the panel. */
    function initAnalysisNotice() {
        var btn = document.getElementById('db-analysis-notice-dismiss');
        var notice = document.getElementById('db-analysis-notice');
        if (!btn || !notice) return;
        btn.addEventListener('click', function () { notice.style.display = 'none'; });
    }

    // ── Info popovers (db-info-icon) — shared across all pages ───────────
    function initInfoPopover() {
        var popover  = document.getElementById('db-info-popover');
        if (!popover || popover.dataset.initialized) return; // dashboard-init.js handles it there
        popover.dataset.initialized = '1';
        var popTitle = document.getElementById('db-info-popover-title');
        var popBody  = document.getElementById('db-info-popover-body');
        var popClose = document.getElementById('db-info-popover-close');
        var popArrow = document.getElementById('db-info-popover-arrow');
        if (!popover) return;

        var currentAnchor = null;

        function showPopover(anchor) {
            var key   = anchor.dataset.info;
            var store = global.GAIP_GLOSSARY || {};
            var entry = store[key];
            if (!entry) return;
            popTitle.textContent = entry.title || '';
            popBody.textContent  = entry.body  || '';
            popover.style.visibility = 'hidden';
            popover.style.display    = 'block';

            var rect  = anchor.getBoundingClientRect();
            var pw    = popover.offsetWidth;
            var ph    = popover.offsetHeight;
            var viewW = window.innerWidth;
            var viewH = window.innerHeight;

            var left = Math.round(rect.left + rect.width / 2 - pw / 2);
            left = Math.max(8, Math.min(left, viewW - pw - 8));

            var top, flipped = false;
            if (rect.bottom + 10 + ph > viewH - 8) {
                top = Math.round(rect.top - 10 - ph);
                flipped = true;
            } else {
                top = Math.round(rect.bottom + 10);
            }

            popover.style.position   = 'fixed';
            popover.style.left       = left + 'px';
            popover.style.top        = top  + 'px';
            popover.style.visibility = '';

            if (popArrow) {
                var arrowLeft = Math.round(rect.left + rect.width / 2 - left - 5);
                arrowLeft = Math.max(12, Math.min(arrowLeft, pw - 22));
                popArrow.style.left      = arrowLeft + 'px';
                popArrow.style.top       = flipped ? ''     : '-6px';
                popArrow.style.bottom    = flipped ? '-6px' : '';
                popArrow.style.transform = flipped ? 'rotate(225deg)' : 'rotate(45deg)';
            }
            currentAnchor = anchor;
        }

        function hidePopover() { popover.style.display = 'none'; currentAnchor = null; }

        document.addEventListener('click', function (e) {
            var icon = e.target.closest('.db-info-icon');
            if (icon) {
                e.stopPropagation();
                if (currentAnchor === icon) { hidePopover(); } else { showPopover(icon); }
                return;
            }
            if (!popover.contains(e.target)) hidePopover();
        });

        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hidePopover(); });
        if (popClose) popClose.addEventListener('click', function (e) { e.stopPropagation(); hidePopover(); });

        document.querySelectorAll('.db-info-icon[data-info]').forEach(function (icon) {
            icon.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPopover(icon); }
            });
        });
    }

    // GH-441 (GH-439 stage 2, review): the settings-unavailable banner moved
    // to settings-unavailable-banner.js. This file is loaded only by db-shell,
    // and /morning-briefing -- a page a client opens -- sits on layouts.app,
    // so the failure was invisible there. The shared file is loaded by both.

    function boot() {
        initSiteSwitcher();
        healAutoSiteLabels();
        initRerun();
        initTabBadges();
        initAnalysisNotice();
        initInfoPopover();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

}(window));

/* ── Shared Google Places geocoding helper ───────────────────────────────
 * Proxies through Laravel — API key stays server-side, no Maps JS needed.
 */
window.GilbaGeo = (function () {
    var _base  = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.restUrl) || '/api/';
    var _csrf  = function () { return (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.csrfToken) || ''; };
    var _hdrs  = function () { return { 'Accept': 'application/json', 'X-CSRF-TOKEN': _csrf() }; };

    return {
        // search(query, fn) — fn receives [{description, placeId}]
        search: function (query, fn) {
            fetch(_base + 'geocode?q=' + encodeURIComponent(query), { headers: _hdrs() })
                .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
                .then(function (d) { fn(d.suggestions || []); })
                .catch(function () { fn([]); });
        },

        // getDetails(placeId, fn) — fn receives {lat, lon, name} or null
        getDetails: function (placeId, fn) {
            fetch(_base + 'geocode/' + encodeURIComponent(placeId), { headers: _hdrs() })
                .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
                .then(function (d) { fn(d); })
                .catch(function () { fn(null); });
        },
    };
}());
