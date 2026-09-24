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

    /**
     * GH-678 (queue item 6, place 3 -- the gates; analyst 59.5 item 3, 59.6) --
     * THE DATA COMES FROM THE PAGE, AND ITS ABSENCE IS AN OUTCOME RATHER THAN AN
     * EMPTY GRAPH.
     *
     * This file used to CARRY the graph: twenty-six engines declared here by hand,
     * beside a second hand-written declaration in `cascade-orchestrator.js`, a third
     * in `hub-tissue-v3.js` and a fourth in `export-metadata.js`. The data now lives
     * in `assets/dependency-graph.json`, is read by `App\Support\DependencyGraph` and
     * is handed to the page as `window.GAIP_DEPENDENCY_GRAPH` (GH-676). The functions
     * stay here; the facts do not.
     *
     * WHY ABSENCE MUST REFUSE, and it is the whole point of this change. A graph built
     * from nothing answers every question with "nothing": `getAffectedEngines('soil.CEC')`
     * returns an empty list, and the page's coming warning would read "changing this
     * affects nothing" -- which is not a caveat, it is a false statement, and it looks
     * exactly like a correct answer. So when the page was not given the data this
     * module installs NO `GilbaDependencyGraph` at all. Every caller already tests for
     * it (`if (!global.GilbaDependencyGraph)`) and falls back to recomputing
     * EVERYTHING, which computes more rather than guessing less.
     *
     * WHAT IS NOT IN THIS SLICE, said rather than left to be noticed: the run does not
     * yet REFUSE on a missing graph the way it refuses on a missing result schema. That
     * refusal needs a new reason code, a reason code must carry a sentence a client
     * reads (`Gh638TheClassDecidesTheOffer` holds that a code without one must be an
     * `answer`), and the words are the owner's. The silent empty graph -- the defect --
     * is closed here regardless: it cannot exist any more.
     */
    const INJECTED = (typeof global.GAIP_DEPENDENCY_GRAPH === 'object' && global.GAIP_DEPENDENCY_GRAPH)
        ? global.GAIP_DEPENDENCY_GRAPH
        : null;
    const INJECTED_NODES = (INJECTED && INJECTED.nodes && typeof INJECTED.nodes === 'object')
        ? INJECTED.nodes
        : null;

    if (!INJECTED_NODES || !Object.keys(INJECTED_NODES).length) {
        // Not installed, and said out loud. A marker is left so a reader of the page
        // can tell "the page was never given the graph" from "this file never loaded".
        global.GAIP_DEPENDENCY_GRAPH_UNAVAILABLE = {
            reason: INJECTED ? 'the injected graph carried no nodes' : 'the page was not given a dependency graph',
            at: new Date().toISOString(),
        };
        console.error('[DependencyGraph] not installed: '
            + global.GAIP_DEPENDENCY_GRAPH_UNAVAILABLE.reason
            + '. Callers fall back to recomputing everything; nothing will answer'
            + ' "this input affects nothing".');

        return;
    }

    const GRAPH_VERSION = INJECTED.version ? String(INJECTED.version) : '1.0.0';

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
    /**
     * The injected nodes in this module's own shape. The graph data splits what a
     * module reads into `requires` and `uses` -- a judgement about what it does
     * without the input (GH-677) -- and this module asks only "does it read it", so
     * the two are joined here rather than flattened in the data.
     *
     * `after` is the node's upstream nodes; this module has always called that
     * `engines`. One name per fact, translated at the boundary.
     */
    const ENGINE_DEFINITIONS = {};
    Object.keys(INJECTED_NODES).forEach(function (id) {
        const node = INJECTED_NODES[id] || {};
        ENGINE_DEFINITIONS[id] = {
            id: id,
            label: node.label || id,
            inputs: [].concat(node.requires || [], node.uses || []),
            engines: [].concat(node.after || []),
            outputs: [].concat(node.outputs || []),
            category: node.category || 'uncategorised',
        };
    });

    /*
     * THE TWENTY-SIX HAND-WRITTEN DEFINITIONS THAT STOOD HERE ARE GONE, 335 lines of
     * them. They were not deleted and retyped somewhere else: `assets/dependency-graph.json`
     * was TRANSFORMED out of this block (GH-676) and then filled in from the test's own
     * output (GH-677), which is why removing them now loses nothing. Keeping them as a
     * dead copy would keep the very thing this work removes -- a second declaration of
     * the same facts, which drifts quietly because nothing reads it.
     */

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
