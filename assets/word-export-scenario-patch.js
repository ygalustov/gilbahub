/**
 * =============================================================================
 * WORD EXPORT SCENARIO INTEGRATION PATCH
 * =============================================================================
 * 
 * Integration snippet for adding scenario comparison to Word export.
 * Load this AFTER word-export.js and scenario-export.js
 * 
 * WHAT IT DOES:
 * 1. Extends collectData() to include scenario comparison data
 * 2. Patches buildSections() to inject scenario section into document
 * 3. Provides UI helper for opt-in/out checkbox
 * 
 * CHANGELOG v1.2.0:
 * - Actually renders scenario section into Word document (was missing!)
 * - Patches buildSections() to inject after Priority Actions
 * - Uses GilbaScenarioExport.generateWordSection() for content
 * - Added opt-in/out checkbox support with localStorage persistence
 * - Fixed engine ID mapping for correct confidence display
 * - Added desiredDirection for smart change colouring
 * 
 * CHANGELOG v1.1.0:
 * - Added opt-in/out support via includeScenario option
 * - Fixed engine ID mapping (stress-aggregator, water-blender, etc.)
 * - Added desiredDirection for correct change colouring
 * - Defensive type checking on collectData return
 * - Exposed UI helper for export modal checkbox
 * - Added retry limit to prevent infinite polling
 * - Unit test hooks via _internal export
 * 
 * @version 1.2.0
 * @author Gilba Solutions
 * =============================================================================
 */

