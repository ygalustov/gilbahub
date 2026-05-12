/**
 * GAIP What-If Scenario UI v2.6.3
 * 
 * User interface for A/B scenario comparison
 * Allows users to modify parameters and see impact on turf performance
 * 
 * v2.6.5: Fixed traffic preset path resolution (traffic.* → inputs.schedule.* alias),
 *          fixed adaptStateForEngine merging top-level traffic overrides from presets,
 *          fixed highBicarbWater preset to include Na/Ca/Mg/Cl for realistic SAR calc.
 * v2.6.4: Climate fallback chain in adaptStateForEngine — fixes "Missing climate
 *          configuration" after site switch when inputs.climate is null. Falls back
 *          through computed.climate → window.climateMetrics → location defaults.
 * v2.6.3: Export includes computed results
 *   - Fixed empty comparison table in Word export
 *   - Export payload now includes state.computed from scenario engine results
 *   - scenario-export.js can now extract disease, shade, stress metrics
 *
 * v2.6.2: Word Export Integration
 *   - Wired up GilbaScenarioExport.prepare() after comparison completes
 *   - Tracks activePreset/activePresetName for export labelling
 *   - Enables scenario comparison section in Word export
 *
 * v2.6.1: Fixed "Missing climate configuration" error
 *   - collectStateFromDOM() now includes climate object with defaults
 *   - Ensures DOM fallback path provides complete state for scenario engine
 *
 * v2.6.0: Confidence display in What-If UI
 *   - Added renderConfidenceSection() to display comparison confidence
 *   - Handles both 'confidence' and 'confidenceComparison' formats
 *   - Extracts confidence from individual scenario results
 *   - Shows warnings, blockers, and contributing factors
 *   - Compares baseline vs modified confidence levels
 * 
 * v2.5.0: Fixed v2.0+ scenario engine output normalization
 *   - Added normalizeEngineResult() to transform v2.0 format to UI expected format
 *   - Maps scenarios.baseline/modified → scenarioA/scenarioB
 *   - Maps summary.findings → improvements/concerns
 *   - Normalizes dot-notation deltas to nested objects
 *   - Preserves confidence data for future use
 * 
 * v2.4.0: Fixed scenario engine method detection
 *   - Now correctly finds compareScenarios/runScenario from GAIP_ScenarioEngine v2.1.0
 *   - Prioritizes compareScenarios over legacy compare method
 *   - Better error messaging showing available methods
 * 
 * v2.3.0: Fixed comparison and baseline loading
 *   - renderParameterControls now handles type: 'select' properly
 *   - PGR products updated to Australian brand names
 *   - Grass species dropdown working correctly
 * 
 * v2.1.0: Added species comparison presets (Kikuyu, Couch, Ryegrass, Zoysia, Buffalo)
 * 
 * @requires gaip-scenario-engine.js
 */

