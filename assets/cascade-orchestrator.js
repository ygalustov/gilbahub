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
 *                           in try/catch, populates computed.* results on _hubState,
 *                           fires gaip:cascade-complete when done.
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

    const CASCADE_CONFIG = {
        version: '1.3.0',
        debug: false,
        
        // Engine ID mapping for cascade operations
        engineMap: {
            'climate-engine': 'climate',
            'firmness-engine': 'firmness',
            'nopt-engine': 'nitrogen',
            'traffic-engine': 'traffic',
            'shade-engine': 'shade',
            'salinity-penalty-engine': 'salinity',
            'soil-structure-engine': 'soilStructure',
            'phytotoxicity-engine': 'phytotoxicity',
            'wear-recovery-engine': 'wear',
            'turf-manager-engine': 'turfManager',
            'tissue-engine': 'tissue',
            'mlsn-engine': 'mlsn',
            'water-engine': 'water',
            'dew-prediction-engine': 'dew',
            'disease-engine': 'disease',
            'stress-trajectory-engine': 'stressTrajectory'
        }
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

    function warn(message, data) {
        if (data !== undefined) {
            console.warn('[CascadeAdapter]', message, data);
        } else {
            console.warn('[CascadeAdapter]', message);
        }
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
    function executeMLSNEngine(state, weather) {
        if (typeof global.mlsnEngine === 'function') {
            try {
                return global.mlsnEngine(state, weather);
            } catch (e) {
                warn('MLSN engine failed:', e);
                return { status: 'Error', recommendations: [] };
            }
        }
        return { status: 'Not available', recommendations: [] };
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
     * Execute Wear & Recovery engine
     * @param {Object} state - Hub state
     * @param {Object} weather - Weather data with growth potential
     * @param {Object} shadeResult - Results from shade engine
     * @param {Object} firmnessResult - Results from firmness engine
     * @param {Object} salinityResult - Results from salinity engine
     * @returns {Object|null} Wear analysis results
     */
    function executeWearEngine(state, weather, shadeResult, firmnessResult, salinityResult) {
        if (typeof global.gaip_run_wear_analysis === 'function') {
            try {
                // Build weather with growth potential
                const weatherWithGP = weather || {};
                if (global.climateMetrics && global.climateMetrics.growth) {
                    let growthPotential = global.climateMetrics.growth.weighted || 50;
                    let salinityModifier = 1;
                    
                    if (salinityResult && salinityResult.relativeYieldPct < 100) {
                        salinityModifier = salinityResult.relativeYieldPct / 100;
                    }
                    
                    weatherWithGP.growthPotential = Math.round(growthPotential * salinityModifier);
                    weatherWithGP.growthC3 = global.climateMetrics.growth.c3;
                    weatherWithGP.growthC4 = global.climateMetrics.growth.c4;
                    weatherWithGP.salinityModifier = salinityModifier;
                }
                
                // Build state with salinity penalty
                const stateWithSalinity = Object.assign({}, state, {
                    salinityPenalty: salinityResult ? {
                        active: salinityResult.growthPenaltyPct > 0,
                        growthModifier: salinityResult.relativeYieldPct / 100,
                        penaltyPct: salinityResult.growthPenaltyPct,
                        ecw: salinityResult.ecwInput,
                        status: salinityResult.status
                    } : null
                });
                
                return global.gaip_run_wear_analysis(stateWithSalinity, weatherWithGP, shadeResult, firmnessResult);
            } catch (e) {
                warn('Wear engine failed:', e);
                return null;
            }
        }
        return null;
    }

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
                        Na_ppm: state.soil.ppm?.Na || 0,
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
                    soilTemp: global.GAIP_SOIL_TEMP?.raw?.T_50mm?.[0] || null
                },
                
                // Nutrition stress inputs
                nutrition: {
                    tissueN: state.tissue?.N || computed.tissue?.normalized?.N || null,
                    growthPotential: global.climateMetrics?.growth?.weighted || 50
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
     * @returns {Object} Result with { success, state, error, executionOrder }
     */
    function runCascade(cascadeState, overrides, options) {
        const startTime = Date.now();
        options = options || {};
        
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

            // Determine which engines to run
            const engines = options.includeEngines || Object.keys(CASCADE_CONFIG.engineMap);

            // ─────────────────────────────────────────────────────────────────
            // STAGE 1: Base engines (no dependencies)
            // ─────────────────────────────────────────────────────────────────
            
            if (engines.includes('mlsn-engine') || engines.includes('climate-engine')) {
                computed.mlsn = executeMLSNEngine(state, weather);
                executionOrder.push('mlsn-engine');
            }

            if (engines.includes('water-engine')) {
                computed.water = executeWaterEngine(state);
                computed.waterBlend = computed.water; // Alias
                executionOrder.push('water-engine');
            }

            // ─────────────────────────────────────────────────────────────────
            // STAGE 2: Climate-dependent engines
            // ─────────────────────────────────────────────────────────────────

            if (engines.includes('firmness-engine')) {
                computed.firmness = executeFirmnessEngine(state, weather);
                executionOrder.push('firmness-engine');
            }

            if (engines.includes('nopt-engine')) {
                const nRate = parseFloat(state.turf?.nProgramKgHaYr) || 0;
                const monthlyN = parseFloat(state.fertility?.monthlyN) || 0;
                const hasNData = monthlyN > 0;
                if (hasNData) {
                    computed.nitrogen = executeNoptEngine(state, weather);
                    executionOrder.push('nopt-engine');
                } else {
                    // Skip N-opt when no monthly N rate entered — not an error
                    computed.nitrogen = {
                        opt: nRate || 200,
                        applied: 0,
                        status: 'No N programme entered',
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

            if (engines.includes('wear-recovery-engine')) {
                computed.wear = executeWearEngine(
                    state, weather, 
                    computed.shade, 
                    computed.firmness, 
                    computed.salinityPenalty
                );
                computed.wearRecovery = computed.wear; // Alias
                executionOrder.push('wear-recovery-engine');
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
                duration: duration
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
                state: cascadeState
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