(function(global) {
    'use strict';

    const PATCH_VERSION = '1.2.0';
    const MAX_INIT_RETRIES = 50; // 5 seconds max wait
    let initRetries = 0;

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        debug: false,
        
        // Storage key for user preference
        storageKey: 'gilba_export_include_scenario',
        
        // Default inclusion state when scenario data exists
        defaultInclude: true,

        /**
         * Correct engine ID mappings
         * Maps metric path prefixes to actual engine IDs
         */
        engineIdMap: {
            'disease': 'disease-engine',
            'climate': 'climate-engine',
            'stress': 'stress-aggregator',
            'shade': 'shade-engine',
            'salinity': 'salinity-penalty-engine',
            'wear': 'wear-recovery-engine',
            'irrigation': 'irrigation-scheduler',
            'waterBlend': 'water-blender',
            'tissue': 'tissue-engine',
            'dew': 'dew-prediction-engine',
            'nutrition': 'nutrient-engine',
            'pgr': 'pgr-scheduler',
            'soil': 'soil-engine'
        },

        /**
         * Desired direction for metrics
         * 'lower' = decrease is good (green), increase is bad (red)
         * 'higher' = increase is good (green), decrease is bad (red)
         * 'neutral' = no colour coding
         */
        metricDirection: {
            'disease.overallScore': 'lower',
            'disease.overallRisk': 'lower',
            'climate.growthPotential': 'higher',
            'stress.environmentalStressIndex': 'lower',
            'stress.combinedGrowthModifier': 'higher',
            'shade.dli': 'higher',
            'shade.stressFactor': 'lower',
            'salinity.growthPenaltyPct': 'lower',
            'salinity.effectiveEC': 'lower',
            'wear.recoveryDays': 'lower',
            'wear.capacityUsed': 'lower',
            'irrigation.weeklyRequirement': 'neutral',
            'irrigation.leachingFraction': 'neutral',
            'waterBlend.EC': 'lower',
            'waterBlend.SAR': 'lower'
        }
    };

    // =========================================================================
    // LOGGING
    // =========================================================================

    function log(message, data) {
        if (!CONFIG.debug) return;
        if (data !== undefined) {
        } else {
        }
    }

    function warn(message, data) {
        if (data !== undefined) {
            console.warn('[ScenarioPatch]', message, data);
        } else {
            console.warn('[ScenarioPatch]', message);
        }
    }

    // =========================================================================
    // USER PREFERENCE STORAGE
    // =========================================================================

    function getIncludePreference() {
        try {
            const stored = localStorage.getItem(CONFIG.storageKey);
            if (stored !== null) {
                return stored === 'true';
            }
        } catch (e) {
            // localStorage unavailable
        }
        return CONFIG.defaultInclude;
    }

    function setIncludePreference(include) {
        try {
            localStorage.setItem(CONFIG.storageKey, String(include));
        } catch (e) {
            // localStorage unavailable
        }
    }

    // =========================================================================
    // ENGINE ID RESOLUTION
    // =========================================================================

    function resolveEngineId(metricPath) {
        if (!metricPath) return null;
        const prefix = metricPath.split('.')[0];
        return CONFIG.engineIdMap[prefix] || (prefix + '-engine');
    }

    function getDesiredDirection(metricPath) {
        return CONFIG.metricDirection[metricPath] || 'neutral';
    }

    function getChangeColour(direction, metricPath) {
        const desired = getDesiredDirection(metricPath);
        
        if (direction === 'none' || desired === 'neutral') {
            return '374151'; // Gray
        }
        
        const isGood = (desired === 'higher' && direction === 'increase') ||
                       (desired === 'lower' && direction === 'decrease');
        
        return isGood ? '16A34A' : 'DC2626'; // Green or Red
    }

    // =========================================================================
    // UI HELPER FOR EXPORT MODAL
    // =========================================================================

    function getScenarioUIState() {
        if (!global.GilbaScenarioExport?.hasExportData()) {
            return null;
        }

        const cache = global.GAIP_SCENARIO_EXPORT_CACHE;
        const summary = global.GilbaScenarioExport.getExportSummary();

        return {
            available: true,
            included: getIncludePreference(),
            presetType: summary?.presetType || 'custom',
            baselineLabel: cache?.baselineLabel || 'Baseline',
            scenarioLabel: cache?.scenarioLabel || 'Scenario',
            confidence: summary?.confidence || 'Unknown',
            rowCount: summary?.comparisonRows || 0,
            generatedAt: cache?.generatedAt || null,
            summary: buildUISummary(cache, summary)
        };
    }

    function buildUISummary(cache, summary) {
        if (!cache) return 'Scenario comparison';
        
        const presetLabels = {
            'gypsum': 'Gypsum Amendment',
            'gypsum-amendment': 'Gypsum Amendment',
            'methodology': 'Methodology Comparison',
            'mlsn-to-slan': 'MLSN → SLAN',
            'slan-to-mlsn': 'SLAN → MLSN',
            'water-blend': 'Water Blend',
            'worseShade': 'Increased Shade',
            'improveShade': 'Reduced Shade',
            'heavyTraffic': 'Heavy Traffic',
            'lightTraffic': 'Light Traffic',
            'custom': 'Custom Scenario'
        };
        
        const presetLabel = presetLabels[cache.presetType] || 'Scenario';
        return `${presetLabel}: ${cache.baselineLabel} vs ${cache.scenarioLabel}`;
    }

    function setScenarioIncluded(include) {
        setIncludePreference(include);
        log('Scenario inclusion set to:', include);
    }

    function renderCheckboxHTML() {
        const state = getScenarioUIState();
        if (!state) return null;

        const checked = state.included ? 'checked' : '';
        const timestamp = state.generatedAt 
            ? new Date(state.generatedAt).toLocaleTimeString() 
            : '';

        return `
            <div class="scenario-export-option" style="margin: 12px 0; padding: 12px; background: var(--gaip-surface-muted); border-radius: 6px; border: 1px solid var(--gaip-border);">
                <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                    <input 
                        type="checkbox" 
                        id="include-scenario-export" 
                        ${checked}
                        onchange="GAIP_ScenarioPatch.setScenarioIncluded(this.checked)"
                        style="margin-top: 2px;"
                    />
                    <div>
                        <div style="font-weight: 500; color: var(--gaip-text);">
                            Include scenario comparison
                        </div>
                        <div style="font-size: 13px; color: var(--gaip-text); margin-top: 2px;">
                            ${state.summary}
                        </div>
                        <div style="font-size: 12px; color: var(--gaip-text); margin-top: 4px;">
                            ${state.rowCount} metrics compared · ${state.confidence} · ${timestamp}
                        </div>
                    </div>
                </label>
            </div>
        `;
    }

    // =========================================================================
    // MAIN PATCH FUNCTIONS
    // =========================================================================

    function init() {
        if (!global.GAIP_WordExport) {
            if (++initRetries > MAX_INIT_RETRIES) {
                warn('Word export not loaded after max retries, giving up');
                return;
            }
            log('Word export not loaded yet, retrying... (' + initRetries + '/' + MAX_INIT_RETRIES + ')');
            setTimeout(init, 100);
            return;
        }

        if (!global.GilbaScenarioExport) {
            if (++initRetries > MAX_INIT_RETRIES) {
                warn('Scenario export not loaded after max retries, giving up');
                return;
            }
            log('Scenario export not loaded yet, retrying... (' + initRetries + '/' + MAX_INIT_RETRIES + ')');
            setTimeout(init, 100);
            return;
        }

        patchWordExport();
    }

    function patchWordExport() {
        const originalCollectData = global.GAIP_WordExport.collectData;
        const originalBuildSections = global.GAIP_WordExport.buildSections;

        // =====================================================================
        // Patch collectData() - Add scenario data to export payload
        // =====================================================================
        global.GAIP_WordExport.collectData = function(options) {
            options = options || {};
            const data = originalCollectData ? originalCollectData.call(global.GAIP_WordExport, options) : {};
            
            // Defensive: ensure we have an object
            if (typeof data !== 'object' || data === null) {
                warn('collectData returned non-object, skipping scenario injection');
                return data || {};
            }
            
            // Check if scenario should be included
            const includeScenario = options.includeScenario !== undefined 
                ? options.includeScenario 
                : getIncludePreference();
            
            // Add scenario data if available and opted in
            if (global.GilbaScenarioExport.hasExportData() && includeScenario) {
                const cache = global.GAIP_SCENARIO_EXPORT_CACHE;
                
                data.scenario = global.GilbaScenarioExport.getExportSummary();
                data.scenarioFull = cache;
                data._scenarioIncluded = true;
                
                log('Added scenario data to export', {
                    presetType: cache?.presetType,
                    rows: cache?.comparison?.rows?.length
                });
            } else {
                data._scenarioIncluded = false;
            }
            
            return data;
        };

        // =====================================================================
        // Patch buildSections() - Inject scenario section into document
        // =====================================================================
        if (typeof originalBuildSections === 'function') {
            global.GAIP_WordExport.buildSections = function(data, charts) {
                // Call original to get base sections
                const sections = originalBuildSections.call(global.GAIP_WordExport, data, charts);
                
                // Check if we should inject scenario section
                if (!data._scenarioIncluded || !data.scenarioFull) {
                    return sections;
                }
                
                // Generate scenario section elements
                let scenarioElements = [];
                try {
                    if (typeof global.GilbaScenarioExport.generateWordSection === 'function') {
                        scenarioElements = global.GilbaScenarioExport.generateWordSection(data.scenarioFull);
                        log('Generated scenario section with', scenarioElements.length, 'elements');
                    }
                } catch (err) {
                    warn('Error generating scenario section:', err);
                    return sections;
                }
                
                if (!scenarioElements || scenarioElements.length === 0) {
                    return sections;
                }
                
                // Find insertion point - after Priority Actions or Executive Summary
                // Look for "Priority Actions" heading or insert after executive summary
                let insertIndex = findInsertionPoint(sections);
                
                // Insert scenario elements
                log('Inserting scenario section at index', insertIndex);
                sections.splice(insertIndex, 0, ...scenarioElements);
                
                return sections;
            };
            log('buildSections patched for scenario injection');
        } else {
            warn('buildSections not found - scenario section will not render in document');
        }

        // Store references
        global.GAIP_WordExport._scenarioPatched = true;
        global.GAIP_WordExport._scenarioPatchVersion = PATCH_VERSION;
        global.GAIP_WordExport._originalCollectData = originalCollectData;
        global.GAIP_WordExport._originalBuildSections = originalBuildSections;
    }

    /**
     * Find the best insertion point for scenario section
     * Prefers: after Priority Actions > after Executive Summary > near start
     */
    function findInsertionPoint(sections) {
        // Look for Priority Actions or specific section headings
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            
            // Check if this is a heading paragraph
            if (section && section.root) {
                try {
                    // Try to extract text from the paragraph
                    const text = extractParagraphText(section);
                    
                    // Insert AFTER Priority Actions section ends (before next Heading1)
                    if (text && text.includes('Priority Actions')) {
                        // Find the next Heading1 after this
                        for (let j = i + 1; j < sections.length; j++) {
                            const nextText = extractParagraphText(sections[j]);
                            if (nextText && isHeading1(sections[j])) {
                                return j; // Insert before the next major section
                            }
                        }
                    }
                    
                    // Fallback: Insert before Climate Analysis or first analysis section
                    if (text && (text.includes('Climate') || text.includes('Growth'))) {
                        if (isHeading1(section)) {
                            return i;
                        }
                    }
                } catch (e) {
                    // Continue searching
                }
            }
        }
        
        // Default: insert after initial content (logo, title, summary) - around index 10
        return Math.min(10, sections.length);
    }

    /**
     * Try to extract text content from a docx paragraph element
     */
    function extractParagraphText(element) {
        if (!element) return '';
        
        try {
            // docx.js stores content in various ways depending on version
            if (element.root && element.root.length > 0) {
                // Walk the tree looking for text
                return walkForText(element.root);
            }
        } catch (e) {
            return '';
        }
        return '';
    }

    function walkForText(nodes) {
        if (!nodes) return '';
        let text = '';
        
        const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
        for (const node of nodeArray) {
            if (typeof node === 'string') {
                text += node;
            } else if (node && node.root) {
                text += walkForText(node.root);
            } else if (node && node.children) {
                text += walkForText(node.children);
            } else if (node && node.options && node.options.text) {
                text += node.options.text;
            }
        }
        return text;
    }

    /**
     * Check if element appears to be a Heading1
     */
    function isHeading1(element) {
        if (!element || !element.options) return false;
        
        // Check for heading level
        if (element.options.heading === 'Heading1' || 
            element.options.heading === 1 ||
            (element.options.style && element.options.style.includes('Heading1'))) {
            return true;
        }
        return false;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    function generateScenarioSection(options) {
        if (!global.GilbaScenarioExport.hasExportData()) {
            warn('No scenario data available for export');
            return null;
        }

        const cache = global.GAIP_SCENARIO_EXPORT_CACHE;
        if (typeof global.GilbaScenarioExport.generateWordSection === 'function') {
            return global.GilbaScenarioExport.generateWordSection(cache);
        }
        return null;
    }

    function shouldIncludeScenario() {
        return global.GilbaScenarioExport?.hasExportData() && getIncludePreference();
    }

    function reset() {
        if (global.GilbaScenarioExport?.clearExportCache) {
            global.GilbaScenarioExport.clearExportCache();
        }
        setIncludePreference(CONFIG.defaultInclude);
        log('Scenario export reset');
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GAIP_ScenarioPatch = {
        version: PATCH_VERSION,

        // UI helpers
        getScenarioUIState,
        setScenarioIncluded,
        renderCheckboxHTML,
        shouldIncludeScenario,

        // Generation
        generateScenarioSection,

        // Utilities
        resolveEngineId,
        getDesiredDirection,
        getChangeColour,

        // Management
        reset,

        // Internal (for testing)
        _internal: {
            CONFIG,
            getIncludePreference,
            setIncludePreference,
            buildUISummary,
            findInsertionPoint,
            init
        }
    };

    // Legacy alias
    global.GAIP_generateScenarioSection = generateScenarioSection;

})(typeof window !== 'undefined' ? window : this);