(function(global) {
    'use strict';

    /* ============================================================
       CONFIGURATION
    ============================================================ */

    const CONFIG = {
        containerClass: 'gaip-whatif-container',
        panelClass: 'gaip-whatif-panel',
        comparableFields: {
            // Water Quality
            'water.ecw': { label: 'Water EC (dS/m)', min: 0, max: 6, step: 0.1, unit: 'dS/m', category: 'water' },
            'water.pH': { label: 'Water pH', min: 5, max: 9, step: 0.1, unit: '', category: 'water' },
            'water.ions.Na': { label: 'Sodium (ppm)', min: 0, max: 500, step: 10, unit: 'ppm', category: 'water' },
            'water.ions.HCO3': { label: 'Bicarbonates (ppm)', min: 0, max: 600, step: 10, unit: 'ppm', category: 'water' },
            'water.ions.Cl': { label: 'Chloride (ppm)', min: 0, max: 500, step: 10, unit: 'ppm', category: 'water' },
            
            // LED Supplementation
            'turf.ledPPFD': { label: 'LED PPFD (µmol/m²/s)', min: 0, max: 1500, step: 50, unit: 'µmol/m²/s', category: 'light' },
            'turf.ledHours': { label: 'LED Hours/day', min: 0, max: 24, step: 1, unit: 'hrs', category: 'light' },
            
            // Traffic
            'traffic.matchesPerWeek': { label: 'Matches/week', min: 0, max: 14, step: 1, unit: '', category: 'traffic' },
            'traffic.sessionsPerWeek': { label: 'Training sessions/week', min: 0, max: 20, step: 1, unit: '', category: 'traffic' },
            'traffic.restDays': { label: 'Rest days', min: 0, max: 7, step: 1, unit: 'days', category: 'traffic' },
            
            // Shade/Light
            'shade.svf': { label: 'Sky View Factor', min: 0, max: 1, step: 0.05, unit: '', category: 'light' },
            'shade.treeOcclusion': { label: 'Tree Occlusion', min: 0, max: 100, step: 5, unit: '%', category: 'light' },
            'shade.facadeAngle': { label: 'Facade Angle', min: 0, max: 90, step: 5, unit: '°', category: 'light' },
            
            // Turf management
            'turf.grassSpecies': { 
                label: 'Grass Species', 
                type: 'select', 
                options: [
                    { value: '', label: ', No change,' },
                    { value: 'Perennial Ryegrass', label: 'Perennial Ryegrass' },
                    { value: 'Kikuyu', label: 'Kikuyu' },
                    { value: 'Couch', label: 'Couch (Bermuda)' },
                    { value: 'Zoysia', label: 'Zoysia' },
                    { value: 'Buffalo', label: 'Buffalo (St. Augustine)' },
                    { value: 'Kentucky Bluegrass', label: 'Kentucky Bluegrass' },
                    { value: 'Tall Fescue', label: 'Tall Fescue' },
                    { value: 'Bentgrass', label: 'Bentgrass' }
                ],
                category: 'turf' 
            },
            'turf.nProgramKgHaYr': { label: 'Annual N Rate', min: 0, max: 400, step: 10, unit: 'kg/ha/yr', category: 'nutrition' },
            'turf.hoc': { label: 'Height of Cut', min: 3, max: 75, step: 1, unit: 'mm', category: 'turf' },
            
            // PGR - Updated with Australian product names
            'pgr.product': { 
                label: 'PGR Product', 
                type: 'select', 
                options: [
                    { value: '', label: ', None,' },
                    { value: 'TE250', label: 'Primo 250EC (TE 250g/L)' },
                    { value: 'TE175', label: 'Indigo Amigo (TE 175g/L)' },
                    { value: 'TE120', label: 'Indigo Amigo (TE 120g/L)' },
                    { value: 'PBZ', label: 'Indigo Regulate (PBZ 200g/L)' },
                    { value: 'ETH', label: 'Indigo Incognito (Ethephon)' }
                ],
                category: 'pgr' 
            },
            'pgr.rate': { label: 'PGR Rate', min: 0, max: 5, step: 0.25, unit: 'L/ha', category: 'pgr' },
            
            // Soil conditions
            'soil.bulkDensity': { label: 'Bulk Density', min: 1.0, max: 2.0, step: 0.05, unit: 'g/cm³', category: 'soil' }
        }
    };

    /* ============================================================
       STATE MANAGEMENT
    ============================================================ */

    let currentState = {
        baselineState: null,
        modifiedState: null,
        weatherData: null,
        activeComparison: null,
        activePreset: null,       // Track which preset was applied (for export labelling)
        activePresetName: null    // Human-readable preset name
    };

    /**
     * Get nested object value by path
     */
    function getByPath(obj, path) {
        return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : null, obj);
    }

    /**
     * Set nested object value by path (immutable)
     */
    function setByPath(obj, path, value) {
        const result = JSON.parse(JSON.stringify(obj));
        const parts = path.split('.');
        let current = result;
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = value;
        return result;
    }

    /* ============================================================
       SCENARIO PRESETS
    ============================================================ */

    const PRESETS = {
        // Water Quality Scenarios
        poorWater: {
            name: '💧 Poor Water Quality',
            description: 'Simulate switching to saline/high sodium water',
            changes: {
                'water.ecw': 2.5,
                'water.ions.Na': 250,
                'water.ions.Cl': 300
            }
        },
        goodWater: {
            name: '💧 Good Water Quality',
            description: 'Simulate switching to better quality water',
            changes: {
                'water.ecw': 0.5,
                'water.ions.Na': 50,
                'water.ions.Cl': 80
            }
        },
        highBicarbWater: {
            name: '💧 High Bicarbonate Water',
            description: 'Test impact of high bicarb recycled water',
            changes: {
                'water.ecw': 1.2,
                'water.ions.HCO3': 400,
                'water.ions.Na': 120,
                'water.ions.Ca': 30,
                'water.ions.Mg': 15,
                'water.ions.Cl': 180,
                'water.pH': 8.2
            }
        },
        
        // LED Scenarios
        addLED: {
            name: '💡 Add LED Grow Lights',
            description: 'Simulate adding LED supplemental lighting',
            changes: {
                'turf.ledPPFD': 600,
                'turf.ledHours': 12
            }
        },
        maxLED: {
            name: '💡 Maximum LED Output',
            description: 'Full LED supplementation for severe shade',
            changes: {
                'turf.ledPPFD': 1000,
                'turf.ledHours': 16
            }
        },
        reduceLED: {
            name: '💡 Remove LED Lights',
            description: 'See impact of removing LED supplementation',
            changes: {
                'turf.ledPPFD': 0,
                'turf.ledHours': 0
            }
        },
        
        // Traffic Scenarios
        heavyTraffic: {
            name: '🏟️ Heavy Match Schedule',
            description: 'Increase match frequency',
            changes: {
                'traffic.matchesPerWeek': 3,
                'traffic.sessionsPerWeek': 6
            }
        },
        lightTraffic: {
            name: '🏟️ Reduced Schedule',
            description: 'Decrease match frequency',
            changes: {
                'traffic.matchesPerWeek': 1,
                'traffic.sessionsPerWeek': 2
            }
        },
        restPeriod: {
            name: '🏟️ Recovery Period',
            description: 'Simulate a rest period with minimal traffic',
            changes: {
                'traffic.matchesPerWeek': 0,
                'traffic.sessionsPerWeek': 1,
                'traffic.restDays': 6
            }
        },
        
        // Shade Scenarios
        // Note: SVF (Sky View Factor) = 1.0 is full sun, 0.5 is heavily shaded
        improveShade: {
            name: '🌳 Reduce Shade (Tree Pruning)',
            description: 'Simulate removing shade - sets SVF to 0.95 (near full sun)',
            changes: {
                'shade.svf': 0.95,          // Near full sun
                'shade.treeOcclusion': 0,   // No tree occlusion
                'shade.morningSky': 0.95,
                'shade.middaySky': 0.95,
                'shade.afternoonSky': 0.95,
                'turf.dli': null            // Force recalculation from shade inputs
            }
        },
        worseShade: {
            name: '🌳 Increased Shade',
            description: 'Test impact of new structures - 50% sky visible',
            changes: {
                'shade.svf': 0.5,
                'shade.morningSky': 0.4,
                'shade.middaySky': 0.6,
                'shade.afternoonSky': 0.5,
                'shade.facadeAngle': 60,
                'turf.dli': null
            }
        },
        
        // Nutrition Scenarios
        increaseN: {
            name: '🌱 Increase N Program (+50%)',
            description: 'Test higher nitrogen rates',
            changes: {
                'turf.nProgramKgHaYr': 250
            }
        },
        decreaseN: {
            name: '🌱 Reduce N Program (-30%)',
            description: 'Test lower nitrogen rates',
            changes: {
                'turf.nProgramKgHaYr': 120
            }
        },
        
        // PGR Scenarios - NEW
        addPGR: {
            name: '🌿 Add PGR Program',
            description: 'Start Primo 250EC program at standard rate',
            changes: {
                'pgr.product': 'TE250',
                'pgr.rate': 1.5
            }
        },
        removePGR: {
            name: '🌿 Remove PGR',
            description: 'See impact of stopping PGR applications',
            changes: {
                'pgr.product': '',
                'pgr.rate': 0
            }
        },
        
        // Combined Scenarios
        winterStress: {
            name: '❄️ Winter Stress Scenario',
            description: 'Simulate challenging winter conditions',
            changes: {
                'shade.svf': 0.6,
                'traffic.matchesPerWeek': 2,
                'turf.nProgramKgHaYr': 80
            }
        },
        summerPeak: {
            name: '☀️ Summer Peak Usage',
            description: 'Heavy summer schedule with good conditions',
            changes: {
                'traffic.matchesPerWeek': 4,
                'traffic.sessionsPerWeek': 8,
                'turf.nProgramKgHaYr': 200
            }
        },
        
        // Species Comparison Scenarios
        switchToKikuyu: {
            name: '🌿 Switch to Kikuyu',
            description: 'Compare performance with Kikuyu grass',
            changes: {
                'turf.grassSpecies': 'Kikuyu'
            }
        },
        switchToCouch: {
            name: '🌿 Switch to Couch',
            description: 'Compare performance with Couch/Bermuda',
            changes: {
                'turf.grassSpecies': 'Couch'
            }
        },
        switchToRyegrass: {
            name: '🌿 Switch to Ryegrass',
            description: 'Compare performance with Perennial Ryegrass',
            changes: {
                'turf.grassSpecies': 'Perennial Ryegrass'
            }
        },
        switchToZoysia: {
            name: '🌿 Switch to Zoysia',
            description: 'Compare performance with Zoysia grass',
            changes: {
                'turf.grassSpecies': 'Zoysia'
            }
        },
        switchToBuffalo: {
            name: '🌿 Switch to Buffalo',
            description: 'Compare performance with Buffalo/St. Augustine',
            changes: {
                'turf.grassSpecies': 'Buffalo'
            }
        }
    };

    /* ============================================================
       STATE COLLECTION
    ============================================================ */

    /**
     * Load baseline state from the current Hub analysis
     */
    function loadBaseline() {
        // Try GAIP_STATE first (set by hub-tissue during analysis)
        // Note: hub-orchestrator.js may overwrite GAIP_STATE with its own format
        // ({inputs, computed, derived}). If so, adaptStateForEngine() handles it.
        if (global.GAIP_STATE && Object.keys(global.GAIP_STATE).length > 0) {
            currentState.baselineState = JSON.parse(JSON.stringify(global.GAIP_STATE));
            currentState.modifiedState = JSON.parse(JSON.stringify(global.GAIP_STATE));
            
            const format = currentState.baselineState.inputs ? 'orchestrator' : 'tissue-v3';
            console.log('[WhatIfUI] Baseline loaded from GAIP_STATE (' + format + ' format)');
            
            renderBaselineSummary(currentState.baselineState);
            return true;
        }
        
        // Try Hub orchestrator
        if (global.GilbaHubOrchestrator && typeof global.GilbaHubOrchestrator.getState === 'function') {
            const state = global.GilbaHubOrchestrator.getState();
            if (state && Object.keys(state).length > 0) {
                currentState.baselineState = JSON.parse(JSON.stringify(state));
                currentState.modifiedState = JSON.parse(JSON.stringify(state));
                renderBaselineSummary(currentState.baselineState);
                return true;
            }
        }
        
        // Fallback: build from DOM
        currentState.baselineState = collectStateFromDOM();
        currentState.modifiedState = JSON.parse(JSON.stringify(currentState.baselineState));
        renderBaselineSummary(currentState.baselineState);
        return true;
    }
    
    /**
     * Reset modified state back to baseline (clears all preset changes)
     */
    function resetToBaseline() {
        if (!currentState.baselineState) {
            loadBaseline();
            return;
        }
        
        // Reset modified state to baseline
        currentState.modifiedState = JSON.parse(JSON.stringify(currentState.baselineState));
        currentState.activePreset = null;
        currentState.activePresetName = null;
        currentState.activeComparison = null;

        // Clear decision panel scenario divergence (b35fix219)
        if (window.GilbaDSMUI && window.GilbaDSMUI.setScenarioKey) {
            window.GilbaDSMUI.setScenarioKey(null);
        }

        // Clear results display
        const resultsContainer = document.getElementById('gaip-whatif-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p style="color: var(--gaip-text); font-style: italic;">Scenario reset to baseline. Select a preset or modify parameters to compare.</p>';
        }
        
    }
    
    /**
     * Render a summary of the baseline state
     */
    function renderBaselineSummary(state) {
        const container = document.getElementById('gaip-baseline-summary');
        if (!container) return;
        
        let html = '<div class="gaip-baseline-details" style="font-size: 12px; color: var(--gaip-text);">';
        
        if (state.turf?.grassSpecies) {
            html += `<div>🌱 Species: ${state.turf.grassSpecies}</div>`;
        }
        if (state.water?.ecw !== undefined) {
            html += `<div>💧 Water EC: ${state.water.ecw} dS/m</div>`;
        }
        if (state.climate?.temperature !== undefined) {
            html += `<div>🌡️ Temp: ${state.climate.temperature}°C</div>`;
        }
        if (state.shade?.svf !== undefined) {
            html += `<div>☀️ SVF: ${(state.shade.svf * 100).toFixed(0)}%</div>`;
        }
        if (state.traffic?.matchesPerWeek !== undefined) {
            html += `<div>🏟️ Matches: ${state.traffic.matchesPerWeek}/week</div>`;
        }
        
        if (html === '<div class="gaip-baseline-details" style="font-size: 12px; color: var(--gaip-text);">') {
            html += '<div style="font-style: italic;">Run analysis to populate baseline values</div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Collect current state from DOM elements
     */
    function collectStateFromDOM() {
        const state = {
            water: {},
            soil: {},
            turf: {},
            traffic: {},
            shade: {},
            pgr: {},
            climate: {
                lat: -33.87,
                lon: 151.21,
                useLiveWeather: false,
                manual: {
                    temperature: { min: 15, max: 25, mean: 20 },
                    moisture: { humidity: 65, rainfall: 0 },
                    wind: { speed: 2 }
                }
            }
        };
        
        // Water inputs
        const waterEC = document.querySelector('[name="water-ec"], .gaip-water-ec, #water-ec');
        if (waterEC) state.water.ecw = parseFloat(waterEC.value) || 0;
        
        const waterPH = document.querySelector('[name="water-ph"], .gaip-water-ph, #water-ph');
        if (waterPH) state.water.pH = parseFloat(waterPH.value) || 7;
        
        // Turf inputs
        const species = document.querySelector('[name="grass-species"], .gaip-grass-species, #grass-species, select[class*="grass"]');
        if (species) state.turf.grassSpecies = species.value;
        
        const hoc = document.querySelector('[name="hoc"], .gaip-hoc, #hoc, input[class*="hoc"]');
        if (hoc) state.turf.hoc = parseFloat(hoc.value) || 25;
        
        // Traffic inputs
        const matches = document.querySelector('[name="matches"], .gaip-matches, #matches');
        if (matches) state.traffic.matchesPerWeek = parseInt(matches.value) || 0;
        
        const sessions = document.querySelector('[name="sessions"], .gaip-sessions, #sessions');
        if (sessions) state.traffic.sessionsPerWeek = parseInt(sessions.value) || 0;
        
        // Shade inputs
        const svf = document.querySelector('[name="svf"], .gaip-svf, #svf');
        if (svf) state.shade.svf = parseFloat(svf.value) || 1;
        
        return state;
    }

    /**
     * Update a single parameter in the modified state
     */
    function updateParameter(path, value) {
        if (!currentState.modifiedState) {
            loadBaseline();
        }
        
        // Parse numeric values
        const config = CONFIG.comparableFields[path];
        if (config && config.type !== 'select') {
            value = parseFloat(value);
            if (isNaN(value)) return;
        }
        
        currentState.modifiedState = setByPath(currentState.modifiedState, path, value);
    }

    /**
     * Map a simple preset path to the correct state path(s).
     *
     * Presets use friendly paths like 'water.Na'. The actual state might be:
     *   tissue-v3 format:       water.ions.Na
     *   orchestrator format:    inputs.water.ions.Na
     *
     * This function returns an array of resolved paths to set.
     */
    function resolvePresetPath(state, simplePath) {
        const paths = [];
        
        // Water ions: 'water.X' → needs 'water.ions.X' and/or 'inputs.water.ions.X'
        const waterIonMatch = simplePath.match(/^water\.(Ca|Mg|Na|K|Cl|HCO3|CO3|SO4|B|Fe|NO3|PO4)$/);
        if (waterIonMatch) {
            const ion = waterIonMatch[1];
            // Tissue-v3 format
            if (state.water?.ions !== undefined) {
                paths.push(`water.ions.${ion}`);
            }
            // Orchestrator format
            if (state.inputs?.water?.ions !== undefined) {
                paths.push(`inputs.water.ions.${ion}`);
            }
            // If neither structure exists yet, create both common forms
            if (paths.length === 0) {
                paths.push(`water.ions.${ion}`);
                if (state.inputs) paths.push(`inputs.water.ions.${ion}`);
            }
            return paths;
        }
        
        // Water top-level props: 'water.ecw', 'water.pH'
        const waterTopMatch = simplePath.match(/^water\.(ecw|pH|EC|SAR|adjSAR)$/);
        if (waterTopMatch) {
            const prop = waterTopMatch[1];
            if (state.water !== undefined) paths.push(`water.${prop}`);
            if (state.inputs?.water !== undefined) paths.push(`inputs.water.${prop}`);
            if (paths.length === 0) paths.push(simplePath);
            return paths;
        }
        
        // Soil ppm: 'soil.X' → 'soil.ppm.X' and/or 'inputs.soil.ppm.X'
        const soilNutrientMatch = simplePath.match(/^soil\.(K|P|Ca|Mg|S|Fe|Mn|Zn|Cu|Na)$/);
        if (soilNutrientMatch) {
            const nutrient = soilNutrientMatch[1];
            if (state.soil?.ppm !== undefined) paths.push(`soil.ppm.${nutrient}`);
            if (state.inputs?.soil?.ppm !== undefined) paths.push(`inputs.soil.ppm.${nutrient}`);
            if (paths.length === 0) paths.push(`soil.ppm.${nutrient}`);
            return paths;
        }
        
        // Soil top-level: 'soil.pH', 'soil.EC', etc.
        const soilTopMatch = simplePath.match(/^soil\.(pH_water|pH_cacl2|CEC|EC1_5|ECe|soilTexture|methodology)$/);
        if (soilTopMatch) {
            const prop = soilTopMatch[1];
            if (state.soil !== undefined) paths.push(`soil.${prop}`);
            if (state.inputs?.soil !== undefined) paths.push(`inputs.soil.${prop}`);
            if (paths.length === 0) paths.push(simplePath);
            return paths;
        }
        
        // v2.6.4: Traffic/schedule alias — presets use 'traffic.*' but orchestrator
        // stores traffic data in inputs.schedule. Write to both.
        const trafficMatch = simplePath.match(/^traffic\.(.+)$/);
        if (trafficMatch) {
            const prop = trafficMatch[1];
            // Always write to direct traffic path (for adaptStateForEngine fallback)
            paths.push(`traffic.${prop}`);
            // Also write to inputs.schedule if orchestrator format
            if (state.inputs?.schedule !== undefined) {
                paths.push(`inputs.schedule.${prop}`);
            }
            // Also write to inputs.traffic if it exists
            if (state.inputs?.traffic !== undefined) {
                paths.push(`inputs.traffic.${prop}`);
            }
            return paths;
        }
        
        // Generic: try both direct and inputs-prefixed
        if (state.inputs) {
            const topKey = simplePath.split('.')[0];
            if (state.inputs[topKey] !== undefined) {
                paths.push(`inputs.${simplePath}`);
            }
        }
        // Always include the direct path as well
        paths.push(simplePath);
        
        return paths;
    }

    /**
     * Apply a preset to the modified state
     */
    function applyPreset(presetKey) {
        const preset = PRESETS[presetKey];
        if (!preset) {
            console.error(`[WhatIfUI] Unknown preset: ${presetKey}`);
            return;
        }
        
        if (!currentState.modifiedState) {
            loadBaseline();
        }
        
        // Apply all changes from preset, resolving paths for current state format
        for (const [simplePath, value] of Object.entries(preset.changes)) {
            const resolvedPaths = resolvePresetPath(currentState.modifiedState, simplePath);
            
            for (const path of resolvedPaths) {
                currentState.modifiedState = setByPath(currentState.modifiedState, path, value);
            }
            
            console.log(`[WhatIfUI] Preset '${presetKey}': ${simplePath} → ${resolvedPaths.join(', ')} = ${value}`);
            
            // Update input field if it exists
            const inputId = `gaip-param-${simplePath.replace(/\./g, '-')}`;
            const input = document.getElementById(inputId);
            if (input) {
                input.value = value;
            }
        }
        
        
        // Track active preset for export labelling
        currentState.activePreset = presetKey;
        currentState.activePresetName = preset.name;

        // Wire decision panel scenario divergence (b35fix219)
        if (window.GilbaDSMUI && window.GilbaDSMUI.setScenarioKey) {
            window.GilbaDSMUI.setScenarioKey(presetKey);
        }

        // Auto-run comparison
        runComparison();
    }

    /* ============================================================
       COMPARISON ENGINE
    ============================================================ */

    /**
     * Run scenario comparison
     */
    /**
     * Adapt hub-orchestrator state format to scenario engine format.
     *
     * Hub-orchestrator stores state as:
     *   { inputs: { turf, climate, water, soil, ... }, computed: { ... }, derived: { ... } }
     *
     * Scenario engine expects:
     *   { turf, climate, water, soil, traffic, shade, pgr, tissue, siteHistory, ... }
     *
     * If the state already has top-level turf/climate (old format), return as-is.
     */
    function adaptStateForEngine(hubState) {
        if (!hubState) return hubState;
        
        // If state already has top-level turf and climate, it's already in engine format
        if (hubState.turf && hubState.climate && !hubState.inputs) {
            return hubState;
        }
        
        // If state has inputs.turf, flatten the inputs layer to top-level
        if (hubState.inputs && (hubState.inputs.turf || hubState.inputs.climate)) {
            const adapted = {};
            
            // Copy all input sub-objects to top level
            const inputKeys = ['climate', 'turf', 'soil', 'water', 'tissue', 'schedule', 'site'];
            for (const key of inputKeys) {
                if (hubState.inputs[key]) {
                    adapted[key] = JSON.parse(JSON.stringify(hubState.inputs[key]));
                }
            }
            
            // v2.6.3: Climate fallback chain — after a site switch the orchestrator
            // may have computed.climate but inputs.climate can be null because
            // hub-tissue hasn't re-run yet. Fall back through available sources.
            if (!adapted.climate) {
                // Try computed.climate (orchestrator result)
                if (hubState.computed && hubState.computed.climate) {
                    var cc = hubState.computed.climate;
                    // computed.climate may be wrapped in confidence envelope
                    adapted.climate = JSON.parse(JSON.stringify(cc.value || cc));
                    console.log('[WhatIfUI] Climate fallback: using computed.climate');
                }
                // Try window.climateMetrics (always set by hub-tissue after analysis)
                else if (global.climateMetrics) {
                    adapted.climate = {
                        manual: {
                            temperature: {
                                mean: global.climateMetrics.temperature?.current || 20,
                                min: global.climateMetrics.temperature?.min || 15,
                                max: global.climateMetrics.temperature?.max || 25
                            },
                            humidity: {
                                mean: global.climateMetrics.humidity?.current || 65
                            }
                        },
                        lat: global.climateMetrics.location?.lat || hubState.inputs?.site?.lat,
                        lon: global.climateMetrics.location?.lon || hubState.inputs?.site?.lon
                    };
                    console.log('[WhatIfUI] Climate fallback: using window.climateMetrics');
                }
                // Last resort: construct minimal climate from turf profile location
                else if (hubState.inputs?.turf?.lat || hubState.inputs?.site?.lat) {
                    var lat = hubState.inputs?.turf?.lat || hubState.inputs?.site?.lat || -34;
                    var lon = hubState.inputs?.turf?.lon || hubState.inputs?.site?.lon || 150;
                    adapted.climate = {
                        manual: {
                            temperature: { mean: 20, min: 15, max: 25 },
                            humidity: { mean: 65 }
                        },
                        lat: lat,
                        lon: lon
                    };
                    console.log('[WhatIfUI] Climate fallback: using location defaults');
                }
            }
            
            // Map schedule to traffic if present
            if (hubState.inputs.schedule && !adapted.traffic) {
                adapted.traffic = JSON.parse(JSON.stringify(hubState.inputs.schedule));
            }
            
            // v2.6.4: Merge top-level traffic overrides from presets.
            // Presets write to hubState.traffic (top-level) but adaptStateForEngine
            // may have already populated adapted.traffic from inputs.schedule above.
            // Merge rather than replace so preset changes win.
            if (hubState.traffic && typeof hubState.traffic === 'object') {
                if (!adapted.traffic) adapted.traffic = {};
                Object.assign(adapted.traffic, hubState.traffic);
            }
            
            // Map site to shade/siteHistory if present
            if (hubState.inputs.site) {
                if (!adapted.shade) {
                    adapted.shade = {
                        svf: hubState.inputs.site.svf || 1,
                        facadeAngle: hubState.inputs.site.facadeAngle || 0,
                        treeOcclusion: hubState.inputs.site.treeOcclusion || 0
                    };
                }
                if (!adapted.siteHistory) {
                    adapted.siteHistory = {
                        yearsEstablished: hubState.inputs.site.yearsEstablished || null,
                        thatchMm: hubState.inputs.site.thatchMm || null,
                        previousDiseaseHistory: hubState.inputs.site.previousDiseaseHistory || []
                    };
                }
            }
            
            // Pull location into climate if not already there
            if (hubState.inputs.location && adapted.climate) {
                adapted.climate.lat = adapted.climate.lat || hubState.inputs.location.lat;
                adapted.climate.lon = adapted.climate.lon || hubState.inputs.location.lon;
            }
            
            // Also carry across any top-level keys that might exist
            // (hub-tissue sometimes sets turfType, species, etc. directly)
            for (const key of Object.keys(hubState)) {
                if (key !== 'inputs' && key !== 'computed' && key !== 'derived' && 
                    key !== 'dataSources' && key !== 'lastComputed' && key !== 'computeSequence' &&
                    adapted[key] === undefined) {
                    adapted[key] = hubState[key];
                }
            }
            
            return adapted;
        }
        
        // Fallback: return as-is and hope for the best
        return hubState;
    }

    function runComparison() {
        if (!currentState.baselineState || !currentState.modifiedState) {
            console.error('[WhatIfUI] Cannot compare - missing state');
            const container = document.getElementById('gaip-whatif-results');
            if (container) {
                container.innerHTML = '<div class="gaip-results-error"><strong>❌ Cannot Compare</strong><p>Please run analysis first to establish baseline state.</p></div>';
            }
            return;
        }
        
        // Adapt hub-orchestrator state format (inputs.turf, inputs.climate, ...)
        // to scenario engine format (turf, climate, ...) at top level
        const baselineForEngine = adaptStateForEngine(currentState.baselineState);
        const modifiedForEngine = adaptStateForEngine(currentState.modifiedState);
        
        // v2.6.4 diagnostic: log what the engine actually receives
        console.log('[WhatIfUI] === DIAGNOSTIC: State passed to scenario engine ===');
        console.log('[WhatIfUI] Baseline water:', JSON.stringify(baselineForEngine.water || null));
        console.log('[WhatIfUI] Modified water:', JSON.stringify(modifiedForEngine.water || null));
        console.log('[WhatIfUI] Baseline traffic:', JSON.stringify(baselineForEngine.traffic || null));
        console.log('[WhatIfUI] Modified traffic:', JSON.stringify(modifiedForEngine.traffic || null));
        console.log('[WhatIfUI] Baseline climate?', !!baselineForEngine.climate);
        console.log('[WhatIfUI] Modified climate?', !!modifiedForEngine.climate);
        
        
        // Find scenario engine - check multiple possible global names
        const scenarioEngine = global.GAIP_ScenarioEngine ||
                               global.GilbaScenarioEngine ||
                               global.ScenarioEngine ||
                               (global.GAIP && global.GAIP.ScenarioEngine);
        
        if (scenarioEngine) {
            try {
                let result;
                
                // Try different method names the engine might use
                // v2.4.0: Updated to match GAIP_ScenarioEngine v2.1.0 exports
                if (typeof scenarioEngine.compareScenarios === 'function') {
                    // Primary: GAIP_ScenarioEngine.compareScenarios
                    result = scenarioEngine.compareScenarios(
                        baselineForEngine,
                        modifiedForEngine
                    );
                } else if (typeof scenarioEngine.compare === 'function') {
                    // Fallback: older API
                    result = scenarioEngine.compare(
                        baselineForEngine,
                        modifiedForEngine
                    );
                } else if (typeof scenarioEngine.runComparison === 'function') {
                    result = scenarioEngine.runComparison(
                        baselineForEngine,
                        modifiedForEngine
                    );
                } else if (typeof scenarioEngine.runScenario === 'function') {
                    // Run both scenarios separately and build comparison
                    // GAIP_ScenarioEngine.runScenario is the v2.1.0 method
                    const resultA = scenarioEngine.runScenario(baselineForEngine);
                    const resultB = scenarioEngine.runScenario(modifiedForEngine);
                    result = buildComparisonFromResults(resultA, resultB);
                } else if (typeof scenarioEngine.run === 'function') {
                    // Legacy fallback
                    const resultA = scenarioEngine.run(baselineForEngine);
                    const resultB = scenarioEngine.run(modifiedForEngine);
                    result = buildComparisonFromResults(resultA, resultB);
                } else {
                    console.warn('[WhatIfUI] Scenario engine found but no compare/run method. Available:', Object.keys(scenarioEngine));
                    renderBasicComparison();
                    return;
                }
                
                
                // Normalize v2.0+ engine output to expected UI format
                const normalized = normalizeEngineResult(result);
                
                // v2.6.4 diagnostic: log raw engine output
                if (result) {
                    console.log('[WhatIfUI] === DIAGNOSTIC: Engine raw result ===');
                    if (result.deltas) console.log('[WhatIfUI] Deltas:', JSON.stringify(result.deltas));
                    if (result.comparison) console.log('[WhatIfUI] Comparison:', JSON.stringify(result.comparison));
                    if (result.scenarioA?.results?.water) console.log('[WhatIfUI] ScenA water:', JSON.stringify(result.scenarioA.results.water));
                    if (result.scenarioB?.results?.water) console.log('[WhatIfUI] ScenB water:', JSON.stringify(result.scenarioB.results.water));
                    if (result.scenarioA?.results?.traffic) console.log('[WhatIfUI] ScenA traffic:', JSON.stringify(result.scenarioA.results.traffic));
                    if (result.scenarioB?.results?.traffic) console.log('[WhatIfUI] ScenB traffic:', JSON.stringify(result.scenarioB.results.traffic));
                }
                
                if (normalized) {
                    currentState.activeComparison = normalized;
                    renderComparisonResults(normalized);
                    
                    // === EXPORT INTEGRATION ===
                    // Prepare scenario data for Word export
                    if (global.GilbaScenarioExport && typeof global.GilbaScenarioExport.prepare === 'function') {
                        try {
                            // Build state objects with computed results for export
                            // scenario-export needs state.computed.* structure
                            const baselineWithResults = {
                                inputs: currentState.baselineState,
                                computed: normalized.scenarioA?.results || normalized.scenarioA || {}
                            };
                            const scenarioWithResults = {
                                inputs: currentState.modifiedState,
                                computed: normalized.scenarioB?.results || normalized.scenarioB || {}
                            };
                            
                            const exportPayload = {
                                success: true,
                                presetType: currentState.activePreset || 'custom',
                                baseline: {
                                    state: baselineWithResults,
                                    label: 'Current',
                                    metadata: normalized.scenarioA?._metadata || normalized.scenarioA?.confidence || {}
                                },
                                scenario: {
                                    state: scenarioWithResults,
                                    label: currentState.activePresetName || 'Scenario',
                                    metadata: normalized.scenarioB?._metadata || normalized.scenarioB?.confidence || {},
                                    modifications: currentState.activePreset 
                                        ? PRESETS[currentState.activePreset]?.changes || {}
                                        : {}
                                },
                                metadata: {
                                    source: 'whatif-ui',
                                    version: '2.6.2'
                                }
                            };
                            global.GilbaScenarioExport.prepare(exportPayload);
                        } catch (exportErr) {
                            console.warn('[WhatIfUI] Could not prepare export data:', exportErr);
                        }
                    }
                } else {
                    console.warn('[WhatIfUI] Could not normalize scenario engine result:', result);
                    renderBasicComparison();
                }
            } catch (err) {
                console.error('[WhatIfUI] Scenario engine error:', err);
                renderBasicComparison();
            }
        } else {
            renderBasicComparison();
        }
    }
    
    /**
     * Normalize scenario engine v2.0+ output to expected UI format
     * Handles both old (scenarioA/scenarioB) and new (scenarios.baseline/modified) formats
     */
    function normalizeEngineResult(result) {
        if (!result) return null;
        
        // Already in expected format? (gaip-scenario-engine output)
        if (result.scenarioA && result.scenarioB && result.comparison) {
            // Extract confidence - handle both 'confidence' and 'confidenceComparison'
            let confidence = result.confidence || null;
            if (!confidence && result.confidenceComparison) {
                // Transform gaip-scenario-engine confidenceComparison to standard format
                confidence = {
                    comparable: true,
                    level: result.confidenceComparison.preferHigherConfidence === 'A' 
                        ? (result.confidenceComparison.scenarioA?.level || 'medium')
                        : (result.confidenceComparison.scenarioB?.level || 'medium'),
                    baseline: result.confidenceComparison.scenarioA,
                    modified: result.confidenceComparison.scenarioB,
                    note: result.confidenceComparison.note,
                    warnings: [],
                    blockers: []
                };
                // Add warning if confidence levels differ significantly
                if (result.confidenceComparison.scenarioA?.level !== result.confidenceComparison.scenarioB?.level) {
                    confidence.warnings.push(result.confidenceComparison.note);
                }
            }
            return {
                ...result,
                confidence
            };
        }
        
        // v2.0+ format with scenarios.baseline/modified
        if (result.scenarios && (result.scenarios.baseline || result.scenarios.modified)) {
            const baseline = result.scenarios.baseline || {};
            const modified = result.scenarios.modified || {};
            
            // Build improvements/concerns from summary.findings or deltas
            const improvements = [];
            const concerns = [];
            
            // Parse from summary if available
            if (result.summary && result.summary.findings) {
                result.summary.findings.forEach(f => {
                    if (f.impact === 'positive' || f.direction === 'improved') {
                        improvements.push(f.text || f.message || f.description || String(f));
                    } else if (f.impact === 'negative' || f.direction === 'degraded') {
                        concerns.push(f.text || f.message || f.description || String(f));
                    }
                });
            }
            
            // Parse from changes if available
            if (result.changes) {
                (result.changes.improvements || []).forEach(c => {
                    improvements.push(c.description || c.metric || String(c));
                });
                (result.changes.degradations || []).forEach(c => {
                    concerns.push(c.description || c.metric || String(c));
                });
            }
            
            // Build recommendation from summary
            let recommendation = 'Review scenario comparison for impact assessment.';
            if (result.summary) {
                if (result.summary.recommendAction) {
                    recommendation = result.summary.recommendAction;
                } else if (result.summary.verdictText) {
                    recommendation = result.summary.verdictText;
                } else if (result.summary.verdict) {
                    const verdictMap = {
                        'positive': 'Scenario shows net improvement in turf conditions.',
                        'negative': 'Scenario shows potential challenges that may require management.',
                        'neutral': 'No significant impact detected from this change.',
                        'mixed': 'Mixed results - review individual factors.'
                    };
                    recommendation = verdictMap[result.summary.verdict] || recommendation;
                }
            }
            
            // Normalize deltas to expected structure
            const deltas = normalizeDeltas(result.deltas || {});
            
            return {
                scenarioA: { results: baseline },
                scenarioB: { results: modified },
                deltas,
                comparison: {
                    improvements,
                    concerns,
                    recommendation
                },
                // Preserve confidence data for potential future use
                confidence: result.confidence || null,
                rawResult: result  // Keep original for debugging
            };
        }
        
        // Has deltas but missing other expected fields - partial format
        if (result.deltas) {
            return {
                scenarioA: { results: result.baseline || {} },
                scenarioB: { results: result.modified || {} },
                deltas: normalizeDeltas(result.deltas),
                comparison: {
                    improvements: [],
                    concerns: [],
                    recommendation: 'Partial comparison data available.'
                }
            };
        }
        
        return null;
    }
    
    /**
     * Normalize deltas from v2.0 format to UI expected format
     * v2.0 uses dot-notation keys like 'water.ecw', UI expects nested objects
     */
    function normalizeDeltas(deltas) {
        if (!deltas) return {};
        
        // If already nested, return as-is
        if (deltas.water || deltas.shade || deltas.disease) {
            return deltas;
        }
        
        // Convert dot-notation to nested structure
        const normalized = {
            water: {},
            shade: {},
            disease: {},
            traffic: {},
            irrigation: {},
            pgr: {},
            nOpt: {},
            stressTrajectory: {}
        };
        
        for (const [key, value] of Object.entries(deltas)) {
            // Handle dot-notation keys like 'water.ecw' or 'disease.overall'
            const parts = key.split('.');
            if (parts.length === 2 && normalized[parts[0]]) {
                // Map common v2.0 keys to expected UI keys
                const keyMap = {
                    'overall': 'overallScore',
                    'DLI_total': 'dliTotal',
                    'total_dli': 'dliTotal'
                };
                const mappedKey = keyMap[parts[1]] || parts[1];
                normalized[parts[0]][mappedKey] = value?.delta ?? value?.change ?? value ?? 0;
            } else if (parts.length === 1 && typeof value === 'object') {
                // Already a category object
                normalized[parts[0]] = { ...normalized[parts[0]], ...value };
            }
        }
        
        return normalized;
    }

    /**
     * Build comparison object from two separate scenario results
     */
    function buildComparisonFromResults(resultA, resultB) {
        if (!resultA || !resultB) return null;
        
        // Calculate deltas between the two results
        const deltas = {
            water: {},
            shade: {},
            disease: {},
            traffic: {},
            irrigation: {},
            pgr: {}
        };
        
        // Water deltas
        if (resultA.water && resultB.water) {
            deltas.water.ecw = (resultB.water.ecw || 0) - (resultA.water.ecw || 0);
            deltas.water.sar = (resultB.water.sar || 0) - (resultA.water.sar || 0);
            deltas.water.riskScore = (resultB.water.riskScore || 0) - (resultA.water.riskScore || 0);
        }
        
        // Shade deltas
        if (resultA.shade && resultB.shade) {
            deltas.shade.dliTotal = (resultB.shade.DLI_total || 0) - (resultA.shade.DLI_total || 0);
            deltas.shade.deficit = (resultB.shade.deficit || 0) - (resultA.shade.deficit || 0);
        }
        
        // Disease deltas
        if (resultA.disease && resultB.disease) {
            deltas.disease.overallScore = (resultB.disease.overallScore || 0) - (resultA.disease.overallScore || 0);
        }
        
        // Traffic deltas
        if (resultA.traffic && resultB.traffic) {
            deltas.traffic.recoveryCapacity = (resultB.traffic.recoveryCapacity || 0) - (resultA.traffic.recoveryCapacity || 0);
            deltas.traffic.wearRecoveryRatio = (resultB.traffic.wearRecoveryRatio || 0) - (resultA.traffic.wearRecoveryRatio || 0);
        }
        
        // Build recommendation
        const improvements = [];
        const concerns = [];
        
        if (deltas.water.riskScore < 0) improvements.push('Water quality risk reduced');
        if (deltas.water.riskScore > 0) concerns.push('Water quality risk increased');
        if (deltas.shade.dliTotal > 0) improvements.push('Light availability improved');
        if (deltas.shade.dliTotal < 0) concerns.push('Light availability reduced');
        if (deltas.disease.overallScore < 0) improvements.push('Disease risk reduced');
        if (deltas.disease.overallScore > 0) concerns.push('Disease risk increased');
        if (deltas.traffic.recoveryCapacity > 0) improvements.push('Recovery capacity improved');
        if (deltas.traffic.recoveryCapacity < 0) concerns.push('Recovery capacity reduced');
        
        let recommendation = 'Scenario comparison shows ';
        if (improvements.length > concerns.length) {
            recommendation += 'net improvement in turf conditions.';
        } else if (concerns.length > improvements.length) {
            recommendation += 'potential challenges that may require management.';
        } else {
            recommendation += 'mixed results - review individual factors.';
        }
        
        // Extract confidence from scenario results if available
        let confidence = null;
        const confA = resultA._confidence || resultA.confidence;
        const confB = resultB._confidence || resultB.confidence;
        if (confA || confB) {
            confidence = {
                comparable: true,
                baseline: confA,
                modified: confB,
                warnings: [],
                blockers: []
            };
            // Determine overall level (use lowest)
            const levelOrder = { 'high': 3, 'medium': 2, 'low': 1, 'indicative': 0 };
            const levelA = levelOrder[confA?.level] ?? 2;
            const levelB = levelOrder[confB?.level] ?? 2;
            const lowestLevel = levelA <= levelB ? confA?.level : confB?.level;
            confidence.level = lowestLevel || 'medium';
            confidence.score = Math.min(confA?.score || 70, confB?.score || 70);
        }
        
        return {
            scenarioA: { results: resultA },
            scenarioB: { results: resultB },
            deltas,
            comparison: {
                improvements,
                concerns,
                recommendation
            },
            confidence
        };
    }

    /**
     * Render comparison results
     */
    function renderComparisonResults(result) {
        const container = document.getElementById('gaip-whatif-results');
        if (!container) return;
        
        container.innerHTML = renderResults(result);
    }

    /**
     * Render basic comparison without scenario engine
     * Shows parameter changes and basic impact assessment
     */
    function renderBasicComparison() {
        const container = document.getElementById('gaip-whatif-results');
        if (!container) return;
        
        const baseline = currentState.baselineState;
        const modified = currentState.modifiedState;
        
        let html = '<div class="gaip-results-basic" style="padding: 16px;">';
        html += '<h4 style="margin: 0 0 12px 0; color: #1e3a5f;">📊 Scenario Comparison</h4>';
        
        // Collect all changes
        const changes = [];
        
        for (const [path, config] of Object.entries(CONFIG.comparableFields)) {
            const baseVal = getByPath(baseline, path);
            const modVal = getByPath(modified, path);
            
            if (modVal !== null && modVal !== '' && modVal !== undefined && baseVal !== modVal) {
                changes.push({
                    label: config.label,
                    baseline: baseVal,
                    modified: modVal,
                    unit: config.unit || '',
                    category: config.category
                });
            }
        }
        
        if (changes.length === 0) {
            html += '<p style="color: var(--gaip-text); font-style: italic;">No parameter changes detected. Modify values or select a preset to compare scenarios.</p>';
        } else {
            // Group by category
            const categories = {};
            changes.forEach(c => {
                if (!categories[c.category]) categories[c.category] = [];
                categories[c.category].push(c);
            });
            
            const categoryLabels = {
                water: '💧 Water Quality',
                light: '☀️ Light & Shade',
                traffic: '🏟️ Traffic',
                turf: '🌱 Turf',
                pgr: '🧪 PGR',
                nutrition: '🥬 Nutrition',
                soil: '🪨 Soil'
            };
            
            html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
            html += '<thead><tr style="background: var(--gaip-surface-hover);"><th style="padding: 8px; text-align: left;">Parameter</th><th style="padding: 8px; text-align: center;">Current</th><th style="padding: 8px; text-align: center;">Modified</th><th style="padding: 8px; text-align: center;">Change</th></tr></thead>';
            html += '<tbody>';
            
            for (const [cat, catChanges] of Object.entries(categories)) {
                html += `<tr><td colspan="4" style="padding: 8px 8px 4px 8px; font-weight: 600; color: var(--gaip-text); background: var(--gaip-surface-muted);">${categoryLabels[cat] || cat}</td></tr>`;
                
                catChanges.forEach(c => {
                    const baseDisplay = c.baseline ?? '-';
                    const modDisplay = c.modified;
                    let changeDisplay = '';
                    let changeColor = 'var(--gaip-text-secondary)';
                    
                    if (typeof c.baseline === 'number' && typeof c.modified === 'number') {
                        const diff = c.modified - c.baseline;
                        const sign = diff > 0 ? '+' : '';
                        changeDisplay = `${sign}${diff.toFixed(1)}`;
                        changeColor = diff > 0 ? '#dc2626' : diff < 0 ? '#16a34a' : 'var(--gaip-text-secondary)';
                        
                        // Reverse color logic for beneficial increases
                        if (c.label.includes('LED') || c.label.includes('Rest') || c.label.includes('Recovery')) {
                            changeColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : 'var(--gaip-text-secondary)';
                        }
                    }
                    
                    html += `<tr style="border-bottom: 1px solid var(--gaip-border);">
                        <td style="padding: 6px 8px;">${c.label}</td>
                        <td style="padding: 6px 8px; text-align: center; color: var(--gaip-text);">${baseDisplay} ${c.unit}</td>
                        <td style="padding: 6px 8px; text-align: center; font-weight: 600;">${modDisplay} ${c.unit}</td>
                        <td style="padding: 6px 8px; text-align: center; color: ${changeColor}; font-weight: 500;">${changeDisplay} ${c.unit}</td>
                    </tr>`;
                });
            }
            
            html += '</tbody></table>';
            
            // Add impact summary
            html += '<div style="margin-top: 16px; padding: 12px; background: var(--gaip-info-bg); border-radius: 8px; border-left: 4px solid #0ea5e9;">';
            html += '<strong style="color: #0369a1;">💡 Impact Assessment</strong>';
            html += '<p style="margin: 8px 0 0 0; font-size: 12px; color: var(--gaip-text);">';
            
            // Generate simple impact statements
            const impacts = [];
            if (categories.water) {
                const ecChange = changes.find(c => c.label.includes('EC'));
                if (ecChange && ecChange.modified < ecChange.baseline) {
                    impacts.push('Reduced water EC will lower salinity stress');
                } else if (ecChange && ecChange.modified > ecChange.baseline) {
                    impacts.push('Increased water EC may increase salinity stress');
                }
            }
            if (categories.light) {
                const ledChange = changes.find(c => c.label.includes('LED'));
                if (ledChange && ledChange.modified > 0) {
                    impacts.push('LED supplementation will increase DLI and support turf health');
                }
            }
            if (categories.traffic) {
                const matchChange = changes.find(c => c.label.includes('Matches'));
                if (matchChange && matchChange.modified < matchChange.baseline) {
                    impacts.push('Reduced traffic will improve recovery capacity');
                } else if (matchChange && matchChange.modified > matchChange.baseline) {
                    impacts.push('Increased traffic will require enhanced recovery management');
                }
            }
            if (categories.pgr) {
                const pgrChange = changes.find(c => c.label.includes('PGR Product'));
                if (pgrChange && !pgrChange.modified) {
                    impacts.push('Removing PGR will increase mowing frequency but reduce chemical inputs');
                }
            }
            
            if (impacts.length > 0) {
                html += impacts.join('. ') + '.';
            } else {
                html += 'Review individual parameter changes to assess overall impact on turf performance.';
            }
            
            html += '</p></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    /* ============================================================
       UI RENDERING
    ============================================================ */

    function renderPanel() {
        return `
            <div class="${CONFIG.panelClass}">
                <style>${getStyles()}</style>
                <h3 class="gaip-whatif-title">🔄 What-If Scenario Analysis</h3>
                <p class="gaip-whatif-subtitle">Compare how changes affect turf performance</p>
                
                <div class="gaip-whatif-sections">
                    <div class="gaip-whatif-section gaip-baseline-section">
                        <h4>📍 Current Baseline</h4>
                        <p class="gaip-section-note">Based on your current analysis inputs</p>
                        <div id="gaip-baseline-summary"></div>
                    </div>
                    
                    <div class="gaip-whatif-arrow">→</div>
                    
                    <div class="gaip-whatif-section gaip-scenario-section">
                        <h4>🎯 Scenario B</h4>
                        <p class="gaip-section-note">Modify parameters below or use presets</p>
                        
                        ${renderPresets()}
                        ${renderParameterControls()}
                        
                        <button class="gaip-run-comparison-btn" onclick="GAIP_WhatIfUI.runComparison()">
                            ▶️ Compare Scenarios
                        </button>
                    </div>
                </div>
                
                <div id="gaip-whatif-results" class="gaip-whatif-results">
                    <p class="gaip-results-placeholder">Select a preset or modify parameters, then click "Compare Scenarios"</p>
                </div>
            </div>
        `;
    }

    function renderPresets() {
        let html = '<div class="gaip-presets">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
        html += '<strong>Quick Presets:</strong>';
        html += '<button class="gaip-reset-btn" onclick="GAIP_WhatIfUI.resetToBaseline()" title="Clear all changes and reset to baseline">🔄 Reset</button>';
        html += '</div>';
        html += '<div class="gaip-preset-grid">';
        
        for (const [key, preset] of Object.entries(PRESETS)) {
            html += `
                <button class="gaip-preset-btn" onclick="GAIP_WhatIfUI.applyPreset('${key}')" title="${preset.description}">
                    ${preset.name}
                </button>
            `;
        }
        
        html += '</div></div>';
        return html;
    }

    /**
     * Render parameter controls - FIXED to handle select fields properly
     */
    function renderParameterControls() {
        let html = '<div class="gaip-param-controls">';
        html += '<strong>Custom Modifications:</strong>';
        html += '<div class="gaip-param-grid">';
        
        for (const [path, config] of Object.entries(CONFIG.comparableFields)) {
            const inputId = `gaip-param-${path.replace(/\./g, '-')}`;
            
            html += `<div class="gaip-param-item">`;
            html += `<label for="${inputId}">${config.label}</label>`;
            html += `<div class="gaip-param-input-group">`;
            
            // Check if this is a select field
            if (config.type === 'select') {
                html += `<select id="${inputId}" data-path="${path}" 
                         onchange="GAIP_WhatIfUI.updateParameter('${path}', this.value)"
                         class="gaip-param-select">`;
                
                // Handle both array of objects and array of strings
                for (const option of config.options) {
                    if (typeof option === 'object') {
                        html += `<option value="${option.value}">${option.label}</option>`;
                    } else {
                        // Legacy format: array of strings
                        const displayVal = option || ', No change,';
                        html += `<option value="${option}">${displayVal}</option>`;
                    }
                }
                
                html += '</select>';
            } else {
                // Numeric input
                html += `<input type="number" 
                               id="${inputId}"
                               data-path="${path}"
                               min="${config.min}" 
                               max="${config.max}" 
                               step="${config.step}"
                               placeholder=","
                               onchange="GAIP_WhatIfUI.updateParameter('${path}', this.value)">`;
                
                if (config.unit) {
                    html += `<span class="gaip-param-unit">${config.unit}</span>`;
                }
            }
            
            html += '</div></div>';
        }
        
        html += '</div></div>';
        return html;
    }

    /* ============================================================
       RESULTS RENDERING
    ============================================================ */

    /**
     * Render confidence assessment section
     * Shows comparison reliability and any caveats
     */
    function renderConfidenceSection(confidence) {
        if (!confidence) {
            return '';  // No confidence data available
        }
        
        // Handle different confidence data structures
        let level = 'medium';
        let score = 70;
        let warnings = [];
        let blockers = [];
        let factors = [];
        let baselineConf = null;
        let modifiedConf = null;
        
        // Extract from various possible formats
        if (confidence.level) {
            level = confidence.level;
        }
        if (confidence.score !== undefined) {
            score = confidence.score;
        }
        if (confidence.warnings) {
            warnings = confidence.warnings;
        }
        if (confidence.blockers) {
            blockers = confidence.blockers;
        }
        if (confidence.factors) {
            factors = confidence.factors;
        }
        if (confidence.baseline) {
            baselineConf = confidence.baseline;
        }
        if (confidence.modified) {
            modifiedConf = confidence.modified;
        }
        
        // Determine display color and icon
        const confColors = {
            'high': { bg: 'rgba(5, 150, 105, 0.15)', border: '#059669', icon: '✓', label: 'High Confidence' },
            'medium': { bg: 'rgba(217, 119, 6, 0.15)', border: '#d97706', icon: '◐', label: 'Medium Confidence' },
            'low': { bg: 'rgba(220, 38, 38, 0.15)', border: '#dc2626', icon: '⚠', label: 'Low Confidence' },
            'indicative': { bg: 'rgba(107, 114, 128, 0.15)', border: 'var(--gaip-text-secondary)', icon: '○', label: 'Indicative Only' },
            'insufficient': { bg: 'rgba(107, 114, 128, 0.15)', border: 'var(--gaip-text-secondary)', icon: '?', label: 'Insufficient Data' }
        };
        
        const conf = confColors[level] || confColors['medium'];
        
        let html = `
            <div class="gaip-confidence-section" style="
                background: ${conf.bg};
                border: 1px solid ${conf.border};
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 12px;
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 16px;">${conf.icon}</span>
                    <strong style="color: ${conf.border};">${conf.label}</strong>
                    ${score !== undefined ? `<span style="color: var(--gaip-text); font-size: 12px;">(${Math.round(score)}%)</span>` : ''}
                </div>
        `;
        
        // Show scenario-specific confidence if available
        if (baselineConf || modifiedConf) {
            html += `<div style="display: flex; gap: 16px; font-size: 12px; color: var(--gaip-text); margin-bottom: 8px;">`;
            if (baselineConf) {
                const bLevel = baselineConf.level || 'medium';
                const bScore = baselineConf.score !== undefined ? Math.round(baselineConf.score) : '-';
                html += `<span>Baseline: ${bLevel} (${bScore}%)</span>`;
            }
            if (modifiedConf) {
                const mLevel = modifiedConf.level || 'medium';
                const mScore = modifiedConf.score !== undefined ? Math.round(modifiedConf.score) : '-';
                html += `<span>Modified: ${mLevel} (${mScore}%)</span>`;
            }
            html += `</div>`;
        }
        
        // Show warnings
        if (warnings.length > 0) {
            html += `<div style="font-size: 12px; color: #d97706; margin-top: 4px;">`;
            warnings.forEach(w => {
                const warnText = typeof w === 'string' ? w : (w.message || w.reason || String(w));
                html += `<div>⚠ ${warnText}</div>`;
            });
            html += `</div>`;
        }
        
        // Show blockers (more serious)
        if (blockers.length > 0) {
            html += `<div style="font-size: 12px; color: #dc2626; margin-top: 4px;">`;
            blockers.forEach(b => {
                const blockText = typeof b === 'string' ? b : (b.message || b.reason || String(b));
                html += `<div>⛔ ${blockText}</div>`;
            });
            html += `</div>`;
        }
        
        // Show contributing factors (collapsible)
        if (factors.length > 0) {
            html += `
                <details style="margin-top: 8px; font-size: 11px;">
                    <summary style="cursor: pointer; color: var(--gaip-text);">Show confidence factors</summary>
                    <div style="margin-top: 6px; padding-left: 12px;">
            `;
            factors.forEach(f => {
                const factorText = typeof f === 'string' ? f : (f.factor || f.name || String(f));
                const impact = f.impact !== undefined ? (f.impact > 0 ? `+${f.impact}` : f.impact) : '';
                const impactColor = f.impact > 0 ? '#059669' : f.impact < 0 ? '#dc2626' : 'var(--gaip-text-secondary)';
                html += `<div style="display: flex; justify-content: space-between;">
                    <span>${factorText}</span>
                    ${impact ? `<span style="color: ${impactColor};">${impact}</span>` : ''}
                </div>`;
            });
            html += `</div></details>`;
        }
        
        html += `</div>`;
        return html;
    }

    function renderResults(comparison) {
        // Check if we have valid comparison data
        if (!comparison || comparison.error || !comparison.scenarioA || !comparison.scenarioB) {
            return `
                <div class="gaip-results-error">
                    <strong>❌ Comparison Failed</strong>
                    <p>${comparison?.error || 'Unable to run comparison - check console for details'}</p>
                </div>
            `;
        }

        const { scenarioA, scenarioB, deltas, comparison: comp, confidence } = comparison;
        const rA = scenarioA.results || {};
        const rB = scenarioB.results || {};
        
        // Build confidence display HTML
        const confidenceHtml = renderConfidenceSection(confidence);
        
        return `
            <div class="gaip-results-grid">
                <!-- Confidence Assessment -->
                ${confidenceHtml}
                
                <!-- Summary Cards -->
                <div class="gaip-results-summary">
                    <div class="gaip-recommendation ${comp.concerns.length === 0 ? 'positive' : comp.improvements.length === 0 ? 'negative' : 'neutral'}">
                        <strong>📋 Recommendation:</strong> ${comp.recommendation}
                    </div>
                </div>
                
                <!-- Delta Table -->
                <div class="gaip-delta-table">
                    <h4>📊 Key Metric Changes</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Scenario A</th>
                                <th>Scenario B</th>
                                <th>Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Water Quality -->
                            <tr class="gaip-section-header-row"><td colspan="4">💧 Water Quality</td></tr>
                            ${renderDeltaRow('Water EC', 
                                rA.water?.ecw?.toFixed(1) || '0',
                                rB.water?.ecw?.toFixed(1) || '0',
                                deltas.water?.ecw?.toFixed(1) || '0', ' dS/m', false)}
                            ${renderDeltaRow('SAR', 
                                rA.water?.sar?.toFixed(1) || '0',
                                rB.water?.sar?.toFixed(1) || '0',
                                (deltas.water?.sar || 0).toFixed(1), '', false)}
                            ${renderDeltaRow('Salinity Penalty', 
                                Math.round(rA.water?.salinityPenalty?.recoveryPenalty || 0),
                                Math.round(rB.water?.salinityPenalty?.recoveryPenalty || 0),
                                Math.round(deltas.water?.salinityPenalty || 0), '%', false)}
                            ${renderDeltaRow('Water Risk Score', 
                                Math.round(rA.water?.riskScore || 0),
                                Math.round(rB.water?.riskScore || 0),
                                Math.round(deltas.water?.riskScore || 0), '', false)}
                            
                            <!-- Light/Shade -->
                            <tr class="gaip-section-header-row"><td colspan="4">☀️ Light & Shade</td></tr>
                            ${renderDeltaRow('Total DLI', 
                                rA.shade?.DLI_total?.toFixed(1) || '-',
                                rB.shade?.DLI_total?.toFixed(1) || '-',
                                (deltas.shade?.dliTotal || 0).toFixed(1), ' mol/m²', true)}
                            ${renderDeltaRow('Light Status', 
                                rA.shade?.status || '-',
                                rB.shade?.status || '-',
                                '', '', true)}
                            ${renderDeltaRow('DLI Deficit', 
                                rA.shade?.deficit?.toFixed(1) || '0',
                                rB.shade?.deficit?.toFixed(1) || '0',
                                (deltas.shade?.deficit || 0).toFixed(1), ' mol/m²', false)}
                            
                            <!-- Disease -->
                            <tr class="gaip-section-header-row"><td colspan="4">🦠 Disease Risk</td></tr>
                            ${renderDeltaRow('Overall Score', 
                                rA.disease?.overallScore || 0,
                                rB.disease?.overallScore || 0,
                                deltas.disease?.overallScore || 0, '', false)}
                            ${renderDeltaRow('Risk Level', 
                                rA.disease?.overallRisk || '-',
                                rB.disease?.overallRisk || '-',
                                '', '', true)}
                            ${renderDeltaRow('Primary Risk', 
                                rA.disease?.primaryRisk || 'None',
                                rB.disease?.primaryRisk || 'None',
                                '', '', true)}
                            
                            <!-- Traffic/Wear -->
                            <tr class="gaip-section-header-row"><td colspan="4">🏟️ Traffic & Recovery</td></tr>
                            ${renderDeltaRow('Total Load', 
                                rA.traffic?.totalLoad?.toFixed(1) || '0',
                                rB.traffic?.totalLoad?.toFixed(1) || '0',
                                ((rB.traffic?.totalLoad || 0) - (rA.traffic?.totalLoad || 0)).toFixed(1), '', false)}
                            ${renderDeltaRow('Recovery Capacity', 
                                Math.round(rA.traffic?.recoveryCapacity || 0),
                                Math.round(rB.traffic?.recoveryCapacity || 0),
                                Math.round(deltas.traffic?.recoveryCapacity || 0), '%', true)}
                            ${renderDeltaRow('Wear/Recovery Ratio', 
                                rA.traffic?.wearRecoveryRatio?.toFixed(2) || '0',
                                rB.traffic?.wearRecoveryRatio?.toFixed(2) || '0',
                                (deltas.traffic?.wearRecoveryRatio || 0).toFixed(2), '', false)}
                            ${renderDeltaRow('Traffic Status', 
                                rA.traffic?.status || '-',
                                rB.traffic?.status || '-',
                                '', '', true)}
                            
                            <!-- Irrigation -->
                            <tr class="gaip-section-header-row"><td colspan="4">💦 Irrigation</td></tr>
                            ${renderDeltaRow('Weekly Need', 
                                Math.round(rA.irrigation?.weeklyNeed || 0),
                                Math.round(rB.irrigation?.weeklyNeed || 0),
                                Math.round(deltas.irrigation?.weeklyNeed || 0), ' mm', false)}
                            ${renderDeltaRow('Leaching Req.', 
                                rA.irrigation?.leachingRequirement || 0,
                                rB.irrigation?.leachingRequirement || 0,
                                deltas.irrigation?.leachingRequirement || 0, '%', false)}
                            
                            <!-- PGR -->
                            ${rA.pgr?.active || rB.pgr?.active ? `
                            <tr class="gaip-section-header-row"><td colspan="4">🌱 PGR</td></tr>
                            ${renderDeltaRow('Effect Remaining', 
                                rA.pgr?.effectRemaining || 0,
                                rB.pgr?.effectRemaining || 0,
                                deltas.pgr?.effectRemaining || 0, '%', true)}
                            ${renderDeltaRow('Days to Reapply', 
                                rA.pgr?.daysToReapply ?? '-',
                                rB.pgr?.daysToReapply ?? '-',
                                deltas.pgr?.daysToReapply || 0, ' days', true)}
                            ` : ''}
                            
                            <!-- N Optimization -->
                            <tr class="gaip-section-header-row"><td colspan="4">🧪 Nitrogen</td></tr>
                            ${renderDeltaRow('Recommended N', 
                                rA.nOpt?.recommendedAnnual || 0,
                                rB.nOpt?.recommendedAnnual || 0,
                                deltas.nOpt?.recommended || 0, ' kg/ha/yr', true)}
                            ${renderDeltaRow('N Status', 
                                rA.nOpt?.status || '-',
                                rB.nOpt?.status || '-',
                                '', '', true)}
                            
                            <!-- Stress Trajectory -->
                            <tr class="gaip-section-header-row"><td colspan="4">📈 14-Day Outlook</td></tr>
                            ${renderDeltaRow('Peak Stress', 
                                rA.stressTrajectory?.peakScore || 0,
                                rB.stressTrajectory?.peakScore || 0,
                                deltas.stressTrajectory?.peakScore || 0, '', false)}
                            ${renderDeltaRow('Critical Days', 
                                rA.stressTrajectory?.criticalDays || 0,
                                rB.stressTrajectory?.criticalDays || 0,
                                deltas.stressTrajectory?.criticalDays || 0, ' days', false)}
                            ${renderDeltaRow('Trend', 
                                rA.stressTrajectory?.trend || '-',
                                rB.stressTrajectory?.trend || '-',
                                '', '', true)}
                        </tbody>
                    </table>
                </div>
                
                <!-- Improvements & Concerns -->
                ${comp.improvements.length > 0 || comp.concerns.length > 0 ? `
                <div class="gaip-changes-lists">
                    ${comp.improvements.length > 0 ? `
                    <div class="gaip-improvements">
                        <h4>✅ Improvements</h4>
                        <ul>
                            ${comp.improvements.map(i => `<li>${i}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${comp.concerns.length > 0 ? `
                    <div class="gaip-concerns">
                        <h4>⚠️ Concerns</h4>
                        <ul>
                            ${comp.concerns.map(c => `<li>${c}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `;
    }

    function renderDeltaRow(label, valA, valB, delta, unit, higherIsBetter) {
        let deltaClass = 'neutral';
        const numDelta = parseFloat(delta) || 0;
        
        if (numDelta !== 0) {
            if (higherIsBetter) {
                deltaClass = numDelta > 0 ? 'positive' : 'negative';
            } else {
                deltaClass = numDelta < 0 ? 'positive' : 'negative';
            }
        }
        
        const deltaDisplay = numDelta === 0 ? '-' : 
                            (numDelta > 0 ? '+' : '') + delta + unit;
        
        return `
            <tr>
                <td>${label}</td>
                <td>${valA}${unit}</td>
                <td>${valB}${unit}</td>
                <td class="gaip-delta ${deltaClass}">${deltaDisplay}</td>
            </tr>
        `;
    }

    /* ============================================================
       STYLES
    ============================================================ */

    function getStyles() {
        return `
            .gaip-whatif-panel {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, var(--gaip-text) 0%, #0f172a 100%);
                color: var(--gaip-surface-hover);
                border-radius: 12px;
                padding: 24px;
            }
            
            .gaip-whatif-title {
                font-size: 20px;
                margin: 0 0 4px 0;
                color: var(--gaip-surface-hover);
            }
            
            .gaip-whatif-subtitle {
                color: var(--gaip-text);
                margin: 0 0 20px 0;
                font-size: 14px;
            }
            
            .gaip-whatif-sections {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .gaip-whatif-section {
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 16px;
            }
            
            .gaip-whatif-section h4 {
                margin: 0 0 8px 0;
                font-size: 15px;
                color: var(--gaip-border);
            }
            
            .gaip-section-note {
                font-size: 12px;
                color: var(--gaip-text);
                margin: 0 0 12px 0;
            }
            
            .gaip-whatif-arrow {
                display: flex;
                align-items: center;
                font-size: 24px;
                color: #6366f1;
            }
            
            .gaip-presets {
                margin-bottom: 16px;
            }
            
            .gaip-presets strong {
                display: block;
                font-size: 12px;
                color: var(--gaip-text);
                margin-bottom: 8px;
            }
            
            .gaip-preset-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            
            .gaip-preset-btn {
                background: rgba(99, 102, 241, 0.2);
                border: 1px solid rgba(99, 102, 241, 0.3);
                color: #a5b4fc;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .gaip-preset-btn:hover {
                background: rgba(99, 102, 241, 0.4);
                border-color: rgba(99, 102, 241, 0.6);
            }
            
            .gaip-reset-btn {
                background: rgba(239, 68, 68, 0.2);
                border: 1px solid rgba(239, 68, 68, 0.3);
                color: #fca5a5;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .gaip-reset-btn:hover {
                background: rgba(239, 68, 68, 0.4);
                border-color: rgba(239, 68, 68, 0.6);
            }
            
            .gaip-param-controls strong {
                display: block;
                font-size: 12px;
                color: var(--gaip-text);
                margin-bottom: 8px;
            }
            
            .gaip-param-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            
            .gaip-param-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .gaip-param-item label {
                font-size: 11px;
                color: var(--gaip-text);
            }
            
            .gaip-param-input-group {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            
            .gaip-param-input-group input,
            .gaip-param-input-group select {
                flex: 1;
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.1);
                color: var(--gaip-surface-hover);
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .gaip-param-input-group select {
                cursor: pointer;
            }
            
            .gaip-param-input-group select option {
                background: var(--gaip-text);
                color: var(--gaip-surface-hover);
            }
            
            .gaip-param-unit {
                font-size: 10px;
                color: var(--gaip-text);
                min-width: 40px;
            }
            
            .gaip-run-comparison-btn {
                width: 100%;
                margin-top: 16px;
                background: linear-gradient(135deg, #6366f1, #4f46e5);
                border: none;
                color: var(--gaip-surface);
                padding: 12px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .gaip-run-comparison-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }
            
            .gaip-whatif-results {
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                padding: 16px;
            }
            
            .gaip-results-placeholder {
                text-align: center;
                color: var(--gaip-text);
                font-style: italic;
            }
            
            .gaip-results-error {
                background: rgba(220, 38, 38, 0.1);
                border: 1px solid rgba(220, 38, 38, 0.3);
                border-radius: 8px;
                padding: 16px;
                text-align: center;
            }
            
            .gaip-results-error strong {
                color: #fca5a5;
            }
            
            .gaip-results-summary {
                margin-bottom: 16px;
            }
            
            .gaip-recommendation {
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
            }
            
            .gaip-recommendation.positive {
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                color: #86efac;
            }
            
            .gaip-recommendation.negative {
                background: rgba(234, 179, 8, 0.1);
                border: 1px solid rgba(234, 179, 8, 0.3);
                color: #fde047;
            }
            
            .gaip-recommendation.neutral {
                background: rgba(148, 163, 184, 0.1);
                border: 1px solid rgba(148, 163, 184, 0.3);
                color: var(--gaip-border);
            }
            
            .gaip-delta-table {
                margin-bottom: 16px;
            }
            
            .gaip-delta-table h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: var(--gaip-border);
            }
            
            .gaip-delta-table table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            
            .gaip-delta-table th {
                text-align: left;
                padding: 8px 12px;
                background: rgba(255,255,255,0.05);
                color: var(--gaip-text);
                font-weight: 500;
            }
            
            .gaip-delta-table td {
                padding: 8px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                color: var(--gaip-border);
            }
            
            .gaip-delta.positive {
                color: #86efac;
                font-weight: 600;
            }
            
            .gaip-delta.negative {
                color: #fca5a5;
                font-weight: 600;
            }
            
            .gaip-delta.neutral {
                color: var(--gaip-text);
            }
            
            .gaip-delta.changed {
                color: #fbbf24;
            }
            
            .gaip-section-header-row td {
                background: rgba(99, 102, 241, 0.15);
                color: #a5b4fc !important;
                font-weight: 600;
                font-size: 12px;
                padding: 6px 12px !important;
                border-bottom: none !important;
            }
            
            .gaip-changes-lists {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }
            
            .gaip-improvements,
            .gaip-concerns,
            .gaip-neutral {
                padding: 12px;
                border-radius: 8px;
            }
            
            .gaip-improvements {
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.2);
            }
            
            .gaip-concerns {
                background: rgba(234, 179, 8, 0.1);
                border: 1px solid rgba(234, 179, 8, 0.2);
            }
            
            .gaip-neutral {
                background: rgba(148, 163, 184, 0.1);
                border: 1px solid rgba(148, 163, 184, 0.2);
                grid-column: 1 / -1;
            }
            
            .gaip-improvements h4,
            .gaip-concerns h4,
            .gaip-neutral h4 {
                margin: 0 0 8px 0;
                font-size: 13px;
            }
            
            .gaip-improvements ul,
            .gaip-concerns ul,
            .gaip-neutral ul {
                margin: 0;
                padding-left: 20px;
                font-size: 12px;
            }
            
            .gaip-improvements li {
                color: #86efac;
            }
            
            .gaip-concerns li {
                color: #fde047;
            }
            
            @media (max-width: 768px) {
                .gaip-whatif-sections {
                    grid-template-columns: 1fr;
                }
                
                .gaip-whatif-arrow {
                    text-align: center;
                    padding: 10px 0;
                    transform: rotate(90deg);
                }
                
                .gaip-changes-lists {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }

    /* ============================================================
       INITIALIZATION
    ============================================================ */

    function mount(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`What-If UI: Container #${containerId} not found`);
            return false;
        }
        
        container.innerHTML = renderPanel();
        return true;
    }

    /**
     * Show the What-If panel as a modal overlay
     * Called by the What-If button in the Hub UI
     */
    function showWhatIfPanel() {
        // Check if modal already exists
        let modal = document.getElementById('gaip-whatif-modal');
        
        if (!modal) {
            // Create modal structure
            modal = document.createElement('div');
            modal.id = 'gaip-whatif-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.id = 'gaip-whatif-modal-content';
            modalContent.style.cssText = `
                background: var(--gaip-surface);
                border-radius: 12px;
                max-width: 900px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            `;
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
                position: absolute;
                top: 15px;
                right: 15px;
                background: var(--gaip-surface-hover);
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                z-index: 10;
            `;
            closeBtn.onclick = hideWhatIfPanel;
            
            // Container for the panel content
            const panelContainer = document.createElement('div');
            panelContainer.id = 'gaip-whatif-container';
            panelContainer.style.padding = '20px';
            
            modalContent.appendChild(closeBtn);
            modalContent.appendChild(panelContainer);
            modal.appendChild(modalContent);
            
            // Close on backdrop click
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hideWhatIfPanel();
                }
            });
            
            // Close on Escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modal.style.display !== 'none') {
                    hideWhatIfPanel();
                }
            });
            
            document.body.appendChild(modal);
        }
        
        // Mount the UI
        modal.style.display = 'flex';
        mount('gaip-whatif-container');
        
        // Load baseline state
        loadBaseline();
        
    }

    /**
     * Hide the What-If panel modal
     */
    function hideWhatIfPanel() {
        const modal = document.getElementById('gaip-whatif-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /* ============================================================
       EXPORTS
    ============================================================ */

    const WhatIfUI = {
        mount,
        renderPanel,
        loadBaseline,
        resetToBaseline,
        updateParameter,
        applyPreset,
        runComparison,
        buildComparisonFromResults,
        normalizeEngineResult,
        normalizeDeltas,
        renderConfidenceSection,
        showWhatIfPanel,
        hideWhatIfPanel,
        getState: () => currentState,
        PRESETS,
        CONFIG,
        VERSION: '2.7.3'
    };

    // Export to global (multiple aliases for compatibility)
    global.GAIP_WhatIfUI = WhatIfUI;
    global.GilbaScenarioUI = WhatIfUI;


})(typeof window !== 'undefined' ? window : this);
