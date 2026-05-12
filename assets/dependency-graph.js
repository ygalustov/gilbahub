/**
 * =============================================================================
 * GILBA HUB DEPENDENCY GRAPH v1.0.0
 * =============================================================================
 *
 * Formalizes the dependency relationships between hub engines as a directed
 * acyclic graph (DAG). Enables true dependency propagation for scenario
 * comparison and selective recomputation.
 *
 * KEY CONCEPTS:
 * - Each engine declares its dependencies (what it reads)
 * - The graph enables queries like "what needs recomputing if X changes?"
 * - Topological sort ensures correct execution order
 * - Input-to-engine mapping answers "which engines care about this input?"
 *
 * USE CASES:
 * - Scenario Engine: "If I change water.ecw, what outputs change?"
 * - Orchestrator: "Recompute only what's necessary after input change"
 * - Debugging: "Why did disease risk change? Trace the causality."
 *
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const GRAPH_VERSION = '1.0.0';

    // =========================================================================
    // ENGINE DEPENDENCY DECLARATIONS
    // =========================================================================

    /**
     * Each engine declares:
     * - id: Unique identifier
     * - inputs: Array of input paths it reads (from state.inputs.*)
     * - engines: Array of engine IDs whose output it depends on
     * - outputs: Array of output paths it writes (for documentation)
     * - category: Grouping for UI/visualization
     */
    const ENGINE_DEFINITIONS = {

        // ─────────────────────────────────────────────────────────────────────
        // TIER 1: FOUNDATIONAL (No engine dependencies, only raw inputs)
        // ─────────────────────────────────────────────────────────────────────

        'climate-engine': {
            id: 'climate-engine',
            label: 'Climate Engine',
            category: 'foundation',
            inputs: ['climate', 'site.latitude', 'site.longitude', 'turf.species', 'turf.grassSpecies', 'turf.warmBase', 'turf.coolOverseed'],
            engines: [],
            outputs: ['computed.climate', 'derived.growthPotential'],
            description: 'Processes weather data, calculates growth potential, GDD, ET₀'
        },

        'ambient-dli-engine': {
            id: 'ambient-dli-engine',
            label: 'Ambient DLI Engine',
            category: 'foundation',
            inputs: ['site.latitude', 'climate.solarRadiation'],
            engines: ['climate-engine'],
            outputs: ['computed.ambientDLI'],
            description: 'Calculates open-field DLI baseline from solar radiation'
        },

        // ─────────────────────────────────────────────────────────────────────
        // TIER 2: ENVIRONMENTAL MODIFIERS
        // ─────────────────────────────────────────────────────────────────────

        'dew-prediction-engine': {
            id: 'dew-prediction-engine',
            label: 'Dew Prediction Engine',
            category: 'environmental',
            inputs: ['turf.turfType', 'schedule.nextMatch'],
            engines: ['climate-engine'],
            outputs: ['computed.dew', 'computed.dew.leafWetness'],
            description: 'Predicts leaf wetness duration from temperature and humidity'
        },

        'shade-engine': {
            id: 'shade-engine',
            label: 'Shade Engine',
            category: 'environmental',
            inputs: [
                'site.latitude', 'site.shadePercent', 'turf.species', 'turf.grassSpecies', 'turf.heightOfCut',
                'shade.svf', 'shade.treeOcclusion', 'shade.morningSky', 'shade.middaySky', 
                'shade.afternoonSky', 'shade.facadeAngle', 'turf.dli',
                'turf.ledPPFD', 'turf.ledHours'
            ],
            engines: ['climate-engine', 'ambient-dli-engine'],
            outputs: ['computed.shade', 'computed.shade.dli', 'computed.shade.stressFactor'],
            description: 'Calculates DLI deficit and shade stress from site characteristics'
        },

        'salinity-penalty-engine': {
            id: 'salinity-penalty-engine',
            label: 'Salinity Penalty Engine',
            category: 'environmental',
            inputs: ['water.ecw', 'water.EC', 'water.Na', 'water.Cl', 'turf.species', 'turf.grassSpecies', 'soil.gypsum'],
            engines: [],
            outputs: ['computed.salinity', 'computed.salinity.growthPenaltyPct'],
            description: 'Calculates Maas-Hoffman yield reduction from water salinity'
        },

        'phytotoxicity-engine': {
            id: 'phytotoxicity-engine',
            label: 'Phytotoxicity Engine',
            category: 'environmental',
            inputs: ['water.Na', 'water.Cl', 'water.B', 'water.HCO3', 'turf.species', 'turf.grassSpecies'],
            engines: [],
            outputs: ['computed.phytotoxicity'],
            description: 'Assesses direct foliar/root damage from specific ions'
        },

        // ─────────────────────────────────────────────────────────────────────
        // TIER 3: STRESS AGGREGATION
        // ─────────────────────────────────────────────────────────────────────

        'stress-aggregator': {
            id: 'stress-aggregator',
            label: 'Stress Aggregator',
            category: 'integration',
            inputs: ['turf.species', 'turf.grassSpecies'],
            engines: ['climate-engine', 'shade-engine', 'salinity-penalty-engine'],
            outputs: ['computed.stress', 'derived.combinedGrowthModifier', 'derived.environmentalStressIndex'],
            description: 'Combines temperature, shade, salinity, moisture stress into unified index'
        },

        // ─────────────────────────────────────────────────────────────────────
        // TIER 4: ANALYSIS ENGINES
        // ─────────────────────────────────────────────────────────────────────

        'tissue-engine': {
            id: 'tissue-engine',
            label: 'Tissue Engine',
            category: 'nutrition',
            inputs: ['tissue', 'turf.species', 'turf.grassSpecies'],
            engines: [],
            outputs: ['computed.tissue'],
            description: 'Interprets tissue test results against species-specific ranges'
        },

        'mlsn-calculator': {
            id: 'mlsn-calculator',
            label: 'MLSN Calculator',
            category: 'nutrition',
            inputs: ['soil', 'turf.species', 'turf.grassSpecies', 'turf.turfType'],
            engines: ['tissue-engine'],
            outputs: ['computed.mlsn'],
            description: 'Calculates MLSN-based nutrient recommendations'
        },

        'nutrient-demand-engine': {
            id: 'nutrient-demand-engine',
            label: 'Nutrient Demand Engine',
            category: 'nutrition',
            inputs: ['turf.species', 'turf.grassSpecies', 'turf.nProgram', 'tissue'],
            engines: ['climate-engine', 'tissue-engine'],
            outputs: ['computed.nutrientDemand'],
            description: 'Calculates N-linked nutrient demand based on growth potential'
        },

        'soil-tissue-integration': {
            id: 'soil-tissue-integration',
            label: 'Soil-Tissue Integration',
            category: 'nutrition',
            inputs: ['soil', 'tissue'],
            engines: ['tissue-engine', 'mlsn-calculator'],
            outputs: ['computed.soilTissueIntegration'],
            description: 'Cross-validates soil and tissue tests, identifies constraints'
        },

        'disease-engine': {
            id: 'disease-engine',
            label: 'Disease Engine',
            category: 'analysis',
            inputs: ['turf.species', 'turf.grassSpecies', 'turf.variety', 'turf.heightOfCut', 'site.region'],
            engines: ['climate-engine', 'dew-prediction-engine', 'shade-engine', 'tissue-engine', 'stress-aggregator'],
            outputs: ['computed.disease', 'computed.disease.overallRisk'],
            description: 'Predicts disease risk using Smith-Kerns, Fidanza models with stress modifiers'
        },

        'bipolaris-curvularia-engine': {
            id: 'bipolaris-curvularia-engine',
            label: 'Bipolaris/Curvularia Models',
            category: 'analysis',
            inputs: ['turf.species', 'turf.grassSpecies'],
            engines: ['climate-engine', 'dew-prediction-engine', 'tissue-engine'],
            outputs: ['computed.disease.leafSpot'],
            description: 'Specialized warm-season leaf spot disease models'
        },

        'wear-recovery-engine': {
            id: 'wear-recovery-engine',
            label: 'Wear & Recovery Engine',
            category: 'analysis',
            inputs: ['turf.species', 'turf.grassSpecies', 'turf.construction', 'turf.heightOfCut', 'schedule', 'soil.LOI'],
            engines: ['climate-engine', 'shade-engine', 'salinity-penalty-engine', 'stress-aggregator'],
            outputs: ['computed.wear', 'derived.adjustedRecoveryDays'],
            description: 'Models traffic impact and recovery with stress penalties'
        },

        'firmness-engine': {
            id: 'firmness-engine',
            label: 'Firmness Engine',
            category: 'analysis',
            inputs: [
                'soil.bulkDensity', 'soil.surfaceType',
                'water.ecw',
                'turf.warmBase', 'turf.coolOverseed', 'turf.nProgramKgHaYr',
                'turf.construction', 'turf.drainage', 'turf.grassSpecies',
                'turf.cleggHammer', 'turf.cleggMax', 'turf.cleggMin',
                'climate.forecast'
            ],
            engines: ['climate-engine'],
            outputs: [
                'computed.firmness.FI', 'computed.firmness.softnessRisk',
                'computed.firmness.surfaceHardness', 'computed.firmness.hardnessClass'
            ],
            description: 'Calculates surface firmness index based on soil, weather, and construction'
        },

        'nopt-engine': {
            id: 'nopt-engine',
            label: 'N-Opt Engine',
            category: 'analysis',
            inputs: [
                'turf.warmBase', 'turf.coolOverseed', 'turf.hoc',
                'turf.percentC3Cover', 'turf.nProgramKgHaYr',
                'climate.forecast'
            ],
            engines: ['climate-engine'],
            outputs: [
                'computed.nitrogen.opt', 'computed.nitrogen.applied',
                'computed.nitrogen.status', 'computed.nitrogen.growthData'
            ],
            description: 'Calculates optimal nitrogen rate based on species and growth potential'
        },

        'traffic-engine': {
            id: 'traffic-engine',
            label: 'Traffic Engine',
            category: 'analysis',
            inputs: [
                'schedule.matchesPerWeek', 'schedule.sessionsPerWeek',
                'schedule.restDays', 'schedule.matchCode', 'schedule.trainingCode',
                'turf.warmBase', 'turf.coolOverseed'
            ],
            engines: ['climate-engine', 'firmness-engine'],
            outputs: [
                'computed.traffic.TrafficRisk', 'computed.traffic.recoveryProb',
                'computed.traffic.recoveryWindow', 'computed.traffic.trafficLevel'
            ],
            description: 'Calculates traffic risk and recovery probability based on usage and firmness'
        },

        'turf-manager-engine': {
            id: 'turf-manager-engine',
            label: 'Turf Manager Engine',
            category: 'planning',
            inputs: [
                'schedule.matchesPerWeek', 'schedule.sessionsPerWeek',
                'schedule.restDays', 'schedule.matchCode', 'schedule.trainingCode'
            ],
            engines: ['firmness-engine', 'traffic-engine'],
            outputs: [
                'computed.turfManager.playability', 'computed.turfManager.playerRisk',
                'computed.turfManager.cutbackPercent', 'computed.turfManager.renovationTrigger'
            ],
            description: 'Provides scheduling guidance and playability assessment'
        },

        'irrigation-scheduler': {
            id: 'irrigation-scheduler',
            label: 'Irrigation Scheduler',
            category: 'planning',
            inputs: ['turf.species', 'turf.grassSpecies', 'soil.texture', 'water.EC'],
            engines: ['climate-engine', 'salinity-penalty-engine'],
            outputs: ['computed.irrigation'],
            description: 'FAO-56 ET-based irrigation scheduling with leaching fraction'
        },

        'pgr-module': {
            id: 'pgr-module',
            label: 'PGR Module',
            category: 'planning',
            inputs: ['turf.species', 'turf.grassSpecies', 'pgr.product', 'pgr.lastApplication', 'pgr.rate'],
            engines: ['climate-engine', 'stress-aggregator'],
            outputs: ['computed.pgr'],
            description: 'GDD-based PGR timing with species-specific base temperatures'
        },

        'water-blender': {
            id: 'water-blender',
            label: 'Water Blender',
            category: 'planning',
            inputs: ['water'],
            engines: [],
            outputs: ['computed.waterBlend'],
            description: 'Multi-source water blending with SAR/RSC/LSI calculations'
        },

        // ─────────────────────────────────────────────────────────────────────
        // TIER 5: FORECASTING & TRAJECTORY
        // ─────────────────────────────────────────────────────────────────────

        'stress-trajectory-engine': {
            id: 'stress-trajectory-engine',
            label: 'Stress Trajectory Engine',
            category: 'forecast',
            inputs: ['schedule'],
            engines: ['climate-engine', 'disease-engine', 'wear-recovery-engine', 'shade-engine', 'stress-aggregator'],
            outputs: ['computed.stressTrajectory'],
            description: '14-day predictive stress modeling with intervention windows'
        },

        'disease-forecast': {
            id: 'disease-forecast',
            label: 'Disease Forecast',
            category: 'forecast',
            inputs: [],
            engines: ['climate-engine', 'disease-engine'],
            outputs: ['computed.diseaseForecast'],
            description: 'Daily disease risk timeline'
        },

        'irrigation-forecast': {
            id: 'irrigation-forecast',
            label: 'Irrigation Forecast',
            category: 'forecast',
            inputs: [],
            engines: ['climate-engine', 'irrigation-scheduler'],
            outputs: ['computed.irrigationForecast'],
            description: 'Water balance timeline'
        },

        'pgr-forecast': {
            id: 'pgr-forecast',
            label: 'PGR Forecast',
            category: 'forecast',
            inputs: [],
            engines: ['climate-engine', 'pgr-module'],
            outputs: ['computed.pgrForecast'],
            description: 'GDD decay timeline for growth regulation'
        },

        'pre-emergent-engine': {
            id: 'pre-emergent-engine',
            label: 'Pre-Emergent Timing',
            category: 'advisory',
            // Requires soil temperature — either measured or modelled from climate engine
            inputs: [
                'climate.soilTemp5cm',
                'climate.airTempHistory',
                'schedule.preEmergentSpecies',
                'site.region',
                'inputs.moisture'
            ],
            engines: ['climate-engine'],
            outputs: [
                'computed.preEmergent',
                'computed.preEmergent.aggregateStatus',
                'computed.preEmergent.results',
                'window.GAIP_PRE_EMERGENT_RESULT'
            ],
            description: 'Species-level pre-emergent herbicide application timing based on soil temperature thresholds and trend trajectory. Covers AU/NZ/UK temperate and tropical weed suites. Confidence-rated: H = peer-reviewed, M = extension, L = indicative only.',
            notes: [
                'Runs at hub-orchestrator Step 8b, after climate engine guarantees soil temp is available',
                'Skipped silently when soilTemp5cm is null (no weather data entered)',
                'Tropical regions (southeast_asia, australia_tropical, australia_subtropical) use programme-interval logic',
                'L-rated species never trigger RED alerts, informational only',
                'Efficacy thresholds flagged indicative until field validation data available'
            ]
        }
    };

    // =========================================================================
    // INPUT-TO-ENGINE MAPPING
    // =========================================================================

    /**
     * Maps input paths to the engines that depend on them.
     * This answers: "If input X changes, which engines need recomputation?"
     */
    const INPUT_TO_ENGINES = {};

    /**
     * Build the input-to-engines reverse mapping
     */
    function buildInputMapping() {
        for (const [engineId, def] of Object.entries(ENGINE_DEFINITIONS)) {
            for (const inputPath of def.inputs) {
                // Handle both exact paths and prefix paths
                const basePath = inputPath.split('.')[0];

                if (!INPUT_TO_ENGINES[inputPath]) {
                    INPUT_TO_ENGINES[inputPath] = new Set();
                }
                INPUT_TO_ENGINES[inputPath].add(engineId);

                // Also map the base path for broader queries
                if (inputPath !== basePath) {
                    if (!INPUT_TO_ENGINES[basePath]) {
                        INPUT_TO_ENGINES[basePath] = new Set();
                    }
                    INPUT_TO_ENGINES[basePath].add(engineId);
                }
            }
        }

        // Convert Sets to Arrays for easier consumption
        for (const key of Object.keys(INPUT_TO_ENGINES)) {
            INPUT_TO_ENGINES[key] = Array.from(INPUT_TO_ENGINES[key]);
        }
    }

    // Build mapping on load
    buildInputMapping();

    // =========================================================================
    // GRAPH OPERATIONS
    // =========================================================================

    /**
     * Get direct dependencies of an engine (what it reads from)
     * @param {string} engineId
     * @returns {string[]} Array of engine IDs this engine depends on
     */
    function getDependencies(engineId) {
        const def = ENGINE_DEFINITIONS[engineId];
        if (!def) {
            console.warn(`[DependencyGraph] Unknown engine: ${engineId}`);
            return [];
        }
        return [...def.engines];
    }

    /**
     * Get all transitive dependencies (full dependency chain)
     * @param {string} engineId
     * @param {Set} visited - For cycle detection
     * @returns {string[]} Array of all engine IDs this engine transitively depends on
     */
    function getTransitiveDependencies(engineId, visited = new Set()) {
        if (visited.has(engineId)) {
            return []; // Cycle detected, stop
        }
        visited.add(engineId);

        const direct = getDependencies(engineId);
        const transitive = new Set(direct);

        for (const depId of direct) {
            const subDeps = getTransitiveDependencies(depId, visited);
            subDeps.forEach(d => transitive.add(d));
        }

        return Array.from(transitive);
    }

    /**
     * Get direct dependents of an engine (what reads from it)
     * @param {string} engineId
     * @returns {string[]} Array of engine IDs that depend on this engine
     */
    function getDependents(engineId) {
        const dependents = [];

        for (const [id, def] of Object.entries(ENGINE_DEFINITIONS)) {
            if (def.engines.includes(engineId)) {
                dependents.push(id);
            }
        }

        return dependents;
    }

    /**
     * Get all transitive dependents (everything downstream)
     * @param {string} engineId
     * @param {Set} visited - For cycle detection
     * @returns {string[]} Array of all engine IDs that transitively depend on this engine
     */
    function getTransitiveDependents(engineId, visited = new Set()) {
        if (visited.has(engineId)) {
            return []; // Cycle detected, stop
        }
        visited.add(engineId);

        const direct = getDependents(engineId);
        const transitive = new Set(direct);

        for (const depId of direct) {
            const subDeps = getTransitiveDependents(depId, visited);
            subDeps.forEach(d => transitive.add(d));
        }

        return Array.from(transitive);
    }

    /**
     * Get engines affected by a change to a specific input
     * @param {string} inputPath - e.g., 'water.ecw', 'turf.species', 'soil'
     * @returns {string[]} Array of engine IDs that need recomputation
     */
    function getEnginesForInput(inputPath) {
        // Try exact match first
        if (INPUT_TO_ENGINES[inputPath]) {
            return [...INPUT_TO_ENGINES[inputPath]];
        }

        // Try base path
        const basePath = inputPath.split('.')[0];
        if (INPUT_TO_ENGINES[basePath]) {
            return [...INPUT_TO_ENGINES[basePath]];
        }

        // Search for partial matches (e.g., 'water' matches 'water.ecw')
        const matches = new Set();
        for (const [path, engines] of Object.entries(INPUT_TO_ENGINES)) {
            if (path.startsWith(inputPath) || inputPath.startsWith(path.split('.')[0])) {
                engines.forEach(e => matches.add(e));
            }
        }

        return Array.from(matches);
    }

    /**
     * Get all engines that need recomputation when an input changes,
     * including transitive dependents
     * @param {string} inputPath
     * @returns {string[]} Array of engine IDs in correct execution order
     */
    function getAffectedEngines(inputPath) {
        const directlyAffected = getEnginesForInput(inputPath);
        const allAffected = new Set(directlyAffected);

        // Add all transitive dependents
        for (const engineId of directlyAffected) {
            const dependents = getTransitiveDependents(engineId);
            dependents.forEach(d => allAffected.add(d));
        }

        // Return in topological order
        return topologicalSort(Array.from(allAffected));
    }

    // =========================================================================
    // TOPOLOGICAL SORT
    // =========================================================================

    /**
     * Topological sort of engines based on dependencies
     * Ensures engines are executed in correct order (dependencies before dependents)
     * @param {string[]} engineIds - Engines to sort
     * @returns {string[]} Sorted engine IDs
     */
    function topologicalSort(engineIds) {
        const engineSet = new Set(engineIds);
        const sorted = [];
        const visited = new Set();
        const visiting = new Set(); // For cycle detection

        function visit(engineId) {
            if (visited.has(engineId)) return;
            if (visiting.has(engineId)) {
                console.warn(`[DependencyGraph] Cycle detected at: ${engineId}`);
                return;
            }

            visiting.add(engineId);

            // Visit dependencies first
            const deps = getDependencies(engineId);
            for (const dep of deps) {
                if (engineSet.has(dep)) {
                    visit(dep);
                }
            }

            visiting.delete(engineId);
            visited.add(engineId);
            sorted.push(engineId);
        }

        for (const engineId of engineIds) {
            visit(engineId);
        }

        return sorted;
    }

    /**
     * Get full execution order for all engines
     * @returns {string[]} All engine IDs in correct execution order
     */
    function getFullExecutionOrder() {
        return topologicalSort(Object.keys(ENGINE_DEFINITIONS));
    }

    // =========================================================================
    // SCENARIO COMPARISON HELPERS
    // =========================================================================

    /**
     * Compare two input states and determine which engines need recomputation
     * @param {object} stateA - First state (baseline)
     * @param {object} stateB - Second state (modified)
     * @returns {object} { changedInputs: [], affectedEngines: [], executionOrder: [] }
     */
    function diffInputs(stateA, stateB) {
        const changedInputs = [];
        const inputsA = stateA?.inputs || stateA || {};
        const inputsB = stateB?.inputs || stateB || {};

        // Check all input categories
        const categories = new Set([
            ...Object.keys(inputsA),
            ...Object.keys(inputsB)
        ]);

        for (const category of categories) {
            const valA = inputsA[category];
            const valB = inputsB[category];

            if (!deepEqual(valA, valB)) {
                changedInputs.push(category);

                // Also detect specific changed fields
                if (typeof valA === 'object' && typeof valB === 'object' && valA && valB) {
                    const fields = new Set([...Object.keys(valA || {}), ...Object.keys(valB || {})]);
                    for (const field of fields) {
                        if (!deepEqual(valA?.[field], valB?.[field])) {
                            changedInputs.push(`${category}.${field}`);
                        }
                    }
                }
            }
        }

        // Get all affected engines
        const affectedSet = new Set();
        for (const inputPath of changedInputs) {
            const affected = getAffectedEngines(inputPath);
            affected.forEach(e => affectedSet.add(e));
        }

        const affectedEngines = Array.from(affectedSet);
        const executionOrder = topologicalSort(affectedEngines);

        return {
            changedInputs,
            affectedEngines,
            executionOrder
        };
    }

    /**
     * Deep equality check for input comparison
     */
    function deepEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return false;
        if (typeof a !== typeof b) return false;

        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            if (keysA.length !== keysB.length) return false;

            for (const key of keysA) {
                if (!deepEqual(a[key], b[key])) return false;
            }

            return true;
        }

        return false;
    }

    // =========================================================================
    // VISUALIZATION HELPERS
    // =========================================================================

    /**
     * Generate a text representation of the dependency graph
     * @returns {string}
     */
    function visualizeGraph() {
        let output = 'GILBA HUB DEPENDENCY GRAPH\n';
        output += '==========================\n\n';

        const categories = {};
        for (const [id, def] of Object.entries(ENGINE_DEFINITIONS)) {
            if (!categories[def.category]) {
                categories[def.category] = [];
            }
            categories[def.category].push(def);
        }

        for (const [category, engines] of Object.entries(categories)) {
            output += `\n[${category.toUpperCase()}]\n`;
            output += '-'.repeat(40) + '\n';

            for (const engine of engines) {
                output += `\n  ${engine.label} (${engine.id})\n`;

                if (engine.engines.length > 0) {
                    output += `    Depends on: ${engine.engines.join(', ')}\n`;
                }

                const dependents = getDependents(engine.id);
                if (dependents.length > 0) {
                    output += `    Used by: ${dependents.join(', ')}\n`;
                }

                if (engine.inputs.length > 0) {
                    output += `    Inputs: ${engine.inputs.join(', ')}\n`;
                }
            }
        }

        return output;
    }

    /**
     * Generate DOT format for Graphviz visualization
     * @returns {string}
     */
    function toDotFormat() {
        let dot = 'digraph GilbaHub {\n';
        dot += '  rankdir=TB;\n';
        dot += '  node [shape=box, style=filled];\n\n';

        // Color by category
        const categoryColors = {
            foundation: 'var(--gaip-good-bg)',
            environmental: 'var(--gaip-info-bg)',
            integration: '#FFF3E0',
            nutrition: '#F3E5F5',
            analysis: 'var(--gaip-critical-bg)',
            planning: '#E0F7FA',
            forecast: '#FBE9E7'
        };

        // Add nodes
        for (const [id, def] of Object.entries(ENGINE_DEFINITIONS)) {
            const color = categoryColors[def.category] || 'var(--gaip-surface)';
            dot += `  "${id}" [label="${def.label}", fillcolor="${color}"];\n`;
        }

        dot += '\n';

        // Add edges
        for (const [id, def] of Object.entries(ENGINE_DEFINITIONS)) {
            for (const dep of def.engines) {
                dot += `  "${dep}" -> "${id}";\n`;
            }
        }

        dot += '}\n';
        return dot;
    }

    // =========================================================================
    // VALIDATION
    // =========================================================================

    /**
     * Validate the dependency graph has no cycles
     * @returns {object} { valid: boolean, cycles: [] }
     */
    function validateGraph() {
        const cycles = [];
        const visited = new Set();
        const recursionStack = new Set();

        function detectCycle(engineId, path = []) {
            if (recursionStack.has(engineId)) {
                const cycleStart = path.indexOf(engineId);
                cycles.push(path.slice(cycleStart).concat(engineId));
                return true;
            }

            if (visited.has(engineId)) return false;

            visited.add(engineId);
            recursionStack.add(engineId);
            path.push(engineId);

            const deps = getDependencies(engineId);
            for (const dep of deps) {
                detectCycle(dep, [...path]);
            }

            recursionStack.delete(engineId);
            return false;
        }

        for (const engineId of Object.keys(ENGINE_DEFINITIONS)) {
            detectCycle(engineId, []);
        }

        return {
            valid: cycles.length === 0,
            cycles
        };
    }

    /**
     * Check for undefined engine references
     * @returns {object} { valid: boolean, undefinedRefs: [] }
     */
    function checkReferences() {
        const undefinedRefs = [];

        for (const [id, def] of Object.entries(ENGINE_DEFINITIONS)) {
            for (const dep of def.engines) {
                if (!ENGINE_DEFINITIONS[dep]) {
                    undefinedRefs.push({ engine: id, references: dep });
                }
            }
        }

        return {
            valid: undefinedRefs.length === 0,
            undefinedRefs
        };
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaDependencyGraph = {
        version: GRAPH_VERSION,

        // Engine definitions
        ENGINE_DEFINITIONS,
        INPUT_TO_ENGINES,

        // Core query functions
        getDependencies,
        getTransitiveDependencies,
        getDependents,
        getTransitiveDependents,
        getEnginesForInput,
        getAffectedEngines,

        // Sorting
        topologicalSort,
        getFullExecutionOrder,

        // Scenario comparison
        diffInputs,

        // Visualization
        visualizeGraph,
        toDotFormat,

        // Validation
        validateGraph,
        checkReferences,

        // Get engine definition
        getEngine: (id) => ENGINE_DEFINITIONS[id] || null,
        getAllEngines: () => Object.keys(ENGINE_DEFINITIONS),
        getEnginesByCategory: (category) =>
            Object.values(ENGINE_DEFINITIONS).filter(e => e.category === category)
    };

    // Validate on load
    const validation = validateGraph();
    const refCheck = checkReferences();

    if (!validation.valid) {
        console.error('[DependencyGraph] CYCLES DETECTED:', validation.cycles);
    }
    if (!refCheck.valid) {
        console.error('[DependencyGraph] UNDEFINED REFERENCES:', refCheck.undefinedRefs);
    }

})(typeof window !== 'undefined' ? window : this);
