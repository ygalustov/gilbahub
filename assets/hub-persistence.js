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
    // =========================================================================
    // GH-547 (stage 2) -- THE RUNNER, AND WHEN IT IS ONE
    //
    // WHAT THIS REPLACES. The block that stood here decided it was the analysis
    // runner by looking at `window.parent !== window` -- true in ANY frame: a
    // test harness, a preview, somebody else's page. That is a circumstance, not
    // an intention, and it is why `/reports/export` could post an analysis
    // result on a night when the weather hung. It then sent that result on a
    // TIMER: three seconds after the engines said they had finished, or ten
    // seconds after load whether they had or not, or again when sensor data
    // turned up late. A timer named after an event is not the event; the
    // ten-second path is the likeliest author of the row on the stand that is
    // missing `weatherSource`, because it fires before the weather arrives.
    //
    // WHAT IT IS NOW. The page is the runner only when it was OPENED as one:
    // `/hub?rerun=<runId>&site=<siteId>`. Both are required and both come from
    // the opener -- the site travels as a parameter rather than being read from
    // the active-site pointer, because the pointer can move in another tab
    // between the press and the write, and then the result is filed under a site
    // nobody asked about.
    //
    // It writes ONCE, on completion, and completion is three events rather than
    // a clock: weather ready, orchestrator complete, and the analysis itself
    // reporting `gaip:analysis-complete` without `detail.error`. If they do not
    // all arrive inside the budget, or the analysis reports an error, the runner
    // writes NOTHING and reports the reason to its opener, which keeps the
    // previous result and says so instead of reloading onto numbers it believes
    // are new.
    // =========================================================================
    var _runIntent = (function () {
        try {
            var q = new URLSearchParams(window.location.search || '');
            var runId = q.get('rerun');
            var siteId = q.get('site');
            if (!runId || !siteId) return null;
            return { runId: runId, siteId: siteId };
        } catch (e) {
            return null;
        }
    })();

    /**
     * How long the whole run may take before the runner gives up on it.
     *
     * The same fifteen seconds the weather fetch is allowed (GH-545), and for
     * the same reason: it is the longest single thing a run waits on. This is a
     * deadline for REPORTING, not a delay before writing -- the write happens
     * the moment the run completes, which is usually long before this.
     */
    /**
     * GH-586: the run asked for a particular water sample and could not use it.
     *
     * Said out loud rather than passed over. The run goes on — the rest of the
     * analysis is real — and the water part is named as not computed, with which
     * of the two reasons it was, so the reader is not told a number that came
     * from a sample nobody chose.
     */
    /**
     * GH-598: a water sample's readings, through the sample manager's own
     * normaliser — the one the form filling and the Word export use.
     *
     * No list of column names lives here. `readingsOf` resolves the map's
     * aliases (`Ca_mgL`, `EC_dSm`, …) case- and suffix-tolerantly; a table
     * written out here would be a second one, which is the defect GH-591 closed
     * for the soil after it cost a measured pH.
     */
    function _waterReadingsOf(sample) {
        try {
            var SM = global.GAIP_SampleManager;
            if (!SM || typeof SM.readingsOf !== 'function' || !sample) return {};
            return SM.readingsOf('water', sample) || {};
        } catch (e) {
            return {};
        }
    }

    /**
     * GH-598: the ions among a water sample's readings — everything that is not
     * the two named readings beside them. Derived from what the reader
     * returned, so an ion added to the map arrives without a second edit, and a
     * reading of ZERO is kept: a carbonate measured at zero is a measurement.
     */
    function _ionsOf(readings) {
        var out = {};
        Object.keys(readings || {}).forEach(function (key) {
            if (key === 'EC' || key === 'pH') return;
            if (typeof readings[key] === 'number') out[key] = readings[key];
        });
        return out;
    }

    function noteWaterSampleUnresolved(reason, requestedId) {
        try {
            if (global.GaipOrchestrator && typeof global.GaipOrchestrator.noteSkipped === 'function') {
                global.GaipOrchestrator.noteSkipped('water', 'water', reason, 'water');
            }
            if (global.GaipOrchestrator && typeof global.GaipOrchestrator.recordProblem === 'function') {
                global.GaipOrchestrator.recordProblem('water',
                    'The water sample this run was asked for (' + requestedId + ') could not be used: ' + reason);
            }
        } catch (e) { /* bookkeeping must not stop a run */ }
        console.warn('[GilbaPersist] requested water sample unusable:', requestedId, reason);
    }

    var RUN_BUDGET_MS = 15000;

    if (_runIntent) {
        /**
         * GH-588 (link 4) — WHAT THIS RUN WAS TOLD ABOUT THE SOIL SAMPLE.
         *
         * The opener asks the server BEFORE the runner starts and puts the
         * answer here: an id, `none`, or `unknown`. The runner never guesses.
         *
         * THREE STATES, and the first and the third must not look alike:
         *   `none`      nothing to wait for. Compute what can be computed and
         *               say the soil was not computed BECAUSE THERE IS NO
         *               SAMPLE. The run COMPLETES — the numbers it did produce
         *               are real and are stored — and nothing suggests pressing
         *               again, because pressing again would change nothing.
         *   `<id>`      the run must have it. Arrived: compute in full. Not
         *               arrived inside the budget: the run FAILS with a delivery
         *               reason, nothing is written, the previous numbers stay on
         *               screen, and pressing again is worth doing.
         *   `unknown`   the question could not be put. Treated as `<id>` — wait
         *               and, failing, report delivery — because assuming "none"
         *               would turn a failed request into "you have no sample".
         *
         * WHY WAIT AT ALL, in the owner's words on 23.09.2026: "we have to wait,
         * because if we have no sample then all the data will be computed
         * wrongly". A run on a sample that has not arrived produces WRONG
         * NUMBERS, not empty ones — which is what the ten "NOT MEASURED" cards
         * over a sample holding K 40, Ca 803 were.
         */
        var _soilExpected = (function () {
            try {
                var v = new URLSearchParams(window.location.search || '').get('soil');
                if (v === 'none') return { expect: false, id: null, told: 'none' };
                if (v && v !== 'unknown') return { expect: true, id: v, told: 'id' };
                if (v === 'unknown') return { expect: true, id: null, told: 'unknown' };
                // NO PARAMETER AT ALL is an opener that never asked — the export
                // and report pages open `/hub` without one, and so did every
                // opener before GH-588. It CANNOT be gated: gating on a fact
                // nobody supplied means waiting for something nobody promised,
                // and the run would never complete. Measured the hard way: the
                // first draft treated it like `unknown` and twenty-four runner
                // tests stopped writing a result at all.
                return { expect: false, id: null, told: 'absent' };
            } catch (e) {
                return { expect: false, id: null, told: 'absent' };
            }
        })();
        var _soilReady   = !_soilExpected.expect;   // nothing to wait for when there is none
        var _soilReadyAt = 0;

        /**
         * GH-589 (link 4) — AND A CASCADE PASS THAT RAN BEFORE THE SAMPLE
         * IS NOT A RESULT EITHER.
         *
         * GH-588 made this runner wait for the sample to ARRIVE. It waits, and
         * then it stores numbers computed before it arrived: the cascade runs
         * once inside the run button's handler, on a state collected at the
         * press, and the samples land about two seconds later. The row that
         * came out of that is `analysis_results` id 31 — ten nutrient cards
         * reading "NOT MEASURED" over a sample holding K 40, Ca 803, CEC 5.9.
         *
         * So completion gains the condition the weather already has (section
         * 15): the pass that produced these numbers must have BEGUN after the
         * input arrived.
         *
         * `false` UNTIL A PASS SAYS OTHERWISE, deliberately. A page that never
         * dispatches `gaip:cascade-complete` has no cascade at all, and gating
         * on a fact nobody supplies is how GH-588's first draft stopped
         * twenty-four runs from writing anything. What is refused here is a
         * pass we have SEEN and know to be older than its inputs.
         */
        var _cascadeStale  = false;
        var _cascadePassAt = 0;

        var _weatherReady    = false;
        var _weatherReadyAt  = 0;
        var _orchestratorDone = false;
        // GH-557 (section 15): what the completing pass could not compute.
        // Empty on a pass that computed everything; the server reads it to
        // decide the run's outcome, so it travels with the body rather than
        // staying in the browser's console.
        var _passSkipped  = [];
        var _passWarnings = [];
        var _runReported     = false;
        // Set SYNCHRONOUSLY when the write begins, not when it answers.
        // `_writeResult` awaits the bounded normals wait before it posts, and
        // two of the three completion events can arrive inside that gap — the
        // orchestrator's and the analysis's — so a latch that only closed on the
        // server's reply let both through and sent the same result twice. Found
        // by the sandbox, not by reading.
        var _writeStarted    = false;

        /**
         * One exit, whichever way the run ended.
         *
         * `gilba:analysis-complete` and `gilba:analysis-failed` are both objects
         * now, carrying the run they are about. The openers used to compare
         * `e.data` with a string and reload on anything that matched; a failure
         * had no way to say so, so a run that never happened arrived as a
         * successful one.
         */
        function _report(type, extra) {
            if (_runReported) return;
            _runReported = true;
            clearTimeout(_runDeadline);
            var message = { type: type, runId: _runIntent.runId, siteId: _runIntent.siteId };
            if (extra) { Object.keys(extra).forEach(function (k) { message[k] = extra[k]; }); }
            try { window.parent.postMessage(message, window.location.origin); } catch (e) {}
        }

        /**
         * GH-548 (stage 3): where the CSRF token and the API root come from.
         * Both writes need them, so they are read in one place rather than twice.
         */
        function _api() {
            return {
                csrf: (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.csrfToken)
                      || ((document.querySelector('meta[name="csrf-token"]') || {}).content) || '',
                root: (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.restUrl) || '/api/',
            };
        }

        /**
         * A run that did not finish says so ON THE SERVER, not just in a console.
         *
         * GH-548 (stage 3). Until now the reason reached `console.warn` and
         * `window.GilbaRerunOutcome` in the tab that pressed the button — gone on
         * the next reload, absent on a second device, and absent for whoever opens
         * the dashboard tomorrow and reads last week's figures as today's. The
         * report goes into the same row as the numbers, so every screen that
         * prints the numbers prints the reason with them.
         *
         * It writes the REASON ONLY: the server does not touch `metrics`,
         * `computed` or their date (`AnalysisResults::recordFailure`). The
         * previous result is kept deliberately — the owner's decision — but it is
         * no longer kept silently.
         */
        function _fail(reason, detail) {
            if (_runReported) return;
            console.warn('[GilbaRun] not completed:', reason, detail || '');

            var api = _api();
            try {
                fetch(api.root + 'analysis-cache/runs', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': api.csrf, 'Accept': 'application/json' },
                    body: JSON.stringify({
                        site_id: _runIntent.siteId,
                        run_id:  _runIntent.runId,
                        outcome: 'failed',
                        reason:  reason,
                        detail:  detail || null,
                    }),
                    // The frame is removed as soon as the opener hears from us,
                    // which can be before a plain fetch has been sent.
                    keepalive: true,
                }).catch(function (e) {
                    console.warn('[GilbaRun] could not report the failure:', e && e.message);
                });
            } catch (e) {
                console.warn('[GilbaRun] could not report the failure:', e && e.message);
            }

            _report('gilba:analysis-failed', { reason: reason, detail: detail || null });
        }

        // GH-251 keeps its invariant: the monthly normals get a BOUNDED chance to
        // arrive before the result is built. The fetch chain in
        // climate-normals-service.js has no timeout of its own, so an unbounded
        // wait here would stall the whole run on one field.
        function _withTimeout(promise, ms) {
            return Promise.race([
                promise,
                new Promise(function (resolve) { setTimeout(resolve, ms); })
            ]);
        }
        async function _ensureMonthlyNormalsBounded() {
            try {
                var svc = window.GilbaClimateNormalsService;
                if (svc && typeof svc.ensureFromPage === 'function') {
                    await _withTimeout(svc.ensureFromPage(), 4000);
                }
            } catch (e) {
                console.warn('[GilbaRun] ensureFromPage (monthly normals) failed, proceeding without it:', e);
            }
        }

        /**
         * GH-553 — THE BODY IS BUILT FROM THE DECLARED FORM, NOT FROM WHAT THE
         * ENGINES HAPPENED TO ANSWER.
         *
         * What it replaces, and it is measured rather than argued: on 22.09.2026
         * a real Re-run on Federal Golf wrote SIX of the thirteen required keys
         * with `outcome = 'complete'`. Its disease and stress engines had
         * returned null, and `collectDashboardMetrics()` adds a key only inside
         * `if (source)` — so seven keys did not travel as `null`, they did not
         * travel at all, and nothing downstream could tell a run that measured
         * nothing from a run that had nothing to measure.
         *
         * The plan's section 3 point 4 in one line: a key the run could not
         * produce is sent as `null`, so "twelve keys" cannot be expressed.
         *
         * WHERE THE LIST COMES FROM. `window.GAIP_ANALYSIS_SCHEMA`, rendered by
         * the server out of `assets/analysis-result.schema.json` — the same file
         * the server validates against. Not a copy of the names in this file: two
         * lists of thirteen drift, and this whole question began with a form
         * nobody owned.
         *
         * WHAT IS NOT FILLED IN. `conditional` keys (`companionDisease`, `vwc`)
         * are absent when their condition does not hold — a companion surface, a
         * sensor — and `branchDependent` ones (`gdd`, `et`) belong to whichever
         * climate branch fired. Padding those with `null` would state that a
         * sensor was read and gave nothing.
         *
         * NO SCHEMA, NO RUN. If the page was not given the form, the run reports
         * `schema-unavailable` and writes nothing. The alternative is to fall
         * back to the old behaviour, which is this defect with a fallback in
         * front of it — and a silent one, since the body would look exactly as
         * it does today.
         */
        function _bodyMetrics(raw) {
            var schema = window.GAIP_ANALYSIS_SCHEMA;
            var required = schema && schema.metrics && schema.metrics.required;
            if (!Array.isArray(required) || !required.length) return null;

            var out = {};
            // Declared first, in the schema's own order, so a stored row reads
            // the way the form reads.
            required.forEach(function (key) {
                out[key] = (raw && raw[key] !== undefined) ? raw[key] : null;
            });
            // Then everything the run did produce that the form does not require
            // -- conditional keys, branch-dependent ones, anything new. Dropping
            // them would make this function a filter, and a body that silently
            // loses a value is the same defect pointing the other way.
            Object.keys(raw || {}).forEach(function (key) {
                if (!(key in out)) out[key] = raw[key];
            });
            return out;
        }

        /** The one write. Reached only when the run completed. */
        async function _writeResult() {
            if (_runReported || _writeStarted) return;
            _writeStarted = true;

            await _ensureMonthlyNormalsBounded();

            // GH-298 keeps its invariant: the monthly-N render is forced here,
            // immediately before the one save that persists, rather than left to
            // whichever reactive listener did or did not fire in time.
            try {
                if (window.GilbaNutritionSummary && typeof window.GilbaNutritionSummary.renderNutritionSummary === 'function') {
                    window.GilbaNutritionSummary.renderNutritionSummary();
                }
            } catch (e) {
                console.warn('[GilbaRun] renderNutritionSummary (monthly N) failed, proceeding without it:', e);
            }

            var snap = cacheAnalysisResults();

            var metrics = _bodyMetrics(snap.dashboard);
            if (!metrics) {
                _fail('schema-unavailable', { reason: 'GAIP_ANALYSIS_SCHEMA was not on the page' });
                return;
            }

            // The site is the one the opener named. It is NOT taken from
            // GAIP_HUB_CONFIG.activeSiteId: the pointer belongs to whatever the
            // user is looking at now, and this result belongs to the site the
            // button was pressed for.
            var siteId = _runIntent.siteId;

            var api = _api();

            // GH-557 (section 15): the account of the pass travels with its
            // result. `nulls` is what the body itself shows and the server
            // recomputes rather than trusts — it is here so the two can be
            // compared, not so the server can be told.
            var _nulls = Object.keys(metrics).filter(function (k) { return metrics[k] === null; });

            // GH-581 (stage 2) — WHAT THE RUN WAS GIVEN, AND WHAT IT
            // ASSUMED, travelling with what it produced.
            //
            // The row said what the run COULD NOT DO (`nulls`, `skipped`) and
            // what it SAID (`warnings`), and nothing about what it was handed.
            // Two runs, one on live weather and one on a week-old cache, one on
            // a site with a rootzone profile and one where the profile was
            // filled in with "unknownProfile", were indistinguishable in the
            // stored result and on the screen. The numbers differ; the account
            // of them did not.
            //
            // `inputs` is what arrived. `assumptions` is what was put in place
            // of something that did not, taken from the identity enforcer's own
            // list rather than re-derived here — it already records the key, the
            // value it assumed, the impact and, since GH-581, where a person
            // sets it. It is NOT the same list as `skipped`: an assumption is a
            // run that went ahead on a stand-in, a skip is a part that did not
            // run at all, and collapsing them would lose exactly the difference
            // the reader needs.
            var _inputs = (function () {
                try {
                    var w = global.rawWeatherData || null;
                    var out = {
                        weather: {
                            status:    (w && w._weatherStatus) || (global.climateMetrics ? 'cached' : 'none'),
                            source:    (snap.dashboard && snap.dashboard.weatherSource) || null,
                            readyAt:   _weatherReadyAt || null,
                        },
                        normals: {
                            present: !!(global.climateMetrics && global.climateMetrics.monthlyTemps),
                            source:  (global.climateMetrics && global.climateMetrics.monthlyTempsSource) || null,
                        },
                        samples: {},
                        sensors: { vwc: null, soilTemp: null },
                    };
                    ['soil', 'water', 'tissue'].forEach(function (type) {
                        try {
                            var SM = global.GAIP_SampleManager;
                            var a = (SM && typeof SM.getActiveSample === 'function') ? SM.getActiveSample(type) : null;
                            // The sample's IDENTITY, not its numbers: the numbers
                            // are already in the result, and a second copy of them
                            // would be a second source.
                            out.samples[type] = a ? (a.id || null) : null;
                        } catch (e) { out.samples[type] = null; }
                    });
                    try {
                        var st = global.GAIP_SOIL_TEMP && global.GAIP_SOIL_TEMP.summary;
                        out.sensors.soilTemp = st && st.available ? (st.source || 'sensor') : null;
                        out.sensors.vwc = (global.GAIP_SENSOR_VWC != null) ? 'sensor' : null;
                    } catch (e) { /* a sensor that is not there is not an error */ }
                    return out;
                } catch (e) {
                    // An input record that could not be assembled is absent, not
                    // invented: `null` says "not recorded", which is true.
                    return null;
                }
            })();

            // GH-588 — STATE 1: this site has no soil sample at all.
            //
            // The run completes: the numbers it produced are real and are
            // stored. The soil part is named as not computed, with a reason that
            // tells the reader what to DO — add a soil sample — and, unlike the
            // delivery failure, nothing suggests pressing Re-run, because
            // pressing it again would change nothing.
            if (_soilExpected.told === 'none') {
                try {
                    if (global.GaipOrchestrator && typeof global.GaipOrchestrator.noteSkipped === 'function') {
                        global.GaipOrchestrator.noteSkipped('mlsn', 'mlsn', 'no-soil-sample', 'mlsn');
                    }
                } catch (e) { /* bookkeeping must not stop a run */ }
            }

            var _assumptions = (function () {
                try {
                    var IE = global.GilbaIdentityEnforcement;
                    var st = (IE && typeof IE.getIdentityState === 'function') ? IE.getIdentityState() : null;
                    return (st && Array.isArray(st.assumptions)) ? st.assumptions : [];
                } catch (e) {
                    return [];
                }
            })();

            fetch(api.root + 'analysis-cache', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': api.csrf, 'Accept': 'application/json' },
                body: JSON.stringify({
                    site_id:     siteId,
                    detail: {
                        nulls:       _nulls,
                        skipped:     _passSkipped,
                        warnings:    _passWarnings,
                        assumptions: _assumptions,
                    },
                    // GH-581: the column has existed since GH-550 and has been
                    // written `null` ever since, because nothing sent it.
                    inputs:      _inputs,
                    // GH-548 (stage 3): the result is signed by the run that
                    // produced it. The row could not say which run its numbers
                    // came from, so a failure mark and a set of numbers had no way
                    // of being about the same attempt.
                    run_id:      _runIntent.runId,
                    analyzed_at: (snap.dashboard && snap.dashboard.timestamp) || snap.cachedAt || new Date().toISOString(),
                    metrics:     metrics,
                    computed:    snap.computed || null,
                }),
            }).then(function (r) {
                // A refusal is a failure of the run, not a detail of it. The old
                // code signalled the parent to reload on both answers, including
                // the 403 a viewer now gets, so the page reloaded onto the
                // previous result believing it was the new one.
                if (!r.ok) {
                    // GH-553: a 422 names the keys it refused the body for, and
                    // that list is what the screen needs — "the server refused
                    // the result" says nothing a person can act on.
                    if (r.status === 422) {
                        r.json().then(function (j) {
                            _fail('incomplete-result', { status: 422, keys: (j && j.missing) || null });
                        }).catch(function () {
                            _fail('incomplete-result', { status: 422 });
                        });
                        return;
                    }
                    _fail('rejected', { status: r.status });
                    return;
                }
                // GH-557: the server decides the outcome from the data, and the
                // opener is told which one it was. A partial run does NOT
                // reload the page — the same rule as a failure (GH-548): the
                // numbers on screen are still the last complete ones, and
                // reloading onto a partial result would replace them with
                // blanks.
                r.json().then(function (j) {
                    var outcome = (j && j.outcome) || 'complete';
                    if (outcome === 'partial') {
                        _report('gilba:analysis-partial', {
                            skipped: _passSkipped,
                            nulls:   _nulls,
                        });
                    } else {
                        _report('gilba:analysis-complete');
                    }
                }).catch(function () {
                    _report('gilba:analysis-complete');
                });
            }).catch(function (e) {
                _fail('rejected', { message: e && e.message });
            });
        }

        function _maybeComplete() {
            // GH-588: a third condition, built the way the weather's was. When
            // the run was told there IS a soil sample, a pass that finished
            // before it arrived is the same stale pass the weather rule already
            // refuses — and the numbers it produced are wrong rather than
            // missing, which is why it is refused rather than stored.
            if (_runReported || _writeStarted || !_weatherReady || !_orchestratorDone || !_soilReady) return;
            // GH-589: and the cascade's own pass, which is where the nutrient
            // list is computed. The soil having arrived says nothing about
            // which state the list was built on.
            if (_cascadeStale) return;
            _writeResult();
        }

        /**
         * GH-589: a cascade pass, weighed against the moment its inputs arrived.
         *
         * The runner holds `_soilReadyAt` already — the moment the STORE was
         * found to hold the sample, not the moment an event said so — so the
         * comparison is against a fact. A pass that began before it is stale and
         * the run waits for the next one; a pass that began after it clears the
         * mark.
         */
        function _judgeCascadePass(startedAt) {
            if (!_soilExpected.expect || !_soilReadyAt) { _cascadeStale = false; return; }
            _cascadeStale = (startedAt === null || startedAt < _soilReadyAt);
        }

        document.addEventListener('gaip:cascade-complete', function (e) {
            var d = (e && e.detail) || {};
            _cascadePassAt = typeof d.passStartedAt === 'number' ? d.passStartedAt : null;
            _judgeCascadePass(_cascadePassAt);
            if (_cascadeStale) {
                console.warn('[GilbaRun] a cascade pass that began before the soil sample arrived is not this run\'s result');
                return;
            }
            _maybeComplete();
        });

        /**
         * GH-588: the site's soil samples have arrived.
         *
         * `gaip:site-samples-ready` announces the load; the FACT is whether the
         * store now holds one, and the two are not the same — measured on
         * 22.09.2026, the event precedes the store by enough for a whole pass to
         * run in between. So the event is only the prompt to look.
         */
        function _soilSampleState() {
            try {
                var SM = global.GAIP_SampleManager;
                var a = (SM && typeof SM.getActiveSample === 'function') ? SM.getActiveSample('soil') : null;
                // GH-604 — THE TWIN OF THE GATE, AND THE SAME TWO DEAD BRANCHES.
                //
                // This read `a.normalized || a.rawData || a.values`, exactly as
                // `_gaipSoilSampleReadyOrGivenUp` did before GH-600, and it is
                // not three ways of finding a sample: `normalized` is set on
                // every path that creates one, so the first branch is always
                // taken and the other two are unreachable. What it really asked
                // was `Object.keys(a.normalized).length` — a read of the
                // derived, lossy copy where soil pH lives as `soil_ph`, which is
                // the read that cost a measured pH in GH-591.
                //
                // Behaviour is unchanged today, measured: of the 48 live soil
                // samples all 48 carry at least one column the map names, so
                // there is no sample on which the two answers differ.
                //
                // GH-612 — THE TWO STATES ARE TOLD APART NOW, IN THE DATA.
                //
                // A sample whose columns the map does not know used to report
                // exactly what a sample that never arrived reports, and the run
                // failed with `soil-sample-not-delivered` — untrue, because it
                // WAS delivered. `_soilSampleState()` answers both questions
                // separately, and the failure carries the answer in its detail.
                //
                // THE SENTENCE A PERSON READS IS UNCHANGED, deliberately: the
                // failure code is still `soil-sample-not-delivered`, so the
                // panel says today what it said this morning. A third reason
                // needs a third sentence, that sentence has one author, and he
                // has not written it. `detail` is where this goes because
                // `AnalysisNotice::detailText()` prints detail for four codes
                // and this is not one of them — so the record gains a fact and
                // the client gains no new words. The screen half is open and
                // named in the queue.
                var readings = (a && SM && typeof SM.readingsOf === 'function')
                    ? SM.readingsOf('soil', a) : null;
                return {
                    delivered: !!a,
                    readings: readings ? Object.keys(readings).length : 0,
                };
            } catch (e) {
                return { delivered: false, readings: 0 };
            }
        }

        /** The question the run used to ask, answered from the state above. */
        function _soilSampleHasArrived() {
            return _soilSampleState().readings > 0;
        }

        function _noteSoilArrived() {
            if (_soilReady || !_soilExpected.expect) return;
            if (!_soilSampleHasArrived()) return;
            _soilReady = true;
            _soilReadyAt = Date.now();
            // GH-589: a pass already seen is judged again now that there is a
            // moment to judge it against. Until this line there was none, so
            // the pass could not have been called stale when it arrived.
            if (_cascadePassAt !== 0) _judgeCascadePass(_cascadePassAt);
            _maybeComplete();
        }

        document.addEventListener('gaip:site-samples-ready', _noteSoilArrived);
        // The event can precede the store, so the fact is also polled. This is
        // not a second budget: it stops at the run's own, the same fifteen
        // seconds the weather is allowed.
        if (_soilExpected.expect) {
            var _soilPollStartedAt = Date.now();
            var _soilPoll = setInterval(function () {
                _noteSoilArrived();
                if (_soilReady || Date.now() - _soilPollStartedAt >= RUN_BUDGET_MS) clearInterval(_soilPoll);
            }, 100);
        }

        document.addEventListener('gaip:weather-ready', function () {
            _weatherReady = true;
            if (!_weatherReadyAt) _weatherReadyAt = Date.now();
            _maybeComplete();
        });

        /**
         * GH-557 (section 15) — A PASS THAT RAN BEFORE THE WEATHER IS NOT
         * COMPLETION.
         *
         * `_orchestratorDone` used to be set by ANY `orchestrator-complete`,
         * including the pass that finished while the weather fetch was still in
         * flight. In that pass the disease step skips itself for want of a
         * temperature, the forecast step skips behind it, and the orchestrator
         * re-runs once the weather lands — but the runner had already posted the
         * first pass's body. That is Federal Golf's row: a pass without climate,
         * stored as a completed analysis.
         *
         * The condition is an EVENT, not a timer: the pass must have STARTED
         * after the weather was ready. A pass that started earlier and happened
         * to finish later is the same stale pass.
         *
         * A build of the orchestrator that does not say when its pass began
         * cannot be told apart, so it is accepted — with the gap recorded, so
         * that "we could not check" is distinguishable from "we checked".
         */
        document.addEventListener('gaip:orchestrator-complete', function (e) {
            var d = (e && e.detail) || {};
            var startedAt = typeof d.passStartedAt === 'number' ? d.passStartedAt : null;

            // A pass that ENDS before the weather has arrived began before it
            // too, whatever it says about itself — and this is the common case,
            // because the first pass runs on page load while the fetch is in
            // flight. Checked first, because `passStartedAt` cannot help here:
            // there is no weather timestamp yet to compare it with.
            if (!_weatherReady) {
                console.warn('[GilbaRun] ignoring an orchestrator pass that finished before the weather arrived');
                return;
            }

            // And a pass that began before the weather but finished after it is
            // the same stale pass wearing better timing.
            if (startedAt !== null && _weatherReadyAt && startedAt < _weatherReadyAt) {
                console.warn('[GilbaRun] ignoring an orchestrator pass that began before the weather arrived');
                return;
            }

            // GH-588: and the same for the soil sample, when the run was told
            // there is one. This is the pass that produced ten "NOT MEASURED"
            // cards over a sample holding K 40 and Ca 803 — it did not lack the
            // numbers, it had the wrong ones.
            if (_soilExpected.expect && !_soilReady) {
                console.warn('[GilbaRun] ignoring an orchestrator pass that finished before the soil sample arrived');
                return;
            }
            if (_soilExpected.expect && startedAt !== null && _soilReadyAt && startedAt < _soilReadyAt) {
                console.warn('[GilbaRun] ignoring an orchestrator pass that began before the soil sample arrived');
                return;
            }

            _orchestratorDone = true;
            _passSkipped  = Array.isArray(d.skipped) ? d.skipped : [];
            _passWarnings = Array.isArray(d.warnings) ? d.warnings : [];
            if (startedAt === null) {
                _passSkipped = _passSkipped.concat([{
                    step: 'orchestrator', module: 'orchestrator', reason: 'pass-start-unknown',
                }]);
            }
            _maybeComplete();
        });

        // The analysis reporting on itself. `detail.error` is the catch branch of
        // hub-tissue-v3.js, which until now also raised an `alert()` inside a
        // hidden iframe -- a dialog nobody could reach, stopping that frame's
        // JavaScript with it.
        document.addEventListener('gaip:analysis-complete', function (e) {
            var d = (e && e.detail) || {};
            if (d.error) {
                _fail('calculation-error', { message: d.message || null });
                return;
            }
            // GH-557: this is the analysis reporting on itself, not an
            // orchestrator pass, and it no longer sets `_orchestratorDone`.
            //
            // It used to — which made it a second door into the same gate, and
            // the door the listener above had just locked. A stale pass rejected
            // there walked in here a moment later and the run completed on it
            // anyway. Found by the case that rejects a pass which BEGAN before
            // the weather: the rejection worked and the run wrote regardless.
            //
            // Completion is still three events; what counts as the second one is
            // now an orchestrator pass that began after the weather, which is
            // what it was always meant to be.
            _maybeComplete();
        });

        // The run cannot start at all when the site's settings did not load:
        // computing on the form's own defaults produces figures that look
        // measured (GH-441).
        document.addEventListener('gaip:site-config-failed', function (e) {
            _fail('site-settings-unavailable', { reason: (e && e.detail && e.detail.reason) || null });
        });

        var _runDeadline = setTimeout(function () {
            // GH-557: a run that had its weather and never saw a pass started
            // after it is a named case, not a generic timeout — it is the exact
            // shape that produced Federal Golf's row, and the reader is told so.
            // GH-588: the DELIVERY failure — state 3 — named before the
            // generic ones, because it is the one with an action attached. The
            // run was told this site has a soil sample and it never arrived;
            // pressing Re-run again is worth doing, which is exactly what
            // distinguishes it from a site that has no sample at all (state 1,
            // which completes and never reaches here).
            if (_soilExpected.expect && !_soilReady) {
                // GH-612: WHICH of the two it was, recorded beside the code.
                // `delivered: true` with `readableColumns: 0` is the sample that
                // arrived and could not be read — a different fact from a
                // sample that never came, and until now the row said neither.
                var _soilState = _soilSampleState();
                _fail('soil-sample-not-delivered', {
                    soilSampleId: _soilExpected.id,
                    toldBy: _soilExpected.told,
                    weatherReady: _weatherReady,
                    orchestratorDone: _orchestratorDone,
                    delivered: _soilState.delivered,
                    readableColumns: _soilState.readings,
                });
                return;
            }
            // GH-589: the sample arrived and no cascade pass began after it
            // inside the budget. This is NOT a failure — the rest of the run is
            // real and is stored — it is the third outcome: the soil part is
            // named as not computed, with the reason, the server reads that and
            // returns `partial`, and the previous complete numbers are not
            // replaced by this one.
            if (_cascadeStale) {
                try {
                    if (global.GaipOrchestrator && typeof global.GaipOrchestrator.noteSkipped === 'function') {
                        global.GaipOrchestrator.noteSkipped('mlsn', 'mlsn', 'soil-sample-not-loaded', 'mlsn');
                    }
                } catch (e) { /* bookkeeping must not stop a run */ }
                // The gap is named now, so it no longer holds the write back:
                // holding it further would turn a partial result into nothing
                // at all.
                _cascadeStale = false;
                _maybeComplete();
                if (_writeStarted) return;
            }
            // GH-557: a run that had its weather and never saw a pass started
            // after it is a named case, not a generic timeout — it is the exact
            // shape that produced Federal Golf's row, and the reader is told so.
            if (_weatherReady && !_orchestratorDone) {
                _fail('climate-late', {
                    weatherReadyAt: _weatherReadyAt || null,
                    note: 'no orchestrator pass began after the weather arrived inside the run budget',
                });
                return;
            }
            _fail('run-not-completed', {
                weatherReady: _weatherReady,
                orchestratorDone: _orchestratorDone,
            });
        }, RUN_BUDGET_MS);
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
                // GH-536 (PLAN-samples-sync-FINAL, stage 3): `samples`
                // ('gilba_hub_samples') is gone. It was this file's own copy of
                // the sample collection, separate from sample-persistence.js's
                // `gilba_samples` and written from the same store.
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
        
        // Soil/water/tissue are intentionally NOT restored here. This state blob
        // is keyed only by userId (CONFIG.keys.state), not by site, so it holds
        // whichever site's form was last saved - restoring it unconditionally
        // overwrites the DOM with a *different* site's sample data after a site
        // switch (this ran on its own timer, uncoordinated with and often after
        // GAIP_SampleManager's site-scoped reloadActiveSample(), so it would win
        // and silently replace correct data with stale cross-site leftovers).
        // GAIP_SampleManager is the authoritative, site-scoped source for these
        // three - see reloadActiveSample() in site-selector-ui.js, which already
        // loads the active site's own sample (or correctly clears the form when
        // the site has none) for exactly these types: soil, water, tissue, loi.

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

    // GH-536 (PLAN-samples-sync-FINAL, stage 3): collectSamples() and
    // restoreSamples() are gone. collectSamples() read the whole collection out
    // of SampleManager and handed it to a localStorage write; restoreSamples()
    // pushed a parsed copy back into the store. The samples are read from
    // GET /api/samples by sample-persistence.js and written one record at a
    // time by the same file (GH-533). Nothing else restores them.

    // =========================================================================
    // ANALYSIS CACHE (For Dashboard)
    // =========================================================================

    /**
     * GH-589 (link 4, point 4a): the tissue result of THIS run's last
     * cascade pass.
     *
     * One author. `window.__GAIP_TISSUE_LAST__`, which this replaces, is
     * written by the cascade's tissue engine AND by the screen module
     * `tissue-ui.js`, and whichever wrote last won the stored row — so a row's
     * tissue block belonged to whatever had happened on the page most recently
     * rather than to the run the row is about.
     */
    function _cascadeTissueOfThisRun() {
        try {
            var pass = global.GAIP_LAST_CASCADE_PASS;
            var computed = pass && pass.result && pass.result.state && pass.result.state.computed;
            return (computed && computed.tissue) || null;
        } catch (e) {
            return null;
        }
    }

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

        // Save physics-model soil temp for growth-light analysis page.
        // GAIP_SOIL_TEMP is set by climate-module-v2-ui.js renderSoilTempPanel() during hub run.
        // Save only .summary (depths + thermalProps) — not the raw hourly arrays which are large.
        if (global.GAIP_SOIL_TEMP && global.GAIP_SOIL_TEMP.summary && global.GAIP_SOIL_TEMP.summary.available) {
            cache.computed = Object.assign({}, cache.computed || {});
            cache.computed.soilTempPhysics = {
                summary:     global.GAIP_SOIL_TEMP.summary,
                profileType: global.GAIP_SOIL_TEMP.profileType,
                computed:    global.GAIP_SOIL_TEMP.computed
            };
        }

        // Augment computed.climate with Climate V2 dual metrics (daily GP chips + trend text).
        // GAIP_CLIMATE_V2_RESULT.dualMetrics has .daily[], .trajectory, .current, .outlook
        // which are not captured by the orchestrator's computed state.
        const _v2 = global.GAIP_CLIMATE_V2_RESULT;
        if (_v2 && _v2.dualMetrics && _v2.dualMetrics.available) {
            cache.computed = Object.assign({}, cache.computed || {});
            cache.computed.climate = Object.assign({}, cache.computed.climate || {});
            cache.computed.climate.dualMetrics     = _v2.dualMetrics;
            cache.computed.climate.outlookHeadline = _v2.outlookHeadline || null;
        }

        // Also save today's temperature mean from climateMetrics for the "today's GP" context line.
        const _liveClimate = global.climateMetrics;
        if (_liveClimate && _liveClimate.temperature) {
            cache.computed = Object.assign({}, cache.computed || {});
            cache.computed.climate = Object.assign({}, cache.computed.climate || {});
            cache.computed.climate.temperature = _liveClimate.temperature;
        }

        // Reconstruct dailyPattern and forecast.temp.insight from raw weather data.
        // validateClimateMetrics strips these fields, so we recalculate them here
        // using the globally-available climate-engine.js functions.
        var _raw = global.rawWeatherData;
        if (_raw && _raw.forecast && _raw.forecast.hourly &&
            typeof aggregateHourlyToDaily === 'function' &&
            typeof calculateGrowthMetrics === 'function' &&
            typeof calculateForecastInsights === 'function') {
            try {
                var _dailyRows = aggregateHourlyToDaily(_raw.forecast.hourly);
                // Build a minimal state with species fractions for calculateGrowthMetrics
                var _orcState = global.GaipOrchestrator && typeof global.GaipOrchestrator.getState === 'function'
                    ? global.GaipOrchestrator.getState() : null;
                var _fracs = (_orcState && _orcState.turf && _orcState.turf.speciesFractions)
                    || (global.GAIP_STATE && global.GAIP_STATE.turf && global.GAIP_STATE.turf.speciesFractions)
                    || null;
                var _c3f = (_fracs && _fracs.c3Fraction != null) ? _fracs.c3Fraction
                    : (global.GAIP_STATE && global.GAIP_STATE.turf && global.GAIP_STATE.turf.c3Fraction != null)
                    ? global.GAIP_STATE.turf.c3Fraction : 1;
                var _c4f = (_fracs && _fracs.c4Fraction != null) ? _fracs.c4Fraction
                    : (1 - _c3f);
                var _minimalState = { turf: { species: { c3Fraction: _c3f, c4Fraction: _c4f } } };
                // GH-605 — THE TWENTY DEGREES HERE REACHES NOTHING, AND THAT IS
                // MEASURED RATHER THAN ASSUMED.
                //
                // It looks like the substitution the project bans: no mean
                // temperature for today, so 20 °C goes in and the run computes
                // on it. Traced through: `calculateGrowthMetrics(mean, state,
                // rows)` uses `mean` ONLY for its top-level `weighted`, `c3`,
                // `c4`, `gdd` and `status`; its `dailyPattern` is built from the
                // daily rows, each day from its OWN mean. And the block below
                // takes exactly one field off the result — `dailyPattern`. So
                // the invented number feeds five fields that are computed and
                // thrown away, and no stored row has ever carried it.
                //
                // LEFT AS IT IS, DELIBERATELY. Making it `null` would drop
                // `dailyPattern` on any run without a today-mean — real figures,
                // built from real daily rows, deleted to avoid a number that
                // never leaves this function. The trap is that the five fields
                // are one read away from becoming live, and that is named in the
                // queue rather than repaired by losing data.
                var _todayMean = (_liveClimate && _liveClimate.temperature && _liveClimate.temperature.todayMean != null)
                    ? _liveClimate.temperature.todayMean : 20;
                var _growthFull = calculateGrowthMetrics(_todayMean, _minimalState, _dailyRows);
                var _forecastFull = calculateForecastInsights(_dailyRows, _minimalState);
                if (_growthFull && Array.isArray(_growthFull.dailyPattern) && _growthFull.dailyPattern.length > 0) {
                    cache.computed = Object.assign({}, cache.computed || {});
                    cache.computed.climate = Object.assign({}, cache.computed.climate || {});
                    // Orchestrator stores weighted/c3/c4 under 'growth' OR 'growthPotential' (see
                    // growth-light-analysis.js buildClimateView). Merge dailyPattern into whichever
                    // already holds that data — writing a bare 'growth' object here would shadow
                    // 'growthPotential' downstream and make the page think no analysis ran.
                    var _existingGrowth = (cache.computed.climate.growth && cache.computed.climate.growth.weighted !== undefined)
                        ? cache.computed.climate.growth
                        : cache.computed.climate.growthPotential;
                    cache.computed.climate.growth = Object.assign({}, _existingGrowth || {}, {
                        dailyPattern: _growthFull.dailyPattern
                    });
                    // GH-249: a previous fix here (GH-223) pinned dailyPattern[0] to
                    // _existingGrowth (climateMetrics.growth, which hub-tissue-v3.js's
                    // Climate V2 override computes from the CURRENT-HOUR temperature —
                    // see climate-module-v2.js calculateDroughtStress(), "FIX v10.9.5:
                    // use current hour temp, not multi-day mean"). That pin was based on
                    // a mistaken premise: its comment claimed dailyPattern[0] was "freshly
                    // rebuilt from _todayMean" and could drift from a fragile global read.
                    // It isn't — calculateGrowthMetrics()'s dailyPattern (climate-engine.js)
                    // is built entirely from _dailyRows (each day mapped to its own
                    // e.temp.mean); the _todayMean parameter only feeds the function's
                    // separate top-level weighted/c3/c4/gdd summary fields, which nothing
                    // reading dailyPattern[0] ever consumes. _dailyRows itself comes from
                    // global.rawWeatherData, which is only ever overwritten on a
                    // successful fetch (hub-tissue-v3.js:6462) — never silently emptied —
                    // so dailyPattern[0] was already exactly as stable as dailyPattern[1..7].
                    // The pin's real effect was to override a stable, daily-mean-based
                    // "today" (matching GH-183's explicit PACE-model requirement: GP is a
                    // daily metric, must use the daily mean, not current-hour temperature)
                    // with an unstable, current-hour-based one that changes throughout the
                    // day and disagreed with its own displayed temperature label. No pin
                    // needed — leave dailyPattern (all 8 days, uniformly daily-mean based)
                    // exactly as calculateGrowthMetrics() built it.

                    // GH-250: current month's climate-normal GP, for the "Growth &
                    // Temperature" panel to show alongside the live 8-day forecast
                    // (today's actual weather vs. the 20-year seasonal baseline for
                    // this month) — reuses calculateWeightedGrowth() (climate-engine.js),
                    // the same function dailyPattern entries are built with, just fed
                    // the NASA POWER monthly normal temperature instead of a forecast
                    // day's mean. Omitted entirely (not a fabricated 0%/guess) when
                    // monthlyTemps hasn't resolved yet or the fetch failed — same
                    // "real data or nothing" contract as GH-245.
                    try {
                        var _normalMonth = new Date().getMonth() + 1; // 1-12, matches monthlyTemps keying
                        var _normalTemp = global.climateMetrics && global.climateMetrics.monthlyTemps
                            ? global.climateMetrics.monthlyTemps[_normalMonth] : null;
                        if (typeof _normalTemp === 'number') {
                            var _normalGrowth = calculateWeightedGrowth(_normalTemp, _c3f, _c4f);
                            cache.computed.climate.growth.monthlyNormal = {
                                month: _normalMonth,
                                temp: Math.round(_normalTemp * 10) / 10,
                                weighted: Math.round(100 * _normalGrowth.weighted),
                                c3: Math.round(100 * _normalGrowth.c3),
                                c4: Math.round(100 * _normalGrowth.c4),
                                source: global.climateMetrics.monthlyTempsSource || null
                            };
                        }
                    } catch (_normalErr) {
                        console.warn('[GilbaPersist] monthlyNormal GP computation failed:', _normalErr);
                    }
                    console.log('[GilbaPersist] Augmented dailyPattern, length:', _growthFull.dailyPattern.length);
                }
                if (_forecastFull && _forecastFull.temp) {
                    cache.computed = Object.assign({}, cache.computed || {});
                    cache.computed.climate = Object.assign({}, cache.computed.climate || {});
                    cache.computed.climate.forecast = Object.assign({}, cache.computed.climate.forecast || {}, {
                        temp: _forecastFull.temp
                    });
                    console.log('[GilbaPersist] Augmented forecast.temp.insight:', _forecastFull.temp.insight);
                }
            } catch (e) {
                console.warn('[GilbaPersist] Failed to reconstruct dailyPattern/forecast:', e);
            }
        }

        // Save soil nutrition + tissue data for /analysis#soil-nutrition tab.
        // hub-orchestrator sets GAIP_STATE = _hubState with shape { inputs: { soil, ... }, computed: { mlsn, ... } }.
        // Older hub-tissue-v3 used flat shape { soil, mlsnResults }.  Support both.
        var _gaipState = global.GAIP_STATE;
        // Resolve soil inputs and MLSN HTML from either architecture shape
        var _soilIn   = (_gaipState && _gaipState.inputs && _gaipState.inputs.soil)
                     || (_gaipState && _gaipState.soil)
                     || null;
        var _mlsnHtml = (_gaipState && _gaipState.computed && typeof _gaipState.computed.mlsn === 'string' && _gaipState.computed.mlsn)
                     || (_gaipState && typeof _gaipState.mlsnResults === 'string' && _gaipState.mlsnResults)
                     || '';
        // GH-574: the MLSN engine's own rows. Everything below used to be
        // recovered from `_mlsnHtml` by `DOMParser`, reading table cells by
        // position — the engine's result, read back out of the page it had been
        // drawn on. That is the class GH-459 closed, and it is why the owner's
        // Re-run showed nothing: the engine threw on values the sample store
        // holds as strings, the cascade caught it and returned an object rather
        // than a string, so the markup was empty and so was the list.
        var _mlsnRows = (_gaipState && _gaipState.computed && Array.isArray(_gaipState.computed.mlsnRows) && _gaipState.computed.mlsnRows)
                     || (_gaipState && Array.isArray(_gaipState.mlsnRows) && _gaipState.mlsnRows)
                     || null;
        var _turfState = (_gaipState && _gaipState.turf)
                      || (_gaipState && _gaipState.inputs && _gaipState.inputs.turf)
                      || null;
        cache.computed = Object.assign({}, cache.computed || {});
        if (_gaipState && (_mlsnRows || _mlsnHtml || _soilIn)) {
            try {
                // GH-574: taken from the engine's result. No parsing, and no
                // second shape: `nutrientResults` is what the table was rendered
                // FROM, so every field the scrape tried to recover is here,
                // including the recommendation the seven-column variant used to
                // read out of the deficit cell by mistake.
                var _nutrients = (_mlsnRows || []).map(function (r) {
                    return {
                        nutrient:       r.nutrient,
                        actual:         r.actual,
                        mlsn:           r.mlsn,
                        uptakePpm:      r.uptakePpm,
                        targetPpm:      r.targetPpm,
                        status:         r.status,
                        statusClass:    r.statusClass,
                        recommendation: r.recommendation,
                        rangeMin:       r.rangeMin,
                        rangeMax:       r.rangeMax,
                        rangeSource:    r.rangeSource,
                    };
                });
                // GH-576 — NO NUMBERS, NO VERDICT. The rule is ours and it had a
                // guard: `gh511-no-number-no-verdict.test.js`. That guard watches
                // ONE door — the growth-potential producer and the climate
                // section of the Word document — and this is the other one.
                //
                // What it let through, measured on the stand: `analysis_results`
                // id 37 carries ten nutrient rows, every one of them
                // `status: "NOT MEASURED"` with `actual: "-"`, and a verdict of
                // ACCEPTABLE. The ladder asked "is anything deficient? is
                // anything borderline?", both answers were no, and the last rung
                // said the soil is fine. The page then printed "Soil Nutrition:
                // Acceptable — Operate normally. No immediate action required."
                // over ten dashes. A conclusion of wellbeing, drawn from ten
                // values nobody measured.
                //
                // A row the engine could not measure carries `actual: "-"` —
                // its own marker, from the `!wasMeasured` branch — so the
                // verdict is derived from the measured rows and from nothing
                // else. None measured is NO DATA, which is what it was before
                // the list existed at all. The rows themselves are untouched:
                // the dash is honest and stays on the screen.
                var _measured = _nutrients.filter(function(n) {
                    return n && n.actual !== '-' && n.actual !== null && n.actual !== undefined && n.actual !== '';
                });
                var _soilVerdict = 'NO DATA';
                if (_measured.length > 0) {
                    var _hasDeficient = _measured.some(function(n) {
                        var sc = (n.statusClass || '').toLowerCase();
                        return sc === 'deficient' || sc === 'critical' || n.status === 'LOW' || n.status === 'Very Low';
                    });
                    var _hasBorderline = _measured.some(function(n) {
                        return (n.statusClass || '').toLowerCase() === 'borderline';
                    });
                    _soilVerdict = _hasDeficient ? 'HIGH_RISK' : _hasBorderline ? 'MONITOR' : 'ACCEPTABLE';
                }
                // Mulders flags (if available)
                var _mulders = null;
                if (global.GilbaMulders && typeof global.GilbaMulders.analyse === 'function' && _nutrients.length > 0) {
                    try { _mulders = global.GilbaMulders.analyse(_nutrients, {}); } catch(e) {}
                }
                var _si = _soilIn || {};
                var _depthCm     = parseFloat(_si.depthCm)     || 10;
                var _bulkDensity = parseFloat(_si.bulkDensity) || 1.4;
                var _turfType    = (_turfState && _turfState.warmBase && ((_turfState.percentC3Cover || 0) < 50))
                                   ? 'warm-season' : 'cool-season';
                // GH-589 (link 4, point 4) — pH, ECe, Na AND CEC COME OUT OF
                // THE SAME PASS AS THE NUTRIENT LIST, AND OUT OF NOTHING ELSE.
                //
                // Four readings used to be recovered here by reading the sample
                // store a SECOND time, at the moment the body was assembled —
                // GH-572 added CEC to the three that were already doing it. It
                // worked, and that is the problem: it worked at a different
                // MOMENT from the list beside it. On 23.09.2026 that produced
                // one stored row in which pH and CEC were the sample's real
                // numbers and all ten nutrient cards said "NOT MEASURED", and
                // the two disagreeing halves were read as two sources when they
                // were one source read twice.
                //
                // Since GH-589 the pass collects its own state at its own start
                // and is re-run when the sample arrives after it, so `_si` — the
                // soil the engines actually computed on — carries all four. A
                // second read here would be a second moment again, and the way
                // to keep a row consistent with itself is to have one.
                cache.computed.soilNutrition = {
                    verdict:      _soilVerdict,
                    methodology:  _si.methodology || null,
                    pH:           _si.pH_water || _si.pH_cacl2 || _si.ph || null,
                    ECe:          _si.ECe || null,
                    soilNa:       (_si.ppm && _si.ppm.Na) || _si.Na_ppm || null,
                    CEC:          _si.CEC || _si.cec || null,
                    sampleDate:   _si.testDate || null,
                    sampleLabel:  _si.sampleLabel || null,
                    depthCm:      _depthCm,
                    bulkDensity:  _bulkDensity,
                    turfType:     _turfType,
                    nutrients:    _nutrients,
                    mulders:      _mulders ? ((_mulders.flags && Object.keys(_mulders.flags).length > 0) ? _mulders.summaryBanner || null : null) : null,
                    species:      (_turfState && (_turfState.species || _turfState.grassSpecies)) || null,
                };
                // Ratios (Ca:Mg, K:Mg, K:Ca) extracted from MLSN HTML by mlsn-progressive-disclosure.js
                if (_mlsnHtml && typeof extractRatiosFromHTML === 'function') {
                    try { cache.computed.soilNutrition.ratios = extractRatiosFromHTML(_mlsnHtml); } catch(e) {}
                }
                // Annual demand per nutrient (kg/ha/yr) via N-linked tissue ratios
                if (typeof calculateAnnualDemand === 'function') {
                    try {
                        var _gp   = (global.climateMetrics && global.climateMetrics.growth && global.climateMetrics.growth.weighted) || null;
                        var _nPrg = (_turfState && _turfState.nProgramKgHaYr) || 0;
                        cache.computed.soilNutrition.annualDemand = calculateAnnualDemand(_turfType, _gp, _nPrg);
                    } catch(e) {}
                }
                // GH-589 (link 4, point 4a) — THE TISSUE BLOCK COMES FROM
                // THE PASS, NOT FROM A SNAPSHOT TWO MODULES WRITE.
                //
                // `window.__GAIP_TISSUE_LAST__` is written by the cascade's
                // tissue engine AND by the screen module `tissue-ui.js`, and
                // whoever wrote last won. The block in the stored row was intact
                // only because `tissue-ui` happened to write after the form was
                // filled — an order, not a rule, and `computed.tissue` on fresh
                // rows was NULL beside it. One result, two authors, no way to
                // say which run a row's tissue belongs to.
                //
                // IT COMES FROM THE PASS ITSELF, and not from
                // `computed.tissue` on the shared state, which looks like the
                // same thing and is not: `mergeComputed` declines to overwrite a
                // key the hub state already has, `tissue` is one of the keys
                // that state declares up front, and so the cascade's tissue
                // result never lands there at all. Measured while writing this
                // — the row came out with no tissue block — which is also why
                // `computed.tissue` was NULL on the fresh rows while a full
                // thirteen-key block sat in `soilNutrition.tissue` beside it.
                var _tissue = _cascadeTissueOfThisRun();
                if (_tissue) {
                    cache.computed.soilNutrition.tissue = {
                        testDate:          _tissue.testDate || null,
                        speciesGroup:      (_tissue.meta && _tissue.meta.speciesGroup) || null,
                        growthState:       (_tissue.meta && _tissue.meta.growthState) || null,
                        sampleType:        (_tissue.meta && _tissue.meta.sampleType) || null,
                        normalized:        _tissue.normalized || null,
                        status:            _tissue.status || null,
                        headline:          _tissue.headline || null,
                        summary:           _tissue.summary || [],
                        decisionBias:      _tissue.decisionBias || null,
                        limitingNutrients: _tissue.limitingNutrients || [],
                        antagonisms:       _tissue.antagonisms || [],
                        dilutionFlags:     _tissue.dilutionFlags || [],
                        stressSignal:      _tissue.stressSignal || false,
                    };
                }
                console.log('[GilbaPersist] Saved soilNutrition to cache, verdict:', _soilVerdict,
                    '| nutrients:', _nutrients.length,
                    '| tissue:', !!_tissue);
            } catch (e) {
                console.warn('[GilbaPersist] Failed to save soilNutrition to cache:', e);
            }
        }

        // Fallback: if hub form was empty (no soil inputs), try latest sample from GAIP_SampleManager
        if (!cache.computed.soilNutrition && global.GAIP_SampleManager && typeof global.mlsnEngine === 'function') {
            try {
                // Use getAllSamples() by GAIP_HUB_CONFIG.activeSiteId to avoid active-site mismatch
                // when site-config-persistence has switched the active site to 'default'.
                // GH-521: hoisted out of the IIFE so the methodology read below resolves
                // the SAME site the sample was picked for. Reading it from a different
                // id source would print one site's setting against another site's sample
                // — the class of defect this delivery removes.
                var _smHubSiteId = (window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId) || null;
                var _smSamples = (function() {
                    try {
                        var _hSite = _smHubSiteId;
                        if (_hSite && typeof global.GAIP_SampleManager.getAllSamples === 'function') {
                            var _aS = global.GAIP_SampleManager.getAllSamples();
                            return (_aS.allSites && _aS.allSites[_hSite] && _aS.allSites[_hSite].soil) || null;
                        }
                        return typeof global.GAIP_SampleManager.getSamples === 'function'
                            ? global.GAIP_SampleManager.getSamples('soil') : null;
                    } catch(e) {
                        return typeof global.GAIP_SampleManager.getSamples === 'function'
                            ? global.GAIP_SampleManager.getSamples('soil') : null;
                    }
                })();
                if (_smSamples) {
                    // Pick the most recent sample by date
                    var _smLatestId = null, _smLatestDate = '';
                    Object.keys(_smSamples).forEach(function(sid) {
                        var d = _smSamples[sid].date || '';
                        if (!_smLatestId || d > _smLatestDate) { _smLatestId = sid; _smLatestDate = d; }
                    });
                    if (_smLatestId) {
                        var _smSample = _smSamples[_smLatestId];
                        // Server-fetched samples have .values, CSV-imported have .rawData
                        var _smRaw = _smSample.rawData || _smSample.values || {};
                        // Map {K_ppm: 100, ...} → {K: 100, ...} for mlsnEngine
                        var _smPpm = {};
                        Object.keys(_smRaw).forEach(function(k) {
                            var clean = k.replace(/_ppm$/i, '').replace(/_me$/i, '');
                            var v = parseFloat(_smRaw[k]);
                            if (!isNaN(v)) _smPpm[clean] = v;
                        });
                        // soilTexture's history: GH-262 read it here at all; GH-263 made the
                        // sample's soilTextureSnapshot win, because `.gaip-soil-texture` was a
                        // dead static "loam" default at the time; GH-270/272 made that field
                        // genuinely live (hub.blade.php/stadium.blade.php initialise it from the
                        // site's soil_texture_override on every load, and the per-sample restore
                        // in sample-manager.js that used to overwrite it was removed); GH-273
                        // then flipped this priority to DOM-first to match. Confirmed live on
                        // Russley: Re-run showed the generic "others" AA range (100.0-235.0ppm,
                        // from Green 18's stale "loam" snapshot) while switching samples --
                        // SampleAnalysisController.php's separate GH-269 fix -- correctly showed
                        // the S279 certificate range (78.2-195.5ppm) for the same site. No default
                        // is baked into _smTexDom itself: the final default belongs at the end of
                        // the chain, or a present-but-empty read would win over a real snapshot.
                        //
                        // methodology took a different route and no longer reads any field on the
                        // page. GH-265 had it read `.gaip-soil-methodology` first, on the grounds
                        // that the field was live and the sample's stamp was frozen. The intention
                        // was right; the carrier was not. A page field holds whatever site the page
                        // last painted, so a card drawn for one site while the fields still describe
                        // another prints the second site's setting under the first site's name --
                        // GH-459, and the CLAUDE.md rule that came out of it. GH-521 moves the read
                        // to the site's own record, by the site's id; see below.
                        var _smTexDom    = (document.querySelector('.gaip-soil-texture') || {}).value;
                        // GH-521: one owner, read by id. GAIP_SiteConfig.getConfig is the
                        // per-site store, keyed by the same `_smHubSiteId` the sample above
                        // was picked by — the page-level globals beside it answer for
                        // whichever site the page is standing on, which is not necessarily
                        // this one.
                        var _smConfigMethodology = (function () {
                            try {
                                var _sid = _smHubSiteId;
                                if (!_sid || !global.GAIP_SiteConfig
                                    || typeof global.GAIP_SiteConfig.getConfig !== 'function') return null;
                                var _cfg = global.GAIP_SiteConfig.getConfig(_sid);
                                var _m = _cfg && _cfg.turf ? _cfg.turf.methodology : null;
                                return (_m === undefined || _m === '') ? null : _m;
                            } catch (e) { return null; }
                        })();
                        var _smState = {
                            soil: {
                                ppm:         _smPpm,
                                // GH-521: the methodology comes from the site's own
                                // configuration, by id — not from a field on the page and
                                // not from the sample's stamp.
                                //
                                // Measured before this changed (GH-512): the DOM read won
                                // on every Re-run, and it carried 'ammonium_acetate' while
                                // the sample it was computing — sample_105 — was stamped
                                // 'mlsn' and its site was set to 'mlsn'. The page field
                                // belongs to whatever the page last painted; the stamp is a
                                // record of a past setting, not the setting; and the final
                                // 'mlsn' was a methodology for a site that has none.
                                methodology: _smConfigMethodology,
                                soilTexture: _smTexDom || _smSample.soilTextureSnapshot || 'loam',
                                CEC:         parseFloat(_smRaw.CEC || _smRaw.cec) || null,
                                depthCm:     _smRaw.depth_mm ? _smRaw.depth_mm / 10 : 10,
                                bulkDensity: _smRaw.bulkDensity || 1.4,
                            },
                            turf: _turfState || {},
                        };
                        // GH-574: the engine returns `{ html, nutrients }`. The
                        // markup is still wanted here for the ratio strings; the
                        // rows come from the result rather than from the markup.
                        var _smOut  = global.mlsnEngine(_smState, global.rawWeatherData || null);
                        var _smHtml = typeof _smOut === 'string' ? _smOut : ((_smOut && _smOut.html) || '');
                        var _smRows = (_smOut && Array.isArray(_smOut.nutrients)) ? _smOut.nutrients : null;
                        if (_smRows || _smHtml) {
                            var _smNutrients = (_smRows || []).map(function (r) {
                                return {
                                    nutrient: r.nutrient, actual: r.actual, mlsn: r.mlsn,
                                    uptakePpm: r.uptakePpm, targetPpm: r.targetPpm,
                                    status: r.status, statusClass: r.statusClass,
                                    recommendation: r.recommendation,
                                    rangeMin: r.rangeMin, rangeMax: r.rangeMax,
                                    rangeSource: r.rangeSource,
                                };
                            });
                            // GH-576: the same rule on the second door of this
                            // same file. Two copies of a ladder drift, and the
                            // one nobody looked at is the one that drifts.
                            var _smMeasured = _smNutrients.filter(function(n) {
                                return n && n.actual !== '-' && n.actual !== null && n.actual !== undefined && n.actual !== '';
                            });
                            var _smVerdict = 'NO DATA';
                            if (_smMeasured.length > 0) {
                                var _smDef = _smMeasured.some(function(n) { return (n.statusClass || '').toLowerCase() === 'deficient' || (n.statusClass || '').toLowerCase() === 'critical'; });
                                var _smBord = _smMeasured.some(function(n) { return (n.statusClass || '').toLowerCase() === 'borderline'; });
                                _smVerdict = _smDef ? 'HIGH_RISK' : _smBord ? 'MONITOR' : 'ACCEPTABLE';
                            }
                            var _smDepth = _smRaw.depth_mm ? _smRaw.depth_mm / 10 : (_smRaw.depthCm || 10);
                            var _smBD    = parseFloat(_smRaw.bulkDensity) || 1.4;
                            var _smTurfType = (_turfState && _turfState.warmBase && ((_turfState.percentC3Cover || 0) < 50))
                                             ? 'warm-season' : 'cool-season';
                            // DOM fallback: same race condition as primary path
                            // (_smTexDom already read above, reused here for the ECe conversion)
                            var _smPhDom   = parseFloat((document.querySelector('.gaip-soil-ph') || {}).value) || 0;
                            var _smEc15Dom = parseFloat((document.querySelector('.gaip-soil-ec') || {}).value) || 0;
                            var _smEceDom  = _smEc15Dom > 0 ? _smEc15Dom * ({sand:5,loamy_sand:5.5,sandy_loam:6,loam:7,clay_loam:8,clay:10}[_smTexDom] || 7) : 0;
                            var _smNaDom   = parseFloat(((document.querySelector('[data-mlsn="Na"]') || {})).value) || 0;
                            cache.computed.soilNutrition = {
                                verdict:     _smVerdict,
                                methodology: _smState.soil.methodology,
                                pH:          _smRaw.pH_Water || _smRaw.pH || _smRaw.ph || _smPhDom || null,
                                ECe:         _smRaw.ECe || _smRaw.EC_paste || (function() {
                                                 var ec15 = parseFloat(_smRaw.EC || _smRaw.EC_1_5 || _smRaw.EC_dSm || 0);
                                                 if (!ec15) return _smEceDom || null;
                                                 var tx = _smRaw.Texture || _smRaw.texture || _smTexDom || 'loam';
                                                 return ec15 * ({sand:5,loamy_sand:5.5,sandy_loam:6,loam:7,clay_loam:8,clay:10}[tx] || 7);
                                             })(),
                                soilNa:      _smPpm.Na || parseFloat(_smRaw.Na || 0) || _smNaDom || null,
                                CEC:         _smRaw.CEC || _smRaw.cec || null,
                                sampleDate:  _smSample.date || null,
                                sampleLabel: _smSample.label || _smLatestId,
                                depthCm:     _smDepth,
                                bulkDensity: _smBD,
                                turfType:    _smTurfType,
                                nutrients:   _smNutrients,
                                species:     (_turfState && (_turfState.species || _turfState.grassSpecies)) || null,
                                fromSample:  true,
                            };
                            // Ratios from MLSN HTML
                            if (_smHtml && typeof extractRatiosFromHTML === 'function') {
                                try { cache.computed.soilNutrition.ratios = extractRatiosFromHTML(_smHtml); } catch(e) {}
                            }
                            // Annual demand
                            if (typeof calculateAnnualDemand === 'function') {
                                try {
                                    var _smGp  = (global.climateMetrics && global.climateMetrics.growth && global.climateMetrics.growth.weighted) || null;
                                    var _smNPr = (_turfState && _turfState.nProgramKgHaYr) || 0;
                                    cache.computed.soilNutrition.annualDemand = calculateAnnualDemand(_smTurfType, _smGp, _smNPr);
                                } catch(e) {}
                            }
                            // GH-589: the same source on this second door. Two
                            // copies of a read drift, and the one nobody looked
                            // at is the one that drifts (GH-576, same file).
                            var _tissue2 = _cascadeTissueOfThisRun();
                            if (_tissue2) {
                                cache.computed.soilNutrition.tissue = {
                                    testDate: _tissue2.testDate || null, speciesGroup: (_tissue2.meta && _tissue2.meta.speciesGroup) || null,
                                    growthState: (_tissue2.meta && _tissue2.meta.growthState) || null,
                                    sampleType: (_tissue2.meta && _tissue2.meta.sampleType) || null,
                                    normalized: _tissue2.normalized || null, status: _tissue2.status || null,
                                    headline: _tissue2.headline || null, summary: _tissue2.summary || [],
                                    decisionBias: _tissue2.decisionBias || null, limitingNutrients: _tissue2.limitingNutrients || [],
                                    antagonisms: _tissue2.antagonisms || [], dilutionFlags: _tissue2.dilutionFlags || [],
                                    stressSignal: _tissue2.stressSignal || false,
                                };
                            }
                            console.log('[GilbaPersist] soilNutrition from sample:', _smLatestId, '| verdict:', _smVerdict, '| nutrients:', _smNutrients.length);
                        }
                    }
                }
            } catch(e) {
                console.warn('[GilbaPersist] soilNutrition sample fallback failed:', e);
            }
        }

        // Attach input-range validation warnings to soilNutrition
        if (cache.computed.soilNutrition && global.GAIP_INPUT_VALIDATION) {
            var _iv = global.GAIP_INPUT_VALIDATION;
            cache.computed.soilNutrition.validation = {
                errors:   [].concat((_iv.soil && _iv.soil.errors) || [], (_iv.water && _iv.water.errors) || []),
                warnings: [].concat((_iv.soil && _iv.soil.warnings) || [], (_iv.water && _iv.water.warnings) || []),
            };
        }

        // Zone data: all soil samples for zone comparison chart
        if (cache.computed.soilNutrition && global.GAIP_SampleManager &&
            typeof global.GAIP_SampleManager.getSamples === 'function') {
            try {
                var _allSoil = global.GAIP_SampleManager.getSamples('soil');
                if (_allSoil && Object.keys(_allSoil).length > 1) {
                    // Build MLSN threshold lookup from primary nutrients array
                    var _mlsnThresh = {};
                    (cache.computed.soilNutrition.nutrients || []).forEach(function(n) {
                        var t = parseFloat(n.mlsn);
                        if (!isNaN(t)) _mlsnThresh[n.nutrient] = t;
                    });
                    // GH-549 — THE ZONE'S KEY AND THE ZONE'S NAME ARE DIFFERENT THINGS.
                    //
                    // What stood here: the map was keyed by `s.label || sid`,
                    // and that same string was stored as the zone's NAME. So a
                    // soil sample with no label was charted, and saved to the
                    // server, under whatever the key happened to be — and the
                    // key was not even an identifier: `getSamples()` returns
                    // `Object.values(...)`, an ARRAY, so `sid` is the array
                    // index. An unnamed sample appeared on /analysis as a zone
                    // called "0".
                    //
                    // The owner's decision of 22.09.2026: "do not substitute —
                    // on screen 'a zone with no name', and group by identifier
                    // internally without showing it". Skipping such samples was
                    // ruled out in the same breath: a sample with measurements
                    // must not vanish from the screen for want of a label.
                    //
                    // So the key is `GaipZoneKey.derive()` — the zone identity
                    // this project already shares with the trend charts and the
                    // export (b35fix311_1) — and the name is the label or
                    // nothing. `derive()` strips dates from a label, which is
                    // what keeps "Green 1 (June 2025)" and "Green 1 Q1 2024" one
                    // zone; keying on the sample's own id instead would split
                    // every named zone into one bar per visit.
                    var _zoneMap  = {}; // zone key → sample entry (latest date wins)
                    var _zoneKeyOf = function (sample, fallback) {
                        // Same guarded call as nutrient-trend.js: the module is
                        // enqueued separately and a missing one must not take
                        // the zone chart down with it.
                        try {
                            if (global.GaipZoneKey && typeof global.GaipZoneKey.derive === 'function') {
                                var k = global.GaipZoneKey.derive(sample);
                                if (k) return k;
                            }
                        } catch (e) { /* fall through */ }
                        // GH-588, surfaced by the GH-477 ratchet: NO NAME IS NO
                        // NAME. This fell back to the sample's id, which is the
                        // substitution removed from zone labels in GH-549 — a
                        // number standing where a name belongs. The grouping is
                        // unchanged: `fallback` is the store key of this very
                        // sample, so an unnamed sample still groups with itself
                        // and only with itself.
                        //
                        // It is old code and I did not write it; the ratchet saw
                        // it only after edits elsewhere in this file moved it
                        // into a region the scanner attributes. That the
                        // detection is position-sensitive is worth knowing and
                        // is not repaired here.
                        var raw = (sample && sample.label) || fallback;
                        return String(raw).toLowerCase().trim();
                    };
                    var _ZONE_NUTS = ['K','P','Ca','Mg','S','Fe','Mn','Zn','Cu','B','Na'];
                    Object.keys(_allSoil).forEach(function(sid) {
                        var s   = _allSoil[sid];
                        var raw = s.rawData || s;
                        var ppm = {};
                        _ZONE_NUTS.forEach(function(nut) {
                            var v = parseFloat(raw[nut + '_ppm'] != null ? raw[nut + '_ppm'] : raw[nut]);
                            if (!isNaN(v) && v > 0) ppm[nut] = v;
                        });
                        if (!Object.keys(ppm).length) return; // skip empty samples
                        var zoneKey = _zoneKeyOf(s, sid);
                        var date    = s.date || '';
                        // Keep only the most recent sample per zone
                        if (!_zoneMap[zoneKey] || date > (_zoneMap[zoneKey].date || '')) {
                            _zoneMap[zoneKey] = {
                                // The sample's own id. `sid` is the array index
                                // from Object.keys() over an array and was never
                                // an identifier; a field called `id` that is a
                                // position is worse than no field.
                                id:    (s && s.id) || null,
                                // No name is no name. Nothing is put here in its
                                // place — not the key above, not a number.
                                label: (s && typeof s.label === 'string' && s.label.trim()) || null,
                                date:  date || null,
                                ppm:   ppm,
                                pH:    parseFloat(raw.pH_Water || raw.pH || raw.pH_cacl2) || null,
                                CEC:   parseFloat(raw.CEC || raw.cec) || null,
                            };
                        }
                    });
                    // Convert map to array, compute alerts, sort
                    var _zoneList = Object.keys(_zoneMap).map(function(zoneKey) {
                        var z = _zoneMap[zoneKey];
                        z.alerts = Object.keys(_mlsnThresh).filter(function(nut) {
                            return z.ppm[nut] != null && z.ppm[nut] < _mlsnThresh[nut];
                        });
                        return z;
                    });
                    if (_zoneList.length > 0) {
                        // Sort: alert zones first, then named zones
                        // alphabetically, then the unnamed ones. An unnamed zone
                        // has nothing to sort by, and sorting it as an empty
                        // string put it at the TOP of the list, above every
                        // named zone. Alerts still win, so an unnamed zone with
                        // a deficit is not buried.
                        _zoneList.sort(function(a, b) {
                            if (a.alerts.length !== b.alerts.length) return b.alerts.length - a.alerts.length;
                            if (!a.label !== !b.label) return a.label ? -1 : 1;
                            return (a.label || '').localeCompare(b.label || '');
                        });
                        cache.computed.soilNutrition.zones = _zoneList;
                    }
                }
            } catch(e) {
                console.warn('[GilbaPersist] Zone data capture failed:', e);
            }
        }

        // Monthly N distribution from nutrition-summary-integration (exposed via __GAIP_MONTHLY_N__)
        if (cache.computed.soilNutrition) {
            var _monthlyN = global.__GAIP_MONTHLY_N__;
            if (Array.isArray(_monthlyN) && _monthlyN.length === 12) {
                cache.computed.soilNutrition.monthlyN = _monthlyN;
            }
        }

        // Water Balance data for /analysis#water-balance tab.
        try {
            // GH-586 (D6) — THE CHOSEN WATER SAMPLE COMES FROM THE SERVER.
            //
            // This read `gilba_wb_water_override` from `localStorage`: the id of
            // the sample the user picked AND A COPY OF ITS PAYLOAD, written by
            // the page that opened this runner. It was never a store — it was a
            // message, "compute on this water sample" — and it went through the
            // browser because until GH-547 the runner was opened as a bare
            // `/hub` with nowhere to put a parameter.
            //
            // The choice arrives as `?water=<sampleId>` now and the SAMPLE
            // ITSELF is taken from the sample store, which is loaded from the
            // server. Nothing about the water comes out of the browser's memory.
            //
            // AND WHEN THE ID CANNOT BE RESOLVED, THE RUN SAYS SO. It does not
            // quietly fall through to the site's last water sample: the person
            // asked for a particular one, and answering with another under the
            // same numbers is the substitution this whole question removes. The
            // two reasons are kept apart, because they are different facts — the
            // sample is not on this site (a stale link, a deleted sample), or
            // the store has not loaded yet (a race, the same shape as link 4).
            var _wbOverride = null;
            var _wbRequestedId = null;
            try {
                _wbRequestedId = new URLSearchParams(window.location.search || '').get('water');
            } catch (_e) { _wbRequestedId = null; }

            if (_wbRequestedId) {
                try {
                    var _wbSM = global.GAIP_SampleManager;
                    var _wbSite = window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId;
                    var _wbAll = (_wbSM && typeof _wbSM.getAllSamples === 'function') ? _wbSM.getAllSamples() : null;
                    var _wbStore = _wbAll && _wbAll.allSites && _wbAll.allSites[_wbSite];
                    var _wbWater = (_wbStore && _wbStore.water) || null;

                    if (!_wbWater) {
                        // Not loaded yet — not the same as "not there".
                        noteWaterSampleUnresolved('water-samples-not-loaded', _wbRequestedId);
                    } else {
                        var _wbFound = null;
                        Object.keys(_wbWater).forEach(function (k) {
                            var cand = _wbWater[k];
                            if (cand && String(cand.id) === String(_wbRequestedId)) _wbFound = cand;
                        });
                        if (_wbFound) {
                            var _wbPl = _wbFound.rawData || _wbFound.values || {};
                            // GH-586, corrected by the GH-477 ratchet: NO NAME IS
                            // NO NAME. The first draft fell back to the sample's
                            // id, which puts a number where a name belongs and
                            // reads as one — the same substitution removed from
                            // zone labels in GH-549. A sample without a label
                            // travels without one, and every place that prints it
                            // already handles nothing.
                            _wbOverride = {
                                id: _wbFound.id,
                                // GH-598: the sample itself, so its readings are
                                // resolved by the declared normaliser rather than
                                // by a name list assembled here.
                                sample: _wbFound,
                                label: (typeof _wbPl._label === 'string' && _wbPl._label.trim())
                                    || (typeof _wbFound.label === 'string' && _wbFound.label.trim())
                                    || null,
                                payload: _wbPl,
                            };
                            console.log('[GilbaPersist] water sample from the run parameter |', _wbOverride.label);
                        } else {
                            noteWaterSampleUnresolved('water-sample-not-found', _wbRequestedId);
                        }
                    }
                } catch (_wbE) {
                    noteWaterSampleUnresolved('water-sample-not-found', _wbRequestedId);
                }
            }

            // GAIP_STATE.water is only set for blended water (hub-tissue-v3 line 5621).
            // For regular water the water engine captures state in __GAIP_WATER_STATE__.water.
            var _waterIn = (_gaipState && _gaipState.inputs && _gaipState.inputs.water)
                        || (_gaipState && _gaipState.water)
                        || (global.__GAIP_WATER_STATE__ && global.__GAIP_WATER_STATE__.water)
                        || null;

            // If the WB dropdown override is set, build _waterIn from the selected
            // sample payload regardless of what __GAIP_WATER_STATE__ captured.  This
            // ensures the chosen sample is always used even when the analysis engine ran
            // before SM async-loaded the correct sample into the water form.
            if (_wbOverride && _wbOverride.payload) {
                // GH-598 — THE IONS COME FROM THE DECLARED READER, AND A
                // MEASURED ZERO IS A MEASUREMENT.
                //
                // Two things stood here and both are the shape GH-591 closed
                // for the soil. A LIST OF NAMES of its own, matched exactly:
                // `WATER_FIELD_MAP` accepts `Ca_mgL`, `Na_mgL` and the rest, the
                // form filling and the Word export resolve them, and this did
                // not — measured 23.09.2026, no live sample spells them that
                // way today, so nothing is lost yet and the first lab that does
                // would be dropped silently. And `v > 0`, which throws away a
                // reading of zero: `CO3` is 0 in six of the eight live water
                // samples, and a carbonate measured at zero is a measurement,
                // not an absence.
                var _ovSample = _wbOverride.sample || { values: _wbOverride.payload };
                var _ovPl = _wbOverride.payload;
                var _ovReadings = _waterReadingsOf(_ovSample);
                var _ovEC = _ovReadings.EC != null ? _ovReadings.EC : null;
                var _ovIons = _ionsOf(_ovReadings);
                _waterIn = {
                    ecw:         _ovEC || (parseFloat(_ovPl.TDS || 0) / 640) || null,
                    ions:        _ovIons,
                    pH:          parseFloat(_ovPl.pH || _ovPl.ph) || null,
                    SAR:         parseFloat(_ovPl.SAR || _ovPl.sar) || null,
                    sourceLabel: _wbOverride.label || null,
                    source:      'wb-dropdown-override',
                };
                console.log('[GilbaPersist] WB override applied | label:', _wbOverride.label, '| ECw:', _waterIn.ecw);
            }

            // If __GAIP_WATER_STATE__ was captured before the water sample was loaded into
            // the form (race: server fetch completes after initial analysis, or a site switch
            // fires an analysis before the new site's form is repopulated), the state has
            // ecw=0 and empty ions. Resolve from the *current active site* rather than
            // whatever happens to be sitting in the DOM at this exact moment.
            var _stateHasWater = _waterIn && (parseFloat(_waterIn.ecw) > 0 || Object.keys(_waterIn.ions || {}).some(function(k) { return _waterIn.ions[k] > 0; }));

            // Sample-store fallback (tried first): read directly from the sample store by
            // GAIP_HUB_CONFIG.activeSiteId, which is updated synchronously on site switch -
            // this is the source of truth for "what site are we on", unlike the DOM form
            // which repopulates asynchronously and can still hold the *previous* site's
            // values for a window after the switch. Also covers the site-config-persistence
            // race where the site briefly switches to 'default' between loadSample and the
            // 3s save timer, clearing the DOM.
            // True once the sample store has positively confirmed the active site has zero
            // water samples - as opposed to "we don't know yet" (store/site not loaded). In
            // the confirmed-empty case we must NOT fall through to the DOM fallback below,
            // since the DOM can legitimately still hold a *different* site's leftover values
            // for a window after switching (site-selector-ui's form-clear runs on its own
            // uncoordinated timer, not before this save can fire).
            var _siteWaterConfirmedEmpty = false;
            if (!_stateHasWater) {
                try {
                    var _hubSiteId = window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId;
                    if (_hubSiteId && global.GAIP_SampleManager && typeof global.GAIP_SampleManager.getAllSamples === 'function') {
                        var _allSmpState = global.GAIP_SampleManager.getAllSamples();
                        var _siteSmpStore = _allSmpState.allSites && _allSmpState.allSites[_hubSiteId];
                        var _siteWaterSamples = (_siteSmpStore && _siteSmpStore.water) || {};
                        var _activeWIds = _allSmpState.allActive && _allSmpState.allActive[_hubSiteId];
                        var _activeWId = _activeWIds && _activeWIds.water;
                        var _wSmp = (_activeWId && _siteWaterSamples[_activeWId]) ||
                                    Object.values(_siteWaterSamples).sort(function(a,b) { return (b.date||'') > (a.date||'') ? 1 : -1; })[0];
                        if (_wSmp) {
                            // GH-598: the same reader on the second door. Two
                            // copies of a name list drift, and the one nobody
                            // looked at is the one that drifts.
                            var _wReadings = _waterReadingsOf(_wSmp);
                            var _wEC = _wReadings.EC != null ? _wReadings.EC : 0;
                            if (_wEC > 0) {
                                var _wIons = _ionsOf(_wReadings);
                                _waterIn = {
                                    ecw:  _wEC,
                                    ions: _wIons,
                                    pH:   parseFloat(_wData.pH || _wData.ph) || null,
                                    SAR:  parseFloat(_wData.SAR || _wData.sar) || null,
                                    source: 'sample-store-fallback',
                                };
                                _stateHasWater = true;
                                console.log('[GilbaPersist] Water sample-store fallback | site:', _hubSiteId, '| ECw:', _wEC, '| ions:', Object.keys(_wIons).join(','));
                            }
                        }
                        if (!_stateHasWater && _siteSmpStore && Object.keys(_siteWaterSamples).length === 0) {
                            _siteWaterConfirmedEmpty = true;
                            console.log('[GilbaPersist] Site', _hubSiteId, 'confirmed to have no water samples - skipping DOM fallback');
                        }
                    }
                } catch(e) {}
            }

            // DOM fallback (last resort): only if we couldn't positively resolve the active
            // site's water either way (e.g. SampleManager not loaded yet) - never when the
            // site is confirmed to have no water sample, since the DOM may hold another
            // site's stale values in that case.
            if (!_stateHasWater && !_siteWaterConfirmedEmpty) {
                var _ecwDomEl = document.querySelector('.gaip-ecw');
                var _ecwDomVal = _ecwDomEl ? parseFloat(_ecwDomEl.value) : 0;
                if (_ecwDomVal > 0) {
                    var _ionsDom = {};
                    var _ionEls = document.querySelectorAll('[data-ion]');
                    for (var _ii = 0; _ii < _ionEls.length; _ii++) {
                        var _ik = _ionEls[_ii].getAttribute('data-ion');
                        var _iv = parseFloat(_ionEls[_ii].value);
                        if (_ik && !isNaN(_iv) && _iv > 0) _ionsDom[_ik] = _iv;
                    }
                    var _phDomEl = document.querySelector('.gaip-water-ph');
                    _waterIn = {
                        ecw:  _ecwDomVal,
                        ions: _ionsDom,
                        pH:   _phDomEl ? parseFloat(_phDomEl.value) : null,
                        source: 'dom-fallback',
                    };
                    console.log('[GilbaPersist] Water DOM fallback used | ECw:', _ecwDomVal, '| ions:', Object.keys(_ionsDom).join(','));
                }
            }

            var _ions = (_waterIn && _waterIn.ions) || {};

            // meq/L conversion factors (EW = MW / valence)
            var _mgToMeq = { Ca: 20.04, Mg: 12.15, Na: 23.0, K: 39.1, HCO3: 61.0, CO3: 30.0, Cl: 35.45, SO4: 48.0 };
            function _meq(ion) { var f = _mgToMeq[ion]; return f ? (parseFloat(_ions[ion]) || 0) / f : 0; }

            var _ecw    = parseFloat((_waterIn && _waterIn.ecw) || (_waterIn && _waterIn.ec)) || null;
            var _pH     = parseFloat((_waterIn && _waterIn.pH) || (_waterIn && _waterIn.ph)) || null;
            var _source = (_waterIn && _waterIn.source) || null;
            var _label  = (_waterIn && _waterIn.sourceLabel) || null;
            var _date   = (_waterIn && _waterIn.testDate) || null;
            var _recycled = (_waterIn && !!_waterIn.recycledWater) || false;

            var _Ca   = _meq('Ca'),  _Mg = _meq('Mg'), _Na = _meq('Na'), _K = _meq('K');
            var _HCO3 = _meq('HCO3'), _CO3 = _meq('CO3'), _Cl = _meq('Cl'), _SO4 = _meq('SO4');
            // GH-599 — WHAT THE SAMPLE CARRIED THAT THE BALANCE HAS NO FACTOR
            // FOR, DERIVED AND NOT NAMED ONE BY ONE.
            //
            // The eight above are meq/L, and they are eight because `_mgToMeq`
            // has eight factors — the ionic balance (SAR, RSC, LSI) is what
            // they are for. Readings outside that arithmetic were reaching the
            // row only if somebody had written a variable for them: `B` and
            // `Fe` had one, `NO3`, `PO4` and `Mn` did not, so a sample carrying
            // them lost them. Measured 23.09.2026: nitrate on six live water
            // samples of eight, phosphate on six, manganese on two.
            //
            // Adding three more variables would be the same defect at a smaller
            // size. The set is DERIVED instead — every reading the declared
            // reader returned that the balance has no factor for — so an ion
            // added to the sample manager's map arrives here without a second
            // edit, in the sample's own units.
            // GH-608: one place decides what counts as a reading, so a third
            // exposure cannot invent a fourth answer to the same question.
            function _readingOf(raw) {
                var v = parseFloat(raw);
                return isNaN(v) ? null : v;
            }
            // GH-611 — WHAT THE LAB ACTUALLY MEASURED AMONG THE EIGHT, IN THE
            // SAMPLE'S OWN UNITS, SO THAT A MEASURED ZERO CAN BE TOLD FROM
            // NOTHING AT ALL.
            //
            // `ions` above is meq/L and is a DERIVED VIEW FOR ARITHMETIC: SAR,
            // RSC and LSI need a number for every term, so `_meq` returning 0
            // for an absent reading is correct there and stays. But the table
            // on screen reads the same object to decide WHETHER TO DRAW A ROW,
            // and a zero cannot answer that question: a carbonate the lab
            // measured and found to be zero and a carbonate nobody tested for
            // are the same 0 after `_meq`.
            //
            // Measured, 23.09.2026, on all eight live water samples: `CO3` is
            // the only reading that is a real zero, and it is zero on six of
            // them — Burns 54 and New test - location 136-140. Those six rows
            // are absent from the table today and say nothing about why.
            //
            // The set is DERIVED, like the trace ions below it: the test is the
            // presence of a factor in `_mgToMeq`, the same table that decides
            // what `ions` contains. An ion added to that table appears here
            // without a second edit, and nothing is named twice.
            var _measuredIons = {};
            Object.keys(_mgToMeq).forEach(function (ion) {
                var v = parseFloat(_ions[ion]);
                if (!isNaN(v)) _measuredIons[ion] = v;
            });
            var _traceIons = {};
            Object.keys(_ions).forEach(function (ion) {
                if (_mgToMeq[ion]) return;
                var v = parseFloat(_ions[ion]);
                if (!isNaN(v)) _traceIons[ion] = v;
            });
            // `B` and `Fe` keep their own keys because a READER names them:
            // `water-balance-analysis.js` draws a Boron row and an Iron row
            // from them. One source, two exposures.
            //
            // GH-608 — A MEASURED ZERO IS A READING; AN ABSENT KEY IS SILENCE.
            //
            // These two carried `parseFloat(x) || null`, which cannot tell the
            // two apart: a lab that measured boron and found none, and a lab
            // that never tested for it, both came out `null` and both drew no
            // row. The owner settled it on 23.09.2026, in her words: if the lab
            // returned a zero — a reading arrived and it says zero — then zero
            // is what gets written; and if there is none, nobody measured it.
            // So the measured zero is now kept and the absence still says
            // nothing.
            //
            // The rule is not about boron. It is about the two states, and the
            // test is the same one the derived trace ions three lines up
            // already apply: a value that parses is a reading whatever it is,
            // and only an unparsable one is absent. Deliberately NOT extended
            // to a zero this code produced on the way — by a substitution, a
            // fallback or an engine that did not run. That zero is still untrue
            // and is a separate subject.
            var _B    = _readingOf(_ions.B);
            var _Fe   = _readingOf(_ions.Fe);

            // SAR = Na / sqrt((Ca + Mg) / 2)
            var _SAR = null, _SARadj = null, _RSC = null;
            if (_Ca + _Mg > 0 && _Na >= 0) {
                _SAR = _Na / Math.sqrt((_Ca + _Mg) / 2);
                _SAR = Math.round(_SAR * 100) / 100;
            }
            // Fallback: use lab-reported SAR directly if ions not available to compute it.
            // data.blade.php water form has a SAR field; the old hub has no SAR DOM input
            // so it's never picked up by gaip_build_state(). Read from sample-store by siteId.
            if (_SAR === null) {
                // First try: SAR already extracted by sample-store fallback above
                var _sarFromStore = _waterIn && _waterIn.SAR;
                if (_sarFromStore) {
                    _SAR = _sarFromStore;
                    _SARadj = _SAR;
                } else if (global.GAIP_SampleManager) {
                    try {
                        var _sarHubSite = window.GAIP_HUB_CONFIG && window.GAIP_HUB_CONFIG.activeSiteId;
                        var _wSampleForSAR = null;
                        if (_sarHubSite && typeof global.GAIP_SampleManager.getAllSamples === 'function') {
                            var _sAll = global.GAIP_SampleManager.getAllSamples();
                            var _sWStore = _sAll.allSites && _sAll.allSites[_sarHubSite] && _sAll.allSites[_sarHubSite].water || {};
                            var _sWActive = _sAll.allActive && _sAll.allActive[_sarHubSite] && _sAll.allActive[_sarHubSite].water;
                            _wSampleForSAR = (_sWActive && _sWStore[_sWActive]) ||
                                             Object.values(_sWStore).sort(function(a,b){return (b.date||'')>(a.date||'')?1:-1;})[0];
                        }
                        if (!_wSampleForSAR) _wSampleForSAR = global.GAIP_SampleManager.getActiveSample('water');
                        var _wDataForSAR = _wSampleForSAR && (_wSampleForSAR.rawData || _wSampleForSAR.values) || {};
                        var _sarDirect = parseFloat(_wDataForSAR.SAR || _wDataForSAR.sar || _wDataForSAR.SAR_ppm);
                        if (!isNaN(_sarDirect) && _sarDirect > 0) {
                            _SAR = Math.round(_sarDirect * 100) / 100;
                            _SARadj = _SAR;
                        }
                    } catch(e) {}
                }
            }
            // SARadj: simplified Suarez — reduce Ca if bicarbonate > Ca+Mg (calcite precipitation)
            if (_SAR !== null && _SARadj === null) {
                var _Cax = _Ca;
                if (_HCO3 + _CO3 > _Ca + _Mg && _Ca > 0) {
                    _Cax = Math.max(0.1, _Ca - 0.5 * ((_HCO3 + _CO3) - (_Ca + _Mg)));
                }
                _SARadj = (_Cax + _Mg) > 0
                    ? Math.round(_Na / Math.sqrt((_Cax + _Mg) / 2) * 100) / 100
                    : _SAR;
            }
            // RSC = (HCO3 + CO3) - (Ca + Mg)
            if (_Ca >= 0 || _Mg >= 0) {
                _RSC = Math.round((_HCO3 + _CO3 - _Ca - _Mg) * 100) / 100;
            }
            // Na% = Na / (Na + Ca + Mg + K) × 100
            var _naPct = (_Na + _Ca + _Mg + _K) > 0
                ? Math.round(_Na / (_Na + _Ca + _Mg + _K) * 1000) / 10
                : null;

            // Leaching fraction from ECw (FAO 29 thresholds)
            var _LF = null;
            if (_ecw !== null) {
                _LF = _ecw < 0.5 ? 10 : _ecw < 1 ? 12 : _ecw < 2 ? 15 : _ecw < 3 ? 20 : _ecw < 4 ? 25 : 30;
            }

            // Langelier Saturation Index (scale/corrosion risk)
            var _LSI = null;
            if (_pH !== null && _Ca > 0 && (_HCO3 + _CO3) > 0 && _ecw !== null) {
                var _TDS = _ecw * 640;
                var _pHs = 9.3 + (Math.log10(Math.max(_TDS, 100)) - 1) / 10 + 0.6
                    - (Math.log10(_Ca * 40.08 * 2.497) + Math.log10(_HCO3 * 61 * 0.82 + _CO3 * 60 * 1.67));
                _LSI = Math.round((_pH - _pHs) * 100) / 100;
            }

            // Irrigation need from live globals or dashboard
            var _irr = global.GAIP_IrrigationResults || global.GAIP_IRRIGATION_RESULT;
            var _weeklyNeed    = _irr ? (_irr.weeklyNeed != null ? _irr.weeklyNeed
                : (_irr.summary && _irr.summary.totalIrrigation != null ? _irr.summary.totalIrrigation : null)) : null;
            var _netDeficit    = _irr && _irr.summary ? _irr.summary.netDeficit : null;
            var _wb            = _irr && _irr.waterBalance;
            var _irr7          = _irr && Array.isArray(_irr.schedule) ? _irr.schedule.slice(0, 7) : null;

            // Salinity engine result
            var _salinityResult = global.GAIP_SALINITY_RESULT || null;

            // Save whenever water input state exists
            if (_waterIn !== null) {
                cache.computed.waterBalance = {
                    // Source info
                    sourceLabel:  _label,
                    source:       _source,
                    testDate:     _date,
                    recycled:     _recycled,
                    // Core quality
                    ecw:          _ecw,
                    pH:           _pH,
                    SAR:          _SAR,
                    SARadj:       _SARadj,
                    RSC:          _RSC,
                    naPct:        _naPct,
                    leachingFraction: _LF,
                    LSI:          _LSI,
                    // Ions (meq/L)
                    ions: { Ca: _Ca, Mg: _Mg, Na: _Na, K: _K, HCO3: _HCO3, CO3: _CO3, Cl: _Cl, SO4: _SO4 },
                    measuredIons: _measuredIons,
                    // Toxicity raw (mg/L)
                    B:            _B,
                    Fe:           _Fe,
                    // GH-599: everything else the sample measured, in its own
                    // units. Nothing prints it today — checked by what the
                    // pages LOAD, not by what markup exists — so this changes
                    // the record and not the screen.
                    traceIons:    _traceIons,
                    // Irrigation balance
                    weeklyNeed:   _weeklyNeed,
                    netDeficit:   _netDeficit,
                    waterBalance: _wb || null,
                    schedule7:    _irr7 || null,
                    // Salinity impact — nulled when override is active because GAIP_SALINITY_RESULT
                    // and __GAIP_WATER_DIAGNOSTICS__ are computed during the cascade before the
                    // override patches _waterIn; they would reflect the pre-override water data.
                    salinity:     _wbOverride ? null : (_salinityResult || null),
                    diagnostics:  _wbOverride ? null : (Array.isArray(global.__GAIP_WATER_DIAGNOSTICS__) ? global.__GAIP_WATER_DIAGNOSTICS__ : null),
                };
                console.log('[GilbaPersist] Saved waterBalance to cache | ECw:', _ecw, '| pH:', _pH, '| SAR:', _SAR, '| LF:', _LF, '| source:', _waterIn ? 'found' : 'null');
            }
        } catch(e) {
            console.warn('[GilbaPersist] Failed to save waterBalance:', e);
        }

        // PGR result for /analysis#pgr-irrigation tab
        try {
            var _pgr = global.GAIP_PGR_RESULT;
            if (_pgr && !_pgr.error && _pgr.gdd) {
                cache.computed.pgr = {
                    success:          true,
                    applicationDate:  _pgr.applicationDate || null,
                    daysSince:        _pgr.daysSinceApplication || 0,
                    product: _pgr.product ? {
                        name:            _pgr.product.name,
                        type:            _pgr.product.type,
                        activeIngredient: _pgr.product.activeIngredient,
                    } : null,
                    gdd: {
                        accumulated:  _pgr.gdd.accumulated,
                        threshold:    _pgr.gdd.threshold,
                        remaining:    _pgr.gdd.remaining,
                        progressPct:  _pgr.gdd.progressPct,
                        days:         _pgr.gdd.days,
                        base:         _pgr.gdd.base || _pgr.gdd.baseTemp,
                        isOverdue:    !!_pgr.gdd.isOverdue,
                    },
                    effect: _pgr.effect ? {
                        suppressionPct:       _pgr.effect.suppressionPct,
                        phase:                _pgr.effect.phase,
                        phaseDescription:     _pgr.effect.phaseDescription,
                        reapplicationStatus:  _pgr.effect.reapplicationStatus,
                        isInRebound:          !!_pgr.effect.isInRebound,
                    } : null,
                    recommendation: _pgr.recommendation || null,
                    species: _pgr.species ? { key: _pgr.species.key, class: _pgr.species.class } : null,
                    surface: _pgr.surface || null,
                };
                console.log('[GilbaPersist] Saved pgr to cache | phase:', _pgr.effect && _pgr.effect.phase, '| progressPct:', _pgr.gdd.progressPct);
            }
        } catch(e) {
            console.warn('[GilbaPersist] Failed to save pgr:', e);
        }

        return cache;
    }

    /**
     * GH-560 — THE SOIL TEMPERATURE AT 100 mm, WHATEVER THE SOURCE CALLS IT.
     *
     * Two names for one depth, and they were about to matter. The canonical
     * state writes `depths.d100mm`; the physics model writes
     * `depths['100mm']` as `{current, mean}`. The collector asked for `d100mm`
     * only, so the moment the climate stopped being overwritten (the other half
     * of this fix) it would have started reading a value from one source and
     * still reading nothing from the other — a repair that looks finished and
     * is half done.
     *
     * This normalises the NAME. It does not invent a value: no default, no
     * estimate, no falling back to air temperature. Nothing found is `null`,
     * which is what makes the run `partial` and puts the reason on the screen
     * (GH-557), and that is the answer when a measurement is missing.
     */
    function soilTempAt100mm(src) {
        if (src == null) return null;
        if (typeof src === 'number') return src;

        var depths = src.depths || {};
        var candidates = [depths.d100mm, depths['100mm']];
        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            if (typeof c === 'number') return c;
            // The physics model reports a depth as `{current, mean}`.
            if (c && typeof c === 'object') {
                if (typeof c.current === 'number') return c.current;
                if (typeof c.mean === 'number') return c.mean;
            }
        }

        if (typeof src.estimated === 'number') return src.estimated;
        if (typeof src.current === 'number') return src.current;

        return null;
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
        // GH-562: the soil temperature has three possible homes and the run
        // fills whichever one it fills — the climate the collector is reading,
        // the canonical state that climate is built from, or the physics model's
        // own global. It is ONE measurement; which object holds it is an
        // accident of which step got there first.
        //
        // Measured live, twice: with the fallback on the `_cc` branch alone the
        // row still came back null, because this branch had fired — `gdd` and
        // `et` are `undefined` when `climateMetrics` has no such fields, and
        // `JSON.stringify` drops undefined, so a `_cm` run is indistinguishable
        // from a `_cc` run in the stored row. The branch was invisible, not
        // absent.
        var _soilTempAnywhere = function () {
            return soilTempAt100mm(_cm && _cm.soilTemp)
                ?? soilTempAt100mm(_cc && _cc.soilTemp)
                ?? soilTempAt100mm(global.GAIP_CANONICAL_STATE && global.GAIP_CANONICAL_STATE.soilTemp)
                ?? soilTempAt100mm(global.GAIP_SOIL_TEMP && global.GAIP_SOIL_TEMP.summary);
        };

        if (_cm) {
            metrics.growthPotential = _cm.growth?.weighted;
            metrics.gdd             = _cm.gdd?.today;
            metrics.et              = _cm.et?.daily;
            metrics.soilTemp        = _soilTempAnywhere();
        } else if (_cc) {
            metrics.growthPotential = _cc.growth?.weighted;
            // GH-561: and when the climate carries none, the physics model's own
            // answer is the other place it can be. Same measurement, filed under
            // another name by another step — not a substitute for it.
            //
            // `global.GAIP_SOIL_TEMP`, not the orchestrator's state: the model
            // is run by `climate-module-v2-ui.js` and its result never enters
            // `computed` at all. `cacheAnalysisResults` copies it into
            // `cache.computed.soilTempPhysics` LATER IN THE SAME FUNCTION, after
            // this collector has already returned — which is why reading it from
            // there looked right and measured `null` on the live run.
            metrics.soilTemp        = _soilTempAnywhere();
        }
        
        // Weather source — track whether data came from live API, cache, or manual override
        var _rawWx = global.rawWeatherData;
        var _wxStatus = global.GAIP_WeatherResilience && typeof global.GAIP_WeatherResilience.getStatus === 'function'
            ? global.GAIP_WeatherResilience.getStatus() : null;
        if (_rawWx && _rawWx._source === 'settings_override') {
            metrics.weatherSource = 'manual_override';
        } else if (_wxStatus && _wxStatus.source === 'manual_override') {
            metrics.weatherSource = 'manual_override';
        } else if (_wxStatus && (_wxStatus.status === 'cached' || _wxStatus.status === 'cached_stale')) {
            metrics.weatherSource = 'cache';
        } else if (_rawWx && (_rawWx._weatherStatus === 'live' || (_rawWx.forecast && !_rawWx.manualEntry))) {
            metrics.weatherSource = 'live';
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
            // #91: _fc.summary.topThreat/peakRisk come straight from the raw
            // (unfiltered) forecast — disease-forecast.js's generateForecast()
            // doesn't know about the Fusarium exclusion, only the chart-
            // rendering layer in disease-analysis.js does. Recompute the peak
            // from _fc.diseases with fusarium excluded instead of trusting
            // summary directly, so the dashboard verdict/vital-card/action-
            // queue forecast text can't surface it either.
            // Source: the single canonical forecast computed by
            // hub-orchestrator.js's Step 9 (_hubState.computed.forecast),
            // not the legacy window.GAIP_DISEASE_FORECAST global (which is
            // only ever set by the old /hub-page render() path and produces
            // different numbers — see the forecast-unification fix).
            const _fc = global.GaipOrchestrator && typeof global.GaipOrchestrator.getState === 'function'
                ? global.GaipOrchestrator.getState()?.computed?.forecast
                : null;
            if (_fc && _fc.summary) {
                const _fcAll = Array.isArray(_fc.diseases) ? _fc.diseases : [];
                const _fcValidated = _fcAll.filter((d) => d.key !== 'fusarium');
                const _fcPool = _fcValidated.length > 0 ? _fcValidated : _fcAll;
                const _fcTop = _fcPool.length > 0
                    ? _fcPool.reduce((a, b) => (!a || b.peakRisk > a.peakRisk) ? b : a, null)
                    : null;
                if (_fcTop) {
                    metrics.forecastPeak    = _fcTop.peakRisk;
                    metrics.peakDay         = _fcTop.peakDay != null ? _fcTop.peakDay : null;
                    metrics.forecastDisease = _fcTop.name || null;
                } else {
                    // No per-disease array available (older cached shape) — fall back to summary.
                    metrics.forecastPeak    = _fc.summary.peakRisk   || null;
                    metrics.peakDay         = _fc.summary.peakDay    != null ? _fc.summary.peakDay : null;
                    metrics.forecastDisease = _fc.summary.topThreat  || null;
                }
            }
        }
        
        // Companion surface disease (fairway/tee parallel analysis — golf greens only)
        const _cd = global.GAIP_COMPANION_DISEASE_RESULT;
        if (_cd && _cd._companionSurface && _cd.diseases) {
            metrics.companionDisease = {
                species:      _cd._companionSpecies      || null,
                speciesLabel: _cd._companionDisplayName  || _cd._companionSpecies || null,
                overallScore: _cd.overallScore != null ? Math.round(_cd.overallScore) : null,
                overallRisk:  _cd.overallRisk  || null,
                diseases: (_cd.diseases || [])
                    .filter(function(d) {
                        var r = d.adjustedRisk != null ? d.adjustedRisk : (d.riskScore != null ? d.riskScore : 0);
                        // #91: fusarium excluded here (raw key, before .map() below
                        // drops it) — the mapped shape has no .disease field, so
                        // filtering post-map wouldn't work.
                        return (r > 15 || (d.treatmentWindow && d.treatmentWindow.inWindow)) && d.disease !== 'fusarium';
                    })
                    .sort(function(a, b) {
                        var aw = (a.treatmentWindow && a.treatmentWindow.inWindow) ? 1 : 0;
                        var bw = (b.treatmentWindow && b.treatmentWindow.inWindow) ? 1 : 0;
                        if (bw !== aw) return bw - aw;
                        var ar = a.adjustedRisk != null ? a.adjustedRisk : (a.riskScore || 0);
                        var br = b.adjustedRisk != null ? b.adjustedRisk : (b.riskScore || 0);
                        return br - ar;
                    })
                    .slice(0, 5)
                    .map(function(d) {
                        var tw = d.treatmentWindow || {};
                        var rec = d.recommendation;
                        var rawDrivers = d.drivers;
                        var drivers = null;
                        if (rawDrivers && typeof rawDrivers === 'object') {
                            drivers = {};
                            Object.keys(rawDrivers).forEach(function(k) {
                                var dv = rawDrivers[k];
                                if (dv && (dv.value != null || dv.contribution != null)) {
                                    drivers[k] = {
                                        value:       dv.value != null ? dv.value : null,
                                        contribution: dv.contribution != null ? Math.round(dv.contribution) : null,
                                    };
                                }
                            });
                            if (!Object.keys(drivers).length) drivers = null;
                        }
                        return {
                            name:       d.displayName || d.name || d.disease,
                            risk:       Math.round(d.adjustedRisk != null ? d.adjustedRisk : (d.riskScore || 0)),
                            inWindow:   !!tw.inWindow,
                            soilTemp:   tw.soilTemp != null ? tw.soilTemp : null,
                            timing:     tw.timing || null,
                            drivers:    drivers,
                            recommendation: rec ? {
                                action:    rec.action    || null,
                                headline:  rec.headline  || rec.text || null,
                                timing:    rec.timing    || null,
                                products:  Array.isArray(rec.products) ? rec.products : [],
                            } : null,
                        };
                    }),
            };
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
        
        // Sensor VWC — from Hydrosight/TDR bridge (same priority chain as hub-orchestrator)
        var _sensorVwc = null;
        if (global.GAIP_Sensor && typeof global.GAIP_Sensor.hasData === 'function' && global.GAIP_Sensor.hasData()) {
            var _sd = global.GAIP_Sensor.getIrrigationData();
            if (_sd && _sd.vwc != null) _sensorVwc = _sd.vwc;
        }
        if (_sensorVwc == null && global.GAIP_SENSOR_DATA && global.GAIP_SENSOR_DATA.vwc != null) {
            _sensorVwc = global.GAIP_SENSOR_DATA.vwc;
        }
        if (_sensorVwc != null) metrics.vwc = _sensorVwc;

        // Irrigation need — mirror daily-dashboard.js fallback chain
        const _ir = global.GAIP_IrrigationResults || global.GAIP_IRRIGATION_RESULT;
        if (_ir) {
            metrics.irrigationNeed = _ir.weeklyNeed
                != null ? _ir.weeklyNeed
                : _ir.summary && _ir.summary.totalIrrigation != null ? _ir.summary.totalIrrigation
                : _ir.schedule ? _ir.schedule.reduce(function(s, d) { return s + ((d.irrigation && d.irrigation.totalDepth) || 0); }, 0)
                : null;
            metrics.irrigationDeficit = _ir.summary && _ir.summary.netDeficit != null
                ? _ir.summary.netDeficit : null;
        }
        
        return metrics;
    }

    /**
     * GH-548 (stage 3): there is no cached result to return.
     *
     * Nothing writes `gilba_hub_cache` any more, and the key left behind by an
     * older bundle is cleared on load rather than being served for the rest of
     * its twenty-four hours. Kept as a function returning null because callers
     * on the reports pages and the old hub test for it and handle nothing
     * perfectly well; deleting the name would only move the question.
     */
    function getCachedResults() {
        return null;
    }

    /** Remove the copy an older bundle may have left in this browser. */
    function dropLegacyResultCache() {
        try {
            localStorage.removeItem(CONFIG.keys.cache);
            localStorage.removeItem('gilba_hub_cache');
        } catch (e) {
            // A browser that refuses storage has nothing to drop.
        }
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
            
            // GH-548 (stage 3): drop the result copy an older bundle wrote
            // here, so it cannot be served as current for the rest of its life.
            dropLegacyResultCache();

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
                // GH-295: climate-normals-service.js's monthly-temps fetch is async and
                // frequently resolves after the 1s saveDebounce window that the events
                // above already triggered has fired and saved. nutrition-summary-
                // integration.js's GH-278 fix re-renders the Monthly N Distribution
                // correctly once this fires, but without this line nothing told
                // hub-persistence.js to re-save — so the persisted cache.computed.
                // soilNutrition.monthlyN stayed missing/stale (whatever the earlier save
                // captured), and soil-nutrition-analysis.js's renderMonthlyN() fell back
                // to climate.growth.dailyPattern (an 8-day forecast window), reproducing
                // the exact pre-GH-278 "all N crammed into one month" symptom on any
                // reload/Re-run where the fetch lost the race.
                'gaip:monthly-normals-ready',
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
            
            // GH-548 (stage 3): the analysis result is no longer copied
            // into localStorage. `gilba_hub_cache` was the browser's own copy of
            // a result the database already owns -- K1 of the plan's list -- and
            // a copy is a copy whether it is minutes or hours old: served back,
            // it prints figures from whenever it was written under today's
            // heading. The dashboard read it when the server had nothing to
            // give; it now shows the outcome instead ("no analysis has been run
            // for this site yet"), which is the difference between an empty
            // screen and an old one.
            //
            // The form's own state and preferences above are NOT a copy of a
            // server-owned object -- they are what the user typed into this page
            // and has not sent anywhere -- and they stay.

            // Persist to DB via API so the dashboard can read without localStorage
            // GH-547 (stage 2): `save()` no longer posts the analysis
            // result. This line fired on EVERY state save — every `input` and
            // `change` inside #gaip-hub, plus fourteen `gaip:*` events including
            // a site switch — so the result of a run was replaced by whatever
            // the page happened to be holding a moment later. That is the defect
            // in one line: the writer was an event of the page, not an act of a
            // person, and the body was "everything I have right now".
            //
            // The result is written once, by the runner, on completion. Saving
            // the form's own state to localStorage above is untouched.

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
        // GH-547 (stage 2): `syncToServer()` is gone, and the flag with it.
        // It was the second of three writers of the analysis result and the only
        // one anybody had tried to fence off — `GILBA_REPORTS_EXPORT`, set in one
        // view out of the four that load this file, which is why
        // /reports/forensic and /reports/scenarios wrote a result on every plain
        // open. A prohibition is a permission turned inside out, and it is
        // forgotten on the next page that embeds the bundle. There is nothing
        // left to fence: a page that was not opened as a runner does not write.

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
            
            // GH-536 (PLAN-samples-sync-FINAL, stage 3) -- THIS BLOCK IS NOT
            // ABOUT SAMPLES AND MUST NOT LEAVE WITH THEM.
            //
            // It used to sit inside `if (samples)`, where `samples` was the
            // browser copy read from CONFIG.keys.samples. What it actually does
            // is set the ACTIVE SITE: honour `gilba_import_active_site` if an
            // import just ran, otherwise match the server's own activeSiteId.
            // Deleting the key without lifting the block would have stopped
            // /hub setting its active site at all -- silently, since /hub is the
            // hidden calculation iframe and nobody watches it.
            //
            // The 200 ms timer it ran on is replaced by the ready event.
            // The timer was a guess at how long the restore takes, and it was
            // covered until now by the fact that a miss fell through to the
            // browser copy. There is no copy to fall through to.
            const _applyActiveSite536 = () => {
                        // If an import just happened, honour the imported site instead of
                        // forcing the PHP-active UUID (which would hide the imported data).
                        var _importSite = null;
                        try { _importSite = sessionStorage.getItem('gilba_import_active_site'); } catch (_e) {}
                        if (_importSite) {
                            try { sessionStorage.removeItem('gilba_import_active_site'); } catch (_e) {}
                            var _smI = global.GAIP_SampleManager;
                            if (_smI && typeof _smI.setActiveSite === 'function') {
                                var _listI = typeof _smI.getSiteList === 'function' ? _smI.getSiteList() : [];
                                if (_listI.some(function(s) { return s.id === _importSite; })) {
                                    _smI.setActiveSite(_importSite);
                                    // Tell the server which site is active so subsequent PHP
                                    // page loads (data.blade.php, etc.) open on the right site.
                                    try {
                                        var _csrf = (global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.csrfToken) || '';
                                        fetch('/api/active-site', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': _csrf },
                                            body: JSON.stringify({ site_id: _importSite })
                                        }).catch(function(){});
                                    } catch (_e) {}
                                    return;
                                }
                            }
                        }
                        // Default: ensure the active site matches PHP config.
                        var _cfgSite = global.GAIP_HUB_CONFIG && global.GAIP_HUB_CONFIG.activeSiteId;
                        if (_cfgSite && global.GAIP_SampleManager && typeof global.GAIP_SampleManager.setActiveSite === 'function') {
                            global.GAIP_SampleManager.setActiveSite(_cfgSite);
                        }
            };

            if (global._gaipSamplePersistenceReady) {
                _applyActiveSite536();
            } else {
                document.addEventListener('gaip:samples-persistence-ready', _applyActiveSite536, { once: true });
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
                // GH-536 (stage 3): `samples` no longer travels in this bundle.
                // The samples live in the database; a bundle carrying a copy of
                // them is the shape this stage removes.
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
            // GH-536 (stage 3): `data.samples` from an older bundle is ignored.
            // There is no key to put it in and no restore that would read it.
            
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

    // GH-578: the run's one limit, published rather than copied. `triggerAutoRun`
    // waits for the site's soil sample before starting a pass, and it must wait
    // for the same length of time this runner allows the whole run — two limits
    // in one run drift the way two copies of any rule drift.
    GilbaPersistence.RUN_BUDGET_MS = RUN_BUDGET_MS;

    // Export to global
    global.GilbaPersistence = GilbaPersistence;

})(typeof window !== 'undefined' ? window : this);
