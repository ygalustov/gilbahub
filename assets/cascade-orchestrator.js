/**
 * =============================================================================
 * GILBA CASCADE ORCHESTRATOR ADAPTER v1.3.0
 * =============================================================================
 * 
 * Bridge layer that provides the GilbaCascadeOrchestrator.runCascade() interface
 * expected by hub-tissue-v3.js, routing calls through GaipOrchestrator.
 * 
 * This adapter enables SSOT (Single Source of Truth) pattern by ensuring all
 * engine execution flows through the central orchestrator.
 * 
 * CHANGELOG v1.3.0:
 * - Added phytotoxicity-engine (Stage 2.6) integration
 * - Assesses direct plant damage risk from Na, Cl, B, HCO₃ in irrigation water
 * - Species-specific thresholds with variety modifiers
 * - Results now available in computed.phytotoxicity for scenarios/exports
 * 
 * CHANGELOG v1.2.0:
 * - Added stress-trajectory-engine (Stage 6) integration
 * - Projects multi-factor stress over time series
 * 
 * CHANGELOG v1.1.0:
 * - Added soil-structure-engine (v2.0.0) integration
 * - Stage 2.5 for structure analysis after water/salinity
 * 
 * RELATIONSHIP WITH HUB ORCHESTRATOR:
 * ─────────────────────────────────────────────────────────────────────────────
 * hub-orchestrator.js  = PRIMARY orchestrator. Owns _hubState, runs computeAll(),
 *                        resolves data sources, fires gaip:orchestrator-complete.
 * cascade-orchestrator.js (THIS FILE) = ADAPTER. Provides runCascade() interface
 *                           for hub-tissue-v3.js. Wraps each downstream engine
 *                           in try/catch, returns its results in
 *                           `result.state.computed`, publishes them onto
 *                           _hubState through GaipOrchestrator.mergeComputed()
 *                           (GH-575 — until then this line claimed it populated
 *                           _hubState and it did not, and twelve results a run
 *                           were dropped because of it), and fires
 *                           gaip:cascade-complete when done.
 *
 * USAGE:
 *   Include this file AFTER hub-orchestrator.js and BEFORE hub-tissue-v3.js
 * 
 * @version 1.3.0
 * @author Gilba Solutions
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /**
     * GH-681 (queue item 6a, item 2) — THE ENGINE MAP IS DERIVED FROM THE GRAPH.
     *
     * Sixteen engines were declared here by hand, and three of those entries had stopped
     * being true: `climate-engine`, `dew-prediction-engine` and `disease-engine` were in the
     * map while this adapter has no branch for any of them -- they run in the orchestrator.
     * A hand-written map drifts quietly because nothing compares it with the code.
     *
     * The engines of THIS adapter are the nodes whose handle is declared IN THIS FILE, which
     * the graph now states (the handles are qualified with their file). The `computed` key
     * each one writes is the root of its first declared output. So both facts come from the
     * one place that owns them.
     *
     * NO GRAPH, NO MAP. The page is handed the graph (`window.GAIP_DEPENDENCY_GRAPH`); with
     * nothing injected this adapter does not quietly fall back to a list of its own, because
     * a list of its own is what this change removes. `runCascade` reports the refusal.
     */
    const GRAPH = (typeof global.GAIP_DEPENDENCY_GRAPH === 'object' && global.GAIP_DEPENDENCY_GRAPH
        && global.GAIP_DEPENDENCY_GRAPH.nodes) ? global.GAIP_DEPENDENCY_GRAPH : null;

    function engineMapFromTheGraph(graph) {
        const out = {};
        if (!graph) return out;
        Object.keys(graph.nodes).forEach(function (id) {
            const node = graph.nodes[id] || {};
            const handles = Array.isArray(node.handle) ? node.handle : (node.handle ? [node.handle] : []);
            const mine = handles.some(function (h) {
                return typeof h === 'string' && h.indexOf('assets/cascade-orchestrator.js:') === 0;
            });
            if (!mine) return;
            const first = (node.outputs || []).find(function (o) {
                return typeof o === 'string' && o.indexOf('computed.') === 0;
            });
            if (!first) return;
            out[id] = first.slice('computed.'.length).split('.')[0];
        });

        return out;
    }

    /**
     * GH-781: the name this adapter writes its journal entries under. One place, so that a new writer here
     * cannot forget it and quietly have its record cleared by the next pass of the orchestrator.
     */
    const PRODUCER = 'cascade';

    const CASCADE_CONFIG = {
        version: '1.4.0',
        debug: false,
        engineMap: engineMapFromTheGraph(GRAPH),
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CASCADE_CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    /**
     * GH-573 — THE CASCADE'S OWN WARNINGS REACH THE RUN'S JOURNAL.
     *
     * This file had its own `warn`, separate from the orchestrator's, and it
     * went to the console and stopped there. That is why the owner's Re-run on
     * Test5 - NZ showed no Soil & Nutrition and said nothing about it: the MLSN
     * engine threw on values the sample store holds as strings, this adapter
     * caught it, "MLSN engine failed" went to a console nobody had open, and the
     * run reported itself complete.
     *
     * It now delegates to the orchestrator, which owns the journal. The fallback
     * is the old behaviour, for a page that loaded this file without the
     * orchestrator — not silence, and not an exception either.
     */
    function warn(message, data) {
        var reached = false;
        try {
            if (global.GaipOrchestrator && typeof global.GaipOrchestrator.recordProblem === 'function') {
                /**
                 * GH-781 (delivery 5) — THE SAME WORD TWICE, IN TWO ROLES, AND BOTH ARE MEANT.
                 *
                 * The first `'cascade'` is the MODULE a reader is told about; `PRODUCER` is WHO wrote the
                 * record, which is what keeps it alive across the passes of the orchestrator. Measured
                 * before this: a problem this adapter recorded was filed with no producer, and the next
                 * `runComputePass` removed it as one of its own — so a cascade that failed on its first
                 * pass reported nothing after the second.
                 */
                global.GaipOrchestrator.recordProblem('cascade', message, data, PRODUCER);
                reached = true;
            }
        } catch (e) {
            // never let bookkeeping break the cascade
        }
        if (!reached) {
            if (data !== undefined) {
                console.warn('[CascadeAdapter]', message, data);
            } else {
                console.warn('[CascadeAdapter]', message);
            }
        }
    }

    /**
     * Did this engine produce a result?
     *
     * Every `executeXEngine` above answers failure with `{status:'Error'}` or
     * `{status:'Not available'}` rather than by throwing, so the verdict is in
     * the returned value and does not have to be inferred from anything said
     * about it.
     */
    /**
     * GH-704 (queue item 3as) — TAKEN FROM `hub-orchestrator.js`, NOT KEPT HERE.
     *
     * This file used to carry its own copy of the predicate, identical to that one and measured to
     * agree with it on every input. Identical copies are the problem rather than the comfort: a
     * repair to either moves nothing any run can see, so the two part company without a sound. The
     * definition lives in `hub-orchestrator.js`, this file's own header requires that file to be
     * included first, and a case holds that no view loads this one without it.
     *
     * WITHOUT IT THE PASS REFUSES RATHER THAN JUDGES. A private fallback here would be the copy
     * coming straight back, and quietly: the pass would go on deciding what it produced with a
     * predicate that had stopped being shared.
     */
    function producedSomething(value) {
        if (typeof global.GAIP_producedSomething !== 'function') {
            throw new Error('GH-704: the produced predicate is not available — `hub-orchestrator.js`'
                + ' defines it and must be loaded before this file');
        }

        return global.GAIP_producedSomething(value);
    }

    // =========================================================================
    // ENGINE EXECUTION
    // =========================================================================

    /**
     * Execute MLSN/Soil engine
     * @param {Object} state - Hub state with soil and turf data
     * @param {Object} weather - Weather data
     * @returns {Object} MLSN results
     */
    /**
     * GH-574: the engine returns `{ html, nutrients }` now. The HTML is what
     * `computed.mlsn` has always held and is left alone; the rows are what the
     * nutrient cards are built from, instead of being scraped back out of the
     * markup. A failure keeps the shape it had, with both halves empty.
     */
    function executeMLSNEngine(state, weather) {
        if (typeof global.mlsnEngine === 'function') {
            try {
                var out = global.mlsnEngine(state, weather);
                // A build of the engine older than GH-574 returns the string.
                if (typeof out === 'string') return { html: out, nutrients: null };
                return { html: (out && out.html) || '', nutrients: (out && out.nutrients) || null };
            } catch (e) {
                warn('MLSN engine failed:', e);
                return { status: 'Error', recommendations: [], html: '', nutrients: null };
            }
        }
        return { status: 'Not available', recommendations: [], html: '', nutrients: null };
    }

    /**
     * Execute Water Quality engine
     * @param {Object} state - Hub state with water data
     * @returns {Object} Water quality results
     */
    function executeWaterEngine(state) {
        if (typeof global.waterEngine === 'function') {
            try {
                return global.waterEngine(state);
            } catch (e) {
                warn('Water engine failed:', e);
                return { status: 'Error' };
            }
        }
        return { status: 'Not available' };
    }

    /**
     * Execute Firmness Index engine
     * @param {Object} state - Hub state
     * @param {Object} weather - Weather data
     * @returns {Object} Firmness results
     */
    function executeFirmnessEngine(state, weather) {
        if (typeof global.gaip_firmness_engine === 'function') {
            try {
                return global.gaip_firmness_engine(state, weather);
            } catch (e) {
                warn('Firmness engine failed:', e);
                return { FI: 0, status: 'Error' };
            }
        }
        return { FI: 0, status: 'Not available' };
    }

    /**
     * Execute Nitrogen Optimum engine
     * @param {Object} state - Hub state
     * @param {Object} weather - Weather data
     * @returns {Object} N-opt results with status
     */
    function executeNoptEngine(state, weather) {
        if (typeof global.gaip_Nopt_engine === 'function') {
            try {
                const result = global.gaip_Nopt_engine(state, weather);
                if (!result || !result.Nopt || !result.growthData) {
                    throw new Error('N-opt engine returned invalid data');
                }
                const applied = parseFloat(state.turf?.nProgramKgHaYr) || 0;
                return {
                    opt: result.Nopt,
                    applied: applied,
                    status: applied < 0.8 * result.Nopt ? 'Insufficient' 
                          : applied > 1.2 * result.Nopt ? 'Excessive' 
                          : 'Adequate',
                    growthData: result.growthData,
                    baseOptimum: result.baseOptimum
                };
            } catch (e) {
                warn('N-opt engine failed:', e);
                return {
                    opt: 200,
                    applied: parseFloat(state.turf?.nProgramKgHaYr) || 0,
                    status: 'Unknown',
                    growthData: { weighted: 50, c3potential: 50, c4potential: 50, temperature: 20 },
                    baseOptimum: 200
                };
            }
        }
        return { opt: 200, applied: 0, status: 'Not available' };
    }

    /**
     * Execute Traffic engine
     * @param {Object} state - Hub state
     * @param {Object} weather - Weather data
     * @param {Object} firmnessResult - Results from firmness engine
     * @returns {Object} Traffic analysis results
     */
    function executeTrafficEngine(state, weather, firmnessResult) {
        if (typeof global.gaip_traffic_engine === 'function') {
            try {
                return global.gaip_traffic_engine(state, weather, firmnessResult);
            } catch (e) {
                warn('Traffic engine failed:', e);
                return { TrafficRisk: 0, recoveryProb: 0, recoveryWindow: 0 };
            }
        }
        return { TrafficRisk: 0, recoveryProb: 0, recoveryWindow: 0 };
    }

    /**
     * Execute Shade engine
     * @param {Object} state - Hub state
     * @param {Object} weather - Weather data
     * @returns {Object} Shade analysis results
     */
    function executeShadeEngine(state, weather) {
        if (typeof global.gaip_shade_engine === 'function') {
            try {
                const result = global.gaip_shade_engine(state, weather);
                global.GAIP_SHADE_RESULT = result;
                global.lastShadeMetrics = result;
                return result;
            } catch (e) {
                warn('Shade engine failed:', e);
                return { status: 'Error' };
            }
        }
        return { status: 'Not available' };
    }

    /**
     * Execute Salinity Penalty engine
     * @param {Object} state - Hub state
     * @returns {Object|null} Salinity penalty results
     */
    function executeSalinityEngine(state) {
        if (typeof global.gaip_salinity_penalty === 'function' && 
            state.water && state.water.ecw > 0) {
            try {
                const result = global.gaip_salinity_penalty(
                    state.water.ecw, 
                    state.turf?.grassSpecies || 'ryegrass'
                );
                global.GAIP_SALINITY_RESULT = result;
                return result;
            } catch (e) {
                warn('Salinity engine failed:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Execute Soil Structure engine
     * v2.0.0: Returns peer-reviewed calculations + informational categories
     * Does NOT return numeric infiltrationModifier or recoveryPenalty
     * 
     * @param {Object} state - Hub state with water and soil data
     * @param {Object} waterResult - Results from water engine
     * @returns {Object|null} Soil structure analysis results
     */
    function executeSoilStructureEngine(state, waterResult) {
        if (typeof global.GAIP_SoilStructure?.analyze === 'function') {
            try {
                const result = global.GAIP_SoilStructure.analyze(state, waterResult);
                global.GAIP_STRUCTURE_RESULT = result;
                log('Soil structure analysis complete', {
                    pathway: result.pathway,
                    adjSAR: result.calculations?.suarezSAR?.adjSAR,
                    infiltrationHazard: result.hazards?.infiltration?.category,
                    sodicityHazard: result.hazards?.sodicity?.category
                });
                return result;
            } catch (e) {
                warn('Soil structure engine failed:', e);
                return { available: false, error: e.message };
            }
        }
        return { available: false, reason: 'Engine not loaded' };
    }

    /**
     * Execute Phytotoxicity engine
     * Assesses direct plant damage risk from irrigation water chemistry
     * 
     * @param {Object} state - Hub state with water and turf data
     * @returns {Object|null} Phytotoxicity analysis results
     */
    function executePhytotoxicityEngine(state) {
        if (typeof global.gaip_analyzePhytotoxicity === 'function') {
            try {
                // Build water data object from state
                // Support both flat (state.water.Na) and nested (state.water.ions.Na) formats
                const ions = state.water?.ions || state.water || {};
                const waterData = {
                    Na: ions.Na || state.water?.Na || 0,
                    Cl: ions.Cl || state.water?.Cl || 0,
                    B: ions.B || state.water?.B || 0,
                    HCO3: ions.HCO3 || state.water?.HCO3 || 0
                };
                
                // Skip if no relevant water data
                if (waterData.Na === 0 && waterData.Cl === 0 && waterData.B === 0 && waterData.HCO3 === 0) {
                    return { available: false, reason: 'No phytotoxic ion data' };
                }
                
                const species = state.turf?.grassSpecies || 'perennial_ryegrass';
                const variety = state.turf?.variety || null;
                const irrigationMethod = state.irrigation?.method || 'sprinkler';
                
                const result = global.gaip_analyzePhytotoxicity(
                    waterData,
                    species,
                    variety,
                    irrigationMethod
                );
                
                global.GAIP_PHYTOTOXICITY_RESULT = result;
                
                log('Phytotoxicity analysis complete', {
                    species: result.species,
                    overallRisk: result.overallRisk,
                    assessmentCount: result.assessments?.length || 0,
                    priorityActions: result.priorityActions?.length || 0
                });
                
                return result;
            } catch (e) {
                warn('Phytotoxicity engine failed:', e);
                return { available: false, error: e.message };
            }
        }
        return { available: false, reason: 'Engine not loaded' };
    }

    /**
     * GH-787 (queue item 3vy): THE CASCADE NO LONGER RUNS THE WEAR ENGINE.
     *
     * `executeWearEngine` stood here and built the engine's inputs a second time, its own way: the growth
     * potential from `global.climateMetrics`, the traffic, construction, height of cut and soil moisture from
     * the old hub's form, and no temperature stress at all. Measured on the stand, last row of every site:
     * the two assemblies disagreed about the recovery window at 10 of 10 sites -- `Test5 - NZ` 17 days
     * against 7, `Russley` 28 against 12 -- and about the species they handed the engine at all 10. The
     * dependency graph now names one runner for that engine, and the list this file walks comes from the
     * graph, so nothing here calls it any more.
     */
    /**
     * Execute Turf Manager engine
     * @param {Object} state - Hub state
     * @param {Object} weather - Weather data
     * @param {Object} trafficResult - Results from traffic engine
     * @param {Object} firmnessResult - Results from firmness engine
     * @returns {Object} Turf manager warnings and recommendations
     */
    function executeTurfManagerEngine(state, weather, trafficResult, firmnessResult) {
        if (typeof global.gaip_turf_manager_engine === 'function') {
            try {
                return global.gaip_turf_manager_engine(state, weather, trafficResult, firmnessResult);
            } catch (e) {
                warn('Turf manager failed:', e);
                return { warnings: [] };
            }
        }
        return { warnings: [] };
    }

    /**
     * Execute Tissue Analysis engine
     * @param {Object} state - Hub state with tissue data
     * @param {Element} hubRoot - DOM root element for reading tissue inputs
     * @returns {Object|null} Tissue analysis results
     */
    function executeTissueEngine(state, hubRoot) {
        if (typeof global.GilbaTissueEngine !== 'undefined' && 
            typeof global.gaip_read_tissue_data === 'function') {
            try {
                const tissueData = global.gaip_read_tissue_data(hubRoot);
                if (!tissueData) {
                    log('No tissue data entered');
                    return null;
                }
                
                // Build context from state
                const context = { stress: false, pgr: false };
                if (state.soil) {
                    context.soil = {
                        pH: state.soil.pH_water || state.soil.pH_cacl2,
                        // GH-620: the same absence, carried rather than
                        // flattened — the twin of the state's own line.
                        Na_ppm: state.soil.ppm?.Na ?? null,
                        ppm: state.soil.ppm || {}
                    };
                }
                if (state.water) {
                    context.water = {
                        ecw: state.water.ecw || 0,
                        pH: state.water.pH || 7,
                        ions: state.water.ions || {}
                    };
                }
                
                const tissueInput = {
                    tissue: tissueData.tissue,
                    units: tissueData.units,
                    species: tissueData.speciesGroup,
                    speciesGroup: tissueData.speciesGroup,
                    growthState: tissueData.growthState,
                    sampleType: tissueData.sampleType,
                    context: context
                };
                
                const result = global.GilbaTissueEngine.compute(tissueInput);
                
                // Enrich status with ranges
                ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B', 'Na'].forEach(function(el) {
                    if (result.status[el]) {
                        result.status[el].value = result.normalized[el];
                        if (result.ranges.macros && result.ranges.macros[el]) {
                            result.status[el].range = result.ranges.macros[el];
                        } else if (result.ranges.traces && result.ranges.traces[el]) {
                            result.status[el].range = result.ranges.traces[el];
                        }
                    }
                });
                
                global.__GAIP_TISSUE_LAST__ = result;
                log('Tissue analysis complete');
                return result;
            } catch (e) {
                warn('Tissue engine failed:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Execute Stress Trajectory engine
     * Projects multi-factor stress over time series
     * 
     * @param {Object} state - Hub state with all environmental data
     * @param {Object} weather - Weather data with forecast
     * @param {Object} computed - All previously computed engine results
     * @returns {Object|null} Stress trajectory projection results
     */
    function executeStressTrajectoryEngine(state, weather, computed) {
        if (typeof global.GAIP_StressTrajectory?.project !== 'function') {
            log('Stress Trajectory engine not loaded');
            return { available: false, reason: 'Engine not loaded' };
        }
        
        try {
            // Build integrated state from all computed results
            const trajectoryState = {
                // Water stress inputs
                water: {
                    ecw: state.water?.ecw || 0,
                    sar: computed.water?.SAR || computed.soilStructure?.calculations?.suarezSAR?.adjSAR || 0,
                    salinityPenalty: computed.salinityPenalty?.growthPenaltyPct || 0
                },
                
                // Light stress inputs
                light: {
                    dli: computed.shade?.dliShaded || computed.shade?.DLI_total || computed.shade?.DLI_adj || null,
                    dliTarget: computed.shade?.dliTarget || null,
                    shadePercent: computed.shade?.shadePercent || 0
                },
                
                // Temperature stress inputs
                temperature: {
                    current: global.climateMetrics?.temperature?.current || 20,
                    min: global.climateMetrics?.temperature?.min || 10,
                    max: global.climateMetrics?.temperature?.max || 30,
                    // GH-734 (queue item 3az, delivery 2): the run's own result, from the
                    // `computed` this executor already receives -- it used to read the rendering
                    // panel's global, which is a different calculation of the same model.
                    soilTemp: computed?.soilTempPhysics?.raw?.T_50mm?.[0] || null
                },
                
                // Nutrition stress inputs
                nutrition: {
                    tissueN: state.tissue?.N || computed.tissue?.normalized?.N || null,
                    growthPotential: (function() { var _dp = global.climateMetrics?.growth?.dailyPattern; var _dp0 = _dp && _dp.length > 0 ? _dp[0] : null; return _dp0 && _dp0.weighted != null ? _dp0.weighted : (global.climateMetrics?.growth?.weighted || 50); })()
                },
                
                // Species context
                species: state.turf?.grassSpecies || 'couch',
                grassType: state.turf?.grassType || 'C4'
            };
            
            // Weather forecast for projection
            const weatherForecast = {
                forecast: weather?.forecast || global.rawWeatherData?.forecast || null,
                daily: global.rawWeatherData?.forecast?.daily || null
            };
            
            // Projection options
            const projectionOptions = {
                horizonDays: 14,
                includeRecoveryEstimate: true,
                includeTrendAnalysis: true
            };
            
            log('Running Stress Trajectory projection', {
                hasWaterData: trajectoryState.water.ecw > 0,
                hasDLI: trajectoryState.light.dli !== null,
                hasTissue: trajectoryState.nutrition.tissueN !== null,
                species: trajectoryState.species
            });
            
            const result = global.GAIP_StressTrajectory.project(
                trajectoryState, 
                weatherForecast, 
                projectionOptions
            );
            
            // Store for UI access
            global.GAIP_STRESS_TRAJECTORY_RESULT = result;
            
            log('Stress Trajectory projection complete', {
                currentStressIndex: result?.current?.stressIndex,
                trend: result?.trend?.direction,
                daysToRecovery: result?.recovery?.estimatedDays
            });
            
            return result;
            
        } catch (e) {
            warn('Stress Trajectory engine failed:', e);
            return { available: false, error: e.message };
        }
    }

    // =========================================================================
    // CASCADE ORCHESTRATION
    // =========================================================================

    /**
     * Run full cascade computation
     * 
     * This is the main entry point that hub-tissue-v3.js calls.
     * It orchestrates all engine execution in dependency order.
     * 
     * @param {Object} cascadeState - State object with { inputs, computed, derived }
     * @param {Object} overrides - Input overrides for scenario computation
     * @param {Object} options - Execution options
     * @param {boolean} options.fullRecompute - Force full recomputation
     * @param {string[]} options.includeEngines - List of engines to run
     * @param {Element} options.hubRoot - DOM root for tissue data reading
     * @param {number} options.passStartedAt - When the caller began this pass
     *        (GH-589). It is the CALLER's moment, not this function's: the
     *        state was collected there, and the runner compares it with the
     *        moment its inputs arrived. Absent: this function's own start.
     * @returns {Object} Result with { success, state, error, executionOrder }
     */
    function runCascade(cascadeState, overrides, options) {
        const startTime = Date.now();
        options = options || {};
        const passStartedAt = typeof options.passStartedAt === 'number' ? options.passStartedAt : startTime;
        
        log('Starting cascade computation', {
            hasInputs: !!cascadeState?.inputs,
            engineCount: options.includeEngines?.length || 'all',
            fullRecompute: options.fullRecompute
        });

        try {
            // Build unified state from cascade format
            const state = {
                climate: cascadeState.inputs?.climate || {},
                turf: cascadeState.inputs?.turf || {},
                soil: cascadeState.inputs?.soil || {},
                water: cascadeState.inputs?.water || {},
                tissue: cascadeState.inputs?.tissue || null,
                traffic: cascadeState.inputs?.schedule || {},
                shade: cascadeState.inputs?.site || {},
                pgr: cascadeState.inputs?.pgr || {},
                dmi: cascadeState.inputs?.dmi || {},
                siteHistory: cascadeState.inputs?.siteHistory || {},
                irrigation: cascadeState.inputs?.irrigation || {},
                fertility: cascadeState.inputs?.fertility || {},
                variety: cascadeState.inputs?.variety || null
            };

            // Get weather data (from global or cascade)
            const weather = global.rawWeatherData || 
                           cascadeState.inputs?.climate?.forecast || 
                           null;

            // Initialize computed results
            const computed = {};
            const executionOrder = [];

            // GH-681: the engines to run, and a refusal rather than a silent empty pass.
            // An empty engine list would produce a result with no modules in it and report
            // success -- the shape of "a run that answered nothing and said nothing".
            const requested = options.includeEngines || Object.keys(CASCADE_CONFIG.engineMap);
            if (!requested.length) {
                /**
                 * NO CODE IS INVENTED HERE. A refusal the RUNNER reports carries a code, and a
                 * code must carry a sentence a client reads — `Gh644NoIdentifierAnywhere`
                 * caught the one I had written, which had no sentence, so the panel would have
                 * printed the code itself. The words are the owner's.
                 *
                 * The refusal is therefore recorded where the pass keeps what went wrong, and
                 * the adapter simply does not run: an empty engine list would produce a result
                 * with no modules in it and report success.
                 */
                warn('the cascade was not given a dependency graph, so it has no engine list;'
                    + ' refusing rather than running an empty pass');

                return { success: false, state: null, refusedWithoutTheGraph: true };
            }

            /**
             * GH-777 (queue item 4, slice 3) — THE GATE IS THE GRAPH, AND IT IS THE PASS'S OWN GATE.
             *
             * A node declares what it cannot work without (`requires`), and this adapter asks the
             * orchestrator's `absentRequirementsOf` -- the same function that gates the pass -- rather than
             * writing a second one here. Where a requirement is absent the engine is NOT RUN and the module
             * is recorded as not applicable under its declared `module`, with the inputs named: that is what
             * lets the server tell "this client has no tissue sample" from "the engine answered nothing",
             * and what lets a section say why it is empty.
             *
             * WHAT THIS REPLACES. The tissue and MLSN engines used to run regardless and answer with
             * nothing, and one hand-written check in the row producer said `no-soil-sample` for the soil
             * half alone. A declaration in the graph covers both, and the check in the producer is gone --
             * two statements of one fact is what this item removes.
             */
            const engines = requested.filter(function (id) {
                const node = (GRAPH && GRAPH.nodes && GRAPH.nodes[id]) || null;
                const pass = global.GaipOrchestrator;
                if (!node || !pass || typeof pass.absentRequirementsOf !== 'function') return true;
                const absent = pass.absentRequirementsOf(node);
                if (!absent.length) return true;
                // The module's own name, as the graph declares it; without one nothing can be recorded
                // against it, which is the orchestrator's rule and it is not worked around here.
                if (typeof node.module !== 'string' || !node.module) {
                    warn('a node of the cascade is missing a requirement and declares no `module`,'
                        + ' so nothing could be recorded for it: ' + id);

                    return false;
                }
                // GH-795 (queue item 3vae): an absence whose reason is the pass's own is recorded by the
                // pass. The engine is still not run; what changes is who says why.
                if (typeof pass.absenceIsAnotherWriters === 'function'
                    && absent.every(pass.absenceIsAnotherWriters)) {
                    return false;
                }
                if (typeof pass.notApplicable === 'function') {
                    // GH-781: the record says who wrote it. A pass of the orchestrator clears its own
                    // entries at its start, and this one is the cascade's -- before, it was wiped and the
                    // reason never reached a stored row.
                    pass.notApplicable(node.module, 'this site has no ' + absent.join(', ') + ', so '
                        + node.module + ' does not apply to it', absent, PRODUCER);
                }

                return false;
            });

            // ─────────────────────────────────────────────────────────────────
            // STAGE 1: Base engines (no dependencies)
            // ─────────────────────────────────────────────────────────────────
            
            if (engines.includes('mlsn-calculator') || engines.includes('climate-engine')) {
                var mlsnOut = executeMLSNEngine(state, weather);
                // `computed.mlsn` keeps its meaning — the rendered table — so
                // every reader of it is untouched. The rows travel beside it.
                computed.mlsn = mlsnOut.status ? mlsnOut : mlsnOut.html;
                computed.mlsnRows = mlsnOut.nutrients;
                executionOrder.push('mlsn-calculator');
            }

            if (engines.includes('water-blender')) {
                computed.water = executeWaterEngine(state);
                computed.waterBlend = computed.water; // Alias
                executionOrder.push('water-blender');
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 2: Climate-dependent engines
            // ─────────────────────────────────────────────────────────────────

            if (engines.includes('firmness-engine')) {
                computed.firmness = executeFirmnessEngine(state, weather);
                executionOrder.push('firmness-engine');
            }

            if (engines.includes('nopt-engine')) {
                /**
                 * GH-781 (delivery 5, the reviewer's reading of 30.09.2026) — AN ENTERED ZERO IS A FIGURE
                 * THE SITE GAVE, AND ABSENCE IS NOT A ZERO.
                 *
                 * `parseFloat(...) || 0` turned "nothing entered" into 0, and the branch below then turned
                 * that 0 back into `null` with a second `||`. Two substitutions in three lines, cancelling
                 * out for the absent case and erasing the one figure a site can enter that means something
                 * definite: zero. That is the rule we burned on in GH-731, where `> 0` read an entered zero
                 * as an unanswered question.
                 *
                 * The form is the one already used correctly elsewhere in this tree —
                 * `nutrition-requirement-engine.js` asks `turf.nProgramKgHaYr != null` before using it.
                 *
                 * `monthlyN` below keeps its shape, and that is named rather than quietly fixed: a monthly
                 * figure of 0 is indistinguishable there from none, which is the same class and a different
                 * place (`state.fertility`, written by another producer). Not widened into this delivery.
                 */
                const nRateParsed = parseFloat(state.turf && state.turf.nProgramKgHaYr);
                const nRate = isFinite(nRateParsed) ? nRateParsed : null;
                /**
                 * GH-781 (delivery 5, the reviewer's finding) - AND THE MONTHLY FIGURE TOO.
                 *
                 * The annual programme stopped being erased by `|| 0` in this same expression; this
                 * one was left, and it carries the same fault one field along: a monthly figure
                 * entered as ZERO came out indistinguishable from none entered, so a site that had
                 * answered "none applied this month" was told "No monthly N figure entered".
                 *
                 * WHAT DOES NOT CHANGE, named rather than quietly kept: `hasNData` still asks for a
                 * figure above zero, so the same sites run the engine as before. Whether a month with
                 * zero applied should be computed rather than skipped is a question about the product.
                 */
                const monthlyParsed = parseFloat(state.fertility && state.fertility.monthlyN);
                const monthlyN = isFinite(monthlyParsed) ? monthlyParsed : null;
                const hasNData = monthlyN !== null && monthlyN > 0;
                if (hasNData) {
                    computed.nitrogen = executeNoptEngine(state, weather);
                    executionOrder.push('nopt-engine');
                } else {
                    // Skip N-opt when no monthly N rate entered — not an error
                    /**
                     * GH-781 (delivery 2) — NO PROGRAMME, NO NUMBER. The `200` that stood here was a
                     * substitution: a site that has entered no annual nitrogen programme received one this
                     * file chose. Measured before removing it: 4 of 110 stored rows carry `nitrogen.opt`
                     * exactly 200, two sites of thirteen in their latest row, and no page or template of this
                     * project prints `nitrogen.opt` at all -- so it reached nobody and was waiting for its
                     * first reader. Absence travels as absence (the owner's rule of 17.09.2026).
                     */
                    /**
                     * GH-781 (delivery 5) — AND THE SENTENCE BESIDE THE FIGURE SAYS WHICH CASE IT IS.
                     *
                     * One sentence stood here for two different situations, so a site whose annual programme
                     * IS entered and whose monthly figure is not was told "No N programme entered" beside the
                     * programme's own number. The figure and the words disagreed, and only the figure had a
                     * guard.
                     *
                     * NAMED, NOT FIXED HERE: `status` is read as a VOCABULARY by `smith-kerns-model.js`,
                     * which compares it with 'deficient' and 'low' and otherwise labels the modifier with
                     * whatever string it finds. A sentence in a field of states is the wider defect; this
                     * delivery makes the sentence true and leaves that question where it can be decided.
                     */
                    /**
                     * GH-781 - THE OWNER'S DECISION OF 30.09.2026: put it back as it was.
                     *
                     * The annual figure of a site with no programme entered is 200 again, as it was before this
                     * item's second delivery removed it. Measured then and reported to her: 4 of 110 stored rows
                     * carried that figure, no page prints `nitrogen.opt`, and the disease model reads it as a
                     * ratio against `applied: 0`, so the two sites without a programme are told "deficient" once
                     * more. The wider question - the monthly field and whether Settings should ask for it - is
                     * hers and is carried as an open question, not decided here.
                     *
                     * AND THE ENTERED ZERO IS STILL A FIGURE. Her answer was about "no programme entered"; an
                     * annual programme entered AS zero is a different case and she did not name it, so it is not
                     * turned into 200 by this. Measured before restoring: 0 of 21 site configs carry an annual
                     * figure at all and 0 rows carry `opt: 0`, so nothing on the stand changes either way - the
                     * distinction is kept because widening her decision would be our choice, not hers.
                     */
                    computed.nitrogen = {
                        opt: nRate === null ? 200 : nRate,
                        applied: 0,
                        status: nRate === null
                            ? 'No N programme entered'
                            : (monthlyN === null
                                ? 'No monthly N figure entered, so the annual programme is not distributed'
                                : 'Monthly N entered as zero, so the annual programme is not distributed'),
                        skipped: true
                    };
                    executionOrder.push('nopt-engine (skipped)');
                }
            }

            if (engines.includes('shade-engine')) {
                computed.shade = executeShadeEngine(state, weather);
                executionOrder.push('shade-engine');
            }

            if (engines.includes('salinity-penalty-engine')) {
                computed.salinityPenalty = executeSalinityEngine(state);
                executionOrder.push('salinity-penalty-engine');
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 2.5: Soil Structure Analysis (after water/salinity, before wear)
            // v2.0.0: Outputs categories only, no numeric modifiers
            // ─────────────────────────────────────────────────────────────────

            if (engines.includes('soil-structure-engine')) {
                computed.soilStructure = executeSoilStructureEngine(state, computed.water);
                executionOrder.push('soil-structure-engine');
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 2.6: Phytotoxicity Analysis (direct plant damage from water)
            // Assesses Na, Cl, B, HCO₃ toxicity risk by species
            // ─────────────────────────────────────────────────────────────────

            if (engines.includes('phytotoxicity-engine')) {
                computed.phytotoxicity = executePhytotoxicityEngine(state);
                executionOrder.push('phytotoxicity-engine');
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 3: Dependent engines (need results from Stage 2)
            // ─────────────────────────────────────────────────────────────────

            if (engines.includes('traffic-engine')) {
                computed.traffic = executeTrafficEngine(state, weather, computed.firmness);
                executionOrder.push('traffic-engine');
            }

            if (engines.includes('turf-manager-engine')) {
                computed.turfManager = executeTurfManagerEngine(
                    state, weather, 
                    computed.traffic, 
                    computed.firmness
                );
                executionOrder.push('turf-manager-engine');
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 4: Tissue engine (requires DOM access)
            // ─────────────────────────────────────────────────────────────────

            if (engines.includes('tissue-engine') && options.hubRoot) {
                computed.tissue = executeTissueEngine(state, options.hubRoot);
                executionOrder.push('tissue-engine');
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 5: Climate metrics sync
            // ─────────────────────────────────────────────────────────────────

            if (global.climateMetrics) {
                computed.climate = global.climateMetrics;
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 6: Stress Trajectory (integrates all prior results)
            // Projects multi-factor stress over time series
            // ─────────────────────────────────────────────────────────────────

            if (engines.includes('stress-trajectory-engine')) {
                computed.stressTrajectory = executeStressTrajectoryEngine(
                    state, 
                    weather, 
                    computed  // Pass all computed results for integration
                );
                executionOrder.push('stress-trajectory-engine');
            }

            // ─────────────────────────────────────────────────────────────────
            // Build result
            // ─────────────────────────────────────────────────────────────────

            const duration = Date.now() - startTime;

            // GH-573 — THE SWEEP, and it is one place rather than sixteen.
            // `computed` holds what this cascade ran, keyed by module, and each
            // engine's own return value says whether it produced. So every
            // module that answered with nothing is named here, from the result
            // and not from anything written about it.
            try {
                if (global.GaipOrchestrator && typeof global.GaipOrchestrator.noteSkipped === 'function') {
                    /**
                     * GH-781 — UNDER THE NAME THE SECTION LOOKS FOR, AND MARKED AS THE CASCADE'S.
                     *
                     * This wrote the `computed` KEY as the module (`soilStructure`, `turfManager`…), while the
                     * server finds the cause of an empty section by the node's declared `module` (GH-777). For
                     * the six engines that declared none the record could not be found at all; delivery 2 gave
                     * them names. And the entry now says the cascade wrote it, so the next pass of the
                     * orchestrator no longer clears it.
                     */
                    const moduleOfKey = {};
                    if (GRAPH && GRAPH.nodes) {
                        Object.keys(GRAPH.nodes).forEach(function (id) {
                            const node = GRAPH.nodes[id] || {};
                            const first = (node.outputs || []).find(function (o) {
                                return typeof o === 'string' && o.indexOf('computed.') === 0;
                            });
                            if (!first || typeof node.module !== 'string' || !node.module) return;
                            moduleOfKey[first.slice('computed.'.length).split('.')[0]] = node.module;
                        });
                    }
                    Object.keys(computed).forEach(function (key) {
                        if (producedSomething(computed[key])) return;
                        const module = moduleOfKey[key];
                        if (!module) {
                            warn('an engine of this adapter produced nothing under the key "' + key
                                + '" and no node of the graph declares a module for it, so the run cannot'
                                + ' record it against a name');

                            return;
                        }
                        global.GaipOrchestrator.noteSkipped(module, module, 'engine-produced-nothing',
                            key, PRODUCER);
                    });
                }
            } catch (e) {
                // never let bookkeeping break the cascade
            }

            // GH-575 — AND THE RESULTS GO WHERE THE REST OF THE RUN CAN SEE
            // THEM. Everything above was built into a local object, handed back
            // and forgotten: `hub-persistence.js` assembles the stored result
            // from `GAIP_STATE`, which is the hub orchestrator's state, so the
            // cascade's fifteen results reached nobody. Twelve of them were
            // lost on every run, `mlsn` among them — the nutrient cards the
            // owner could not see.
            try {
                if (global.GaipOrchestrator && typeof global.GaipOrchestrator.mergeComputed === 'function') {
                    var merged = global.GaipOrchestrator.mergeComputed(computed);
                    log('Cascade results published to the hub state', merged);
                } else {
                    warn('Hub orchestrator not available: cascade results reach nobody');
                }
            } catch (e) {
                warn('Publishing cascade results failed:', e);
            }

            log(`Cascade completed in ${duration}ms`, { 
                enginesRun: executionOrder.length 
            });

            const result = {
                success: true,
                state: {
                    inputs: cascadeState.inputs,
                    computed: computed,
                    derived: cascadeState.derived || {}
                },
                executionOrder: executionOrder,
                duration: duration,
                // GH-589 (link 4): WHEN this pass began. The runner will
                // not store a result whose cascade pass began before the site's
                // samples arrived — the pass that answered with ten rows of
                // "NOT MEASURED" over a sample it never saw — and it has no
                // other way to tell that pass from the one that replaced it.
                passStartedAt: passStartedAt
            };

            // ─────────────────────────────────────────────────────────────────
            // Dispatch cascade-complete event for observability layer
            // (Prediction Logger subscribes to this for outcome logging)
            // ─────────────────────────────────────────────────────────────────
            try {
                document.dispatchEvent(new CustomEvent('gaip:cascade-complete', {
                    detail: result
                }));
            } catch (eventError) {
                // Non-fatal: don't let event dispatch break cascade
                warn('Failed to dispatch cascade-complete event:', eventError);
            }

            return result;

        } catch (e) {
            warn('Cascade execution failed:', e);

            return {
                success: false,
                error: e.message || 'Unknown cascade error',
                state: cascadeState,
                passStartedAt: passStartedAt
            };
        }
    }

    /**
     * Run selective recomputation based on changed inputs
     * @param {string[]} changedPaths - Input paths that changed
     * @param {Object} cascadeState - Current cascade state
     * @returns {Object} Updated state
     */
    function runSelective(changedPaths, cascadeState) {
        // For now, delegate to full cascade
        // Future: Use GilbaDependencyGraph for selective execution
        log('Selective recomputation requested', { paths: changedPaths });
        return runCascade(cascadeState, {}, { fullRecompute: true });
    }

    /**
     * Run isolated scenario computation without affecting global state
     * @param {Object} scenarioInputs - Modified inputs for scenario
     * @param {Object} baseState - Base state to modify
     * @returns {Object} Scenario results
     */
    function runScenario(scenarioInputs, baseState) {
        log('Running isolated scenario', { 
            overrides: Object.keys(scenarioInputs) 
        });
        
        // Deep clone base state
        const scenarioState = JSON.parse(JSON.stringify(baseState));
        
        // Apply scenario overrides
        Object.keys(scenarioInputs).forEach(function(path) {
            const parts = path.split('.');
            let target = scenarioState.inputs;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!target[parts[i]]) target[parts[i]] = {};
                target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = scenarioInputs[path];
        });
        
        return runCascade(scenarioState, scenarioInputs, { fullRecompute: true });
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    /**
     * GilbaCascadeOrchestrator - The interface expected by hub-tissue-v3.js
     */
    global.GilbaCascadeOrchestrator = {
        version: CASCADE_CONFIG.version,
        
        // Main cascade execution
        runCascade: runCascade,
        
        // Selective/scenario execution
        runSelective: runSelective,
        runScenario: runScenario,
        
        // Configuration
        getConfig: function() { return CASCADE_CONFIG; },
        getEngineMap: function() { return CASCADE_CONFIG.engineMap; },
        
        // Debug
        setDebug: function(enabled) { CASCADE_CONFIG.debug = enabled; }
    };

    // Also expose as alias for consistency
    global.CascadeOrchestrator = global.GilbaCascadeOrchestrator;

    // =========================================================================
    // EVENT LISTENERS - Re-run dependent engines when inputs change
    // =========================================================================

    /**
     * Listen for water blend updates and re-run soil structure analysis
     * This completes the Water → Soil Structure → Infiltration loop
     */
    if (typeof document !== 'undefined') {
        document.addEventListener('gaip:water-updated', function(e) {
            log('Water blend updated - triggering soil structure re-analysis');
            
            // Only re-run if soil structure engine is available
            if (typeof global.GAIP_SoilStructure?.analyze !== 'function') {
                log('Soil structure engine not loaded - skipping');
                return;
            }
            
            try {
                var waterState = e.detail || global.__GAIP_STATE__?.water;
                var state = global.__GAIP_STATE__ || {};
                
                if (waterState) {
                    state.water = waterState;
                }
                
                var structureResult = global.GAIP_SoilStructure.analyze(state, waterState);
                global.GAIP_STRUCTURE_RESULT = structureResult;
                
                log('Soil structure re-analysis complete', {
                    pathway: structureResult.pathway,
                    infiltrationHazard: structureResult.hazards?.infiltration?.category
                });
                
                // Dispatch event for UI update
                document.dispatchEvent(new CustomEvent('gaip:soil-structure-updated', {
                    detail: structureResult
                }));
                
            } catch (err) {
                warn('Soil structure re-analysis failed:', err);
            }
        });
    }


})(typeof window !== 'undefined' ? window : this);
