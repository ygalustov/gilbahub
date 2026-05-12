/**
 * =============================================================================
 * GILBA SCENARIO EXPORT INTEGRATION v1.1.0
 * =============================================================================
 * 
 * Formats scenario comparison results for Word export and provides
 * confidence metadata for professional defensibility.
 * 
 * CHANGELOG v1.1.0:
 * ─────────────────────────────────────────────────────────────────────────────
 * - Fixed: Export now includes ALL metrics displayed in What-If UI
 * - Fixed: Metric paths now match scenario engine output structure
 *   (e.g., shade.DLI_total instead of shade.dli)
 * - Added: Traffic & Recovery metrics (totalLoad, recoveryCapacity, ratio, status)
 * - Added: Irrigation metrics (weeklyNeed, leachingRequirement)
 * - Added: Nitrogen metrics (recommendedAnnual, status)
 * - Added: 14-Day Outlook (peakScore, criticalDays, trend)
 * - Added: Light/Shade metrics (DLI_total, status, deficit)
 * - Added: desiredDirection for smart colour coding in Word export
 * - Added: Alias mapping for legacy/alternative path names
 * - Added: Category grouping support for future table organisation
 * 
 * INTEGRATION:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Run a scenario comparison via presets or cascade
 * 2. Call GilbaScenarioExport.prepare(result) to format for export
 * 3. Word export reads from GAIP_SCENARIO_EXPORT_CACHE
 * 
 * CONFIDENCE SCORING:
 * ─────────────────────────────────────────────────────────────────────────────
 * Each engine output is tagged with:
 *   - computed: Engine ran successfully with full inputs
 *   - estimated: Engine ran with partial/default inputs
 *   - unavailable: Engine did not run or failed
 * 
 * @author Gilba Solutions
 * @version 1.1.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const EXPORT_VERSION = '1.1.0';

    // =========================================================================
    // GLOBAL EXPORT CACHE
    // =========================================================================
    
    /**
     * Global cache for scenario export data
     * Word export reads from this object
     */
    global.GAIP_SCENARIO_EXPORT_CACHE = null;

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        debug: false,
        
        // Metrics to include in comparison tables
        // These paths must match the scenario engine output structure used by gaip-whatif-ui.js
        exportMetrics: {
            // ═══════════════════════════════════════════════════════════════════
            // LIGHT & SHADE (☀️)
            // ═══════════════════════════════════════════════════════════════════
            'shade.DLI_total': { label: 'Total DLI', unit: 'mol/m²', precision: 1, category: 'shade', desiredDirection: 'higher' },
            'shade.status': { label: 'Light Status', unit: '', precision: 0, category: 'shade', isText: true },
            'shade.deficit': { label: 'DLI Deficit', unit: 'mol/m²', precision: 1, category: 'shade', desiredDirection: 'lower' },
            
            // ═══════════════════════════════════════════════════════════════════
            // DISEASE RISK (🦠)
            // ═══════════════════════════════════════════════════════════════════
            'disease.overallScore': { label: 'Overall Score', unit: '/100', precision: 0, category: 'disease', desiredDirection: 'lower' },
            'disease.overallRisk': { label: 'Risk Level', unit: '', precision: 0, category: 'disease', isText: true },
            'disease.primaryRisk': { label: 'Primary Risk', unit: '', precision: 0, category: 'disease', isText: true },
            
            // ═══════════════════════════════════════════════════════════════════
            // TRAFFIC & RECOVERY (🏟️)
            // ═══════════════════════════════════════════════════════════════════
            'traffic.totalLoad': { label: 'Total Load', unit: '', precision: 1, category: 'traffic', desiredDirection: 'lower' },
            'traffic.recoveryCapacity': { label: 'Recovery Capacity', unit: '%', precision: 0, category: 'traffic', desiredDirection: 'higher' },
            'traffic.wearRecoveryRatio': { label: 'Wear/Recovery Ratio', unit: '', precision: 2, category: 'traffic', desiredDirection: 'lower' },
            'traffic.status': { label: 'Traffic Status', unit: '', precision: 0, category: 'traffic', isText: true },
            
            // ═══════════════════════════════════════════════════════════════════
            // IRRIGATION (💦)
            // ═══════════════════════════════════════════════════════════════════
            'irrigation.weeklyNeed': { label: 'Weekly Need', unit: 'mm', precision: 0, category: 'irrigation', desiredDirection: 'lower' },
            'irrigation.leachingRequirement': { label: 'Leaching Req.', unit: '%', precision: 0, category: 'irrigation', desiredDirection: 'lower' },
            
            // ═══════════════════════════════════════════════════════════════════
            // NITROGEN (🧪)
            // ═══════════════════════════════════════════════════════════════════
            'nOpt.recommendedAnnual': { label: 'Recommended N', unit: 'kg/ha/yr', precision: 0, category: 'nitrogen', desiredDirection: 'lower' },
            'nOpt.status': { label: 'N Status', unit: '', precision: 0, category: 'nitrogen', isText: true },
            
            // ═══════════════════════════════════════════════════════════════════
            // 14-DAY OUTLOOK (📈)
            // ═══════════════════════════════════════════════════════════════════
            'stressTrajectory.peakScore': { label: 'Peak Stress', unit: '', precision: 0, category: 'outlook', desiredDirection: 'lower' },
            'stressTrajectory.criticalDays': { label: 'Critical Days', unit: 'days', precision: 0, category: 'outlook', desiredDirection: 'lower' },
            'stressTrajectory.trend': { label: 'Trend', unit: '', precision: 0, category: 'outlook', isText: true },
            
            // ═══════════════════════════════════════════════════════════════════
            // PGR (🌱) - Optional, only shown if PGR active
            // ═══════════════════════════════════════════════════════════════════
            'pgr.effectRemaining': { label: 'Effect Remaining', unit: '%', precision: 0, category: 'pgr', desiredDirection: 'higher', optional: true },
            'pgr.daysToReapply': { label: 'Days to Reapply', unit: 'days', precision: 0, category: 'pgr', desiredDirection: 'higher', optional: true },
            
            // ═══════════════════════════════════════════════════════════════════
            // SALINITY (supplementary, not in main UI but useful for exports)
            // ═══════════════════════════════════════════════════════════════════
            'salinity.growthPenaltyPct': { label: 'Salinity Penalty', unit: '%', precision: 0, category: 'salinity', desiredDirection: 'lower', optional: true },
            
            // ═══════════════════════════════════════════════════════════════════
            // GROWTH (supplementary)
            // ═══════════════════════════════════════════════════════════════════
            'climate.growthPotential': { label: 'Growth Potential', unit: '%', precision: 0, category: 'climate', desiredDirection: 'higher', optional: true }
        },
        
        // Confidence level definitions
        confidenceLevels: {
            computed: {
                code: 'computed',
                label: 'Computed',
                symbol: '✓',
                color: '16A34A',
                description: 'Calculated from complete input data'
            },
            estimated: {
                code: 'estimated',
                label: 'Estimated',
                symbol: '~',
                color: 'F59E0B',
                description: 'Calculated with partial or default inputs'
            },
            unavailable: {
                code: 'unavailable',
                label: 'Unavailable',
                symbol: '-',
                color: '9CA3AF',
                description: 'Engine did not run or data not available'
            }
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

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    function safeNum(val, fallback = null) {
        const n = parseFloat(val);
        return isFinite(n) ? n : fallback;
    }

    /**
     * Get nested value from object using dot notation
     */
    function getPath(obj, path, defaultValue = undefined) {
        if (!obj || !path) return defaultValue;
        
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current === null || current === undefined || !(part in current)) {
                return defaultValue;
            }
            current = current[part];
        }
        
        return current !== undefined ? current : defaultValue;
    }

    /**
     * Format a value for display
     */
    function formatValue(value, precision = 1, unit = '') {
        if (value === null || value === undefined) {
            return '-';
        }
        
        if (typeof value === 'number') {
            const formatted = precision === 0 
                ? Math.round(value).toString()
                : value.toFixed(precision);
            return unit ? `${formatted} ${unit}` : formatted;
        }
        
        return String(value);
    }

    // =========================================================================
    // CONFIDENCE SCORING
    // =========================================================================

    /**
     * Assess confidence level for an engine output
     * @param {string} engineId - Engine identifier
     * @param {object} state - State containing computed outputs
     * @param {object} executionLog - Log from cascade execution
     * @returns {object} Confidence assessment
     */
    function assessConfidence(engineId, state, executionLog = []) {
        // Check execution log first
        const logEntry = executionLog.find(e => e.engine === engineId);
        
        if (logEntry) {
            if (logEntry.status === 'error') {
                return {
                    ...CONFIG.confidenceLevels.unavailable,
                    reason: logEntry.error || 'Engine execution failed'
                };
            }
            
            if (logEntry.status === 'skipped') {
                return {
                    ...CONFIG.confidenceLevels.unavailable,
                    reason: logEntry.reason || 'Engine skipped'
                };
            }
        }
        
        // Map engine IDs to their output paths
        const engineOutputMap = {
            'climate-engine': 'computed.climate',
            'disease-engine': 'computed.disease',
            'shade-engine': 'computed.shade',
            'salinity-penalty-engine': 'computed.salinity',
            'stress-aggregator': 'computed.stress',
            'wear-recovery-engine': 'computed.wear',
            'irrigation-scheduler': 'computed.irrigation',
            'tissue-engine': 'computed.tissue',
            'dew-prediction-engine': 'computed.dew',
            'water-blender': 'computed.waterBlend'
        };
        
        const outputPath = engineOutputMap[engineId];
        if (!outputPath) {
            return CONFIG.confidenceLevels.unavailable;
        }
        
        const output = getPath(state, outputPath);
        
        if (!output) {
            return {
                ...CONFIG.confidenceLevels.unavailable,
                reason: 'No output data'
            };
        }
        
        // Check for estimation flags in the output
        if (output._estimated || output.isEstimated || output.source === 'default') {
            return {
                ...CONFIG.confidenceLevels.estimated,
                reason: output._estimationReason || 'Used default or partial inputs'
            };
        }
        
        return {
            ...CONFIG.confidenceLevels.computed,
            reason: 'Full computation completed'
        };
    }

    /**
     * Generate confidence summary for entire cascade result
     * @param {object} cascadeResult - Result from runCascade
     * @returns {object} Confidence summary
     */
    function generateConfidenceSummary(cascadeResult) {
        if (!cascadeResult || !cascadeResult.metadata) {
            return { overall: 'unavailable', engines: {} };
        }
        
        const { executionLog = [], executionOrder = [] } = cascadeResult.metadata;
        const state = cascadeResult.state;
        
        const engineConfidence = {};
        let computedCount = 0;
        let estimatedCount = 0;
        let unavailableCount = 0;
        
        for (const engineId of executionOrder) {
            const confidence = assessConfidence(engineId, state, executionLog);
            engineConfidence[engineId] = confidence;
            
            if (confidence.code === 'computed') computedCount++;
            else if (confidence.code === 'estimated') estimatedCount++;
            else unavailableCount++;
        }
        
        // Determine overall confidence
        let overall;
        if (unavailableCount > executionOrder.length * 0.3) {
            overall = 'low';
        } else if (estimatedCount > executionOrder.length * 0.3) {
            overall = 'moderate';
        } else {
            overall = 'high';
        }
        
        return {
            overall,
            overallLabel: overall === 'high' ? 'High Confidence' 
                        : overall === 'moderate' ? 'Moderate Confidence'
                        : 'Low Confidence',
            summary: {
                computed: computedCount,
                estimated: estimatedCount,
                unavailable: unavailableCount,
                total: executionOrder.length
            },
            engines: engineConfidence
        };
    }

    // =========================================================================
    // METRIC EXTRACTION
    // =========================================================================

    /**
     * Extract a metric value from state
     * 
     * The scenario engine returns data in different structures:
     * 1. Direct paths: state.shade.DLI_total, state.disease.overallScore
     * 2. Computed paths: state.computed.shade.DLI_total
     * 3. Result paths (from GAIP_ScenarioEngine): result.shade.DLI_total
     * 
     * @param {object} state - Scenario state/result object
     * @param {string} metricPath - Dot notation path (e.g., 'shade.DLI_total')
     * @returns {*} Metric value
     */
    function extractMetric(state, metricPath) {
        if (!state || !metricPath) return undefined;
        
        // Priority 1: Direct path on state (scenario engine format)
        // e.g., state.shade.DLI_total, state.traffic.recoveryCapacity
        let value = getPath(state, metricPath);
        
        // Priority 2: Under 'computed' (GAIP_STATE format)
        // e.g., state.computed.shade.DLI_total
        if (value === undefined && state.computed) {
            value = getPath(state.computed, metricPath);
        }
        
        // Priority 3: Under 'inputs' for input-only values
        if (value === undefined && state.inputs) {
            value = getPath(state.inputs, metricPath);
        }
        
        // Handle some alias/legacy paths
        if (value === undefined) {
            const aliasMap = {
                'shade.DLI_total': ['shade.dli', 'shade.dliTotal', 'shade.effectiveDLI'],
                'shade.deficit': ['shade.dliDeficit', 'shade.DLI_deficit'],
                'traffic.recoveryCapacity': ['wear.recoveryCapacity', 'traffic.recovery'],
                'traffic.wearRecoveryRatio': ['wear.wearRecoveryRatio', 'traffic.ratio'],
                'traffic.status': ['wear.status', 'traffic.sustainability'],
                'irrigation.weeklyNeed': ['irrigation.weeklyRequirement', 'irrigation.weeklyTotal'],
                'irrigation.leachingRequirement': ['irrigation.leachingFraction', 'irrigation.LF'],
                'nOpt.recommendedAnnual': ['nOpt.annualN', 'nitrogen.recommendedAnnual'],
                'disease.overallScore': ['disease.score', 'disease.riskScore'],
                'disease.overallRisk': ['disease.risk', 'disease.riskLevel']
            };
            
            const aliases = aliasMap[metricPath];
            if (aliases) {
                for (const alias of aliases) {
                    value = getPath(state, alias);
                    if (value === undefined && state.computed) {
                        value = getPath(state.computed, alias);
                    }
                    if (value !== undefined) break;
                }
            }
        }
        
        return value;
    }

    /**
     * Extract all tracked metrics from state
     * @param {object} state - Hub state
     * @returns {object} Metrics with values and confidence
     */
    function extractAllMetrics(state, confidenceSummary = {}) {
        const metrics = {};
        
        for (const [path, config] of Object.entries(CONFIG.exportMetrics)) {
            const value = extractMetric(state, path);
            const engineId = path.split('.')[0] + '-engine';
            
            metrics[path] = {
                ...config,
                path,
                value,
                formatted: formatValue(value, config.precision, config.unit),
                confidence: confidenceSummary.engines?.[engineId] || null
            };
        }
        
        return metrics;
    }

    // =========================================================================
    // COMPARISON FORMATTING
    // =========================================================================

    /**
     * Generate comparison data for two scenarios
     * @param {object} baseline - Baseline state
     * @param {object} scenario - Modified scenario state
     * @param {object} options - Labels and metadata
     * @returns {object} Comparison data
     */
    function generateComparison(baseline, scenario, options = {}) {
        const baselineLabel = options.baselineLabel || 'Current';
        const scenarioLabel = options.scenarioLabel || 'Scenario';
        
        const rows = [];
        let currentCategory = null;
        
        for (const [path, config] of Object.entries(CONFIG.exportMetrics)) {
            const baselineValue = extractMetric(baseline, path);
            const scenarioValue = extractMetric(scenario, path);
            
            // Skip optional metrics if both are unavailable
            if (baselineValue === undefined && scenarioValue === undefined) {
                continue;
            }
            
            // Skip optional metrics if they have no meaningful data
            if (config.optional) {
                // For PGR, only show if at least one scenario has it active
                if (path.startsWith('pgr.')) {
                    const baselineActive = baseline?.pgr?.active;
                    const scenarioActive = scenario?.pgr?.active;
                    if (!baselineActive && !scenarioActive) {
                        continue;
                    }
                }
            }
            
            // Calculate change
            let change = null;
            let changePercent = null;
            let changeDirection = 'none';
            
            if (typeof baselineValue === 'number' && typeof scenarioValue === 'number') {
                change = scenarioValue - baselineValue;
                if (baselineValue !== 0) {
                    changePercent = (change / baselineValue) * 100;
                }
                
                if (Math.abs(change) > 0.001) {
                    changeDirection = change > 0 ? 'increase' : 'decrease';
                }
            }
            
            // Determine if this change is good or bad based on desiredDirection
            let changeQuality = 'neutral';
            if (changeDirection !== 'none' && config.desiredDirection) {
                if (config.desiredDirection === 'higher') {
                    changeQuality = changeDirection === 'increase' ? 'good' : 'bad';
                } else if (config.desiredDirection === 'lower') {
                    changeQuality = changeDirection === 'decrease' ? 'good' : 'bad';
                }
            }
            
            rows.push({
                label: config.label,
                unit: config.unit,
                path: path,
                category: config.category || 'other',
                isText: config.isText || false,
                desiredDirection: config.desiredDirection || 'neutral',
                baseline: {
                    value: baselineValue,
                    formatted: formatValue(baselineValue, config.precision, '')
                },
                scenario: {
                    value: scenarioValue,
                    formatted: formatValue(scenarioValue, config.precision, '')
                },
                change: {
                    absolute: change,
                    percent: changePercent,
                    direction: changeDirection,
                    quality: changeQuality,
                    formatted: change !== null 
                        ? (change >= 0 ? '+' : '') + formatValue(change, config.precision, config.unit)
                        : '-'
                }
            });
        }
        
        return {
            baselineLabel,
            scenarioLabel,
            rows,
            rowCount: rows.length,
            generatedAt: new Date().toISOString()
        };
    }

    // =========================================================================
    // EXPORT PAYLOAD GENERATION
    // =========================================================================

    /**
     * Prepare scenario result for Word export
     * @param {object} result - Result from GilbaScenarioPresets.compare() or cascade
     * @param {object} options - Additional options
     * @returns {object} Export-ready payload
     */
    function prepareForExport(result, options = {}) {
        if (!result || !result.success) {
            log('Cannot prepare invalid result for export');
            return null;
        }
        
        const payload = {
            version: EXPORT_VERSION,
            generatedAt: new Date().toISOString(),
            presetType: result.presetType || options.presetType || 'custom',
            
            // Labels
            baselineLabel: result.baseline?.label || options.baselineLabel || 'Baseline',
            scenarioLabel: result.scenario?.label || options.scenarioLabel || 'Scenario',
            
            // States
            hasBaseline: !!result.baseline?.state,
            hasScenario: !!result.scenario?.state,
            
            // Confidence
            confidence: {
                baseline: result.baseline?.state 
                    ? generateConfidenceSummary({ state: result.baseline.state, metadata: result.baseline.metadata })
                    : null,
                scenario: result.scenario?.state
                    ? generateConfidenceSummary({ state: result.scenario.state, metadata: result.scenario.metadata })
                    : null
            },
            
            // Comparison table
            comparison: result.baseline?.state && result.scenario?.state
                ? generateComparison(
                    result.baseline.state,
                    result.scenario.state,
                    { 
                        baselineLabel: result.baseline.label,
                        scenarioLabel: result.scenario.label
                    }
                )
                : null,
            
            // Modifications applied
            modifications: result.scenario?.modifications || {},
            
            // Metadata from preset
            presetMetadata: result.scenario?.modifications?._metadata || null,
            
            // Execution stats
            executionStats: {
                baselineDuration: result.metadata?.durationA || result.baseline?.metadata?.duration,
                scenarioDuration: result.metadata?.durationB || result.scenario?.metadata?.duration,
                enginesRun: result.scenario?.metadata?.enginesExecuted || 0
            }
        };
        
        // Add preset-specific data
        switch (payload.presetType) {
            case 'gypsum':
            case 'gypsum-amendment':
                payload.gypsumData = extractGypsumData(result);
                break;
                
            case 'methodology':
            case 'mlsn-to-slan':
            case 'slan-to-mlsn':
                payload.methodologyData = extractMethodologyData(result);
                break;
                
            case 'water-blend':
                payload.waterBlendData = extractWaterBlendData(result);
                break;
        }
        
        // Cache for Word export
        global.GAIP_SCENARIO_EXPORT_CACHE = payload;
        log('Export payload prepared and cached', { presetType: payload.presetType });
        
        return payload;
    }

    /**
     * Extract gypsum-specific data for export
     */
    function extractGypsumData(result) {
        const metadata = result.scenario?.modifications?._metadata;
        const requirement = metadata?.requirement;
        
        if (!requirement) return null;
        
        return {
            required: requirement.required,
            rate: requirement.rate,
            unit: requirement.unit,
            deltaESP: requirement.deltaESP,
            staging: requirement.staging,
            caSupplied: requirement.caSupplied,
            sSupplied: requirement.sSupplied,
            inputs: requirement.inputs
        };
    }

    /**
     * Extract methodology comparison data for export
     */
    function extractMethodologyData(result) {
        if (!global.GilbaScenarioPresets?.methodology) return null;
        
        // Get soil values from baseline
        const soil = result.baseline?.state?.inputs?.soil || {};
        
        return {
            thresholdComparison: global.GilbaScenarioPresets.methodology.getThresholdComparison(),
            soilValues: {
                P: soil.P || soil.p,
                K: soil.K || soil.k,
                Ca: soil.Ca || soil.ca,
                Mg: soil.Mg || soil.mg,
                S: soil.S || soil.s
            }
        };
    }

    /**
     * Extract water blend data for export
     */
    function extractWaterBlendData(result) {
        const state = result.scenario?.state;
        const waterInputs = state?.inputs?.water || {};
        const waterComputed = state?.computed?.waterBlend || {};
        
        return {
            sources: waterInputs.sources || [],
            fractions: waterInputs.fractions || [],
            blendedEC: waterComputed.EC_dSm || waterComputed.EC,
            blendedSAR: waterComputed.SAR,
            blendedRSC: waterComputed.RSC
        };
    }

    // =========================================================================
    // WORD EXPORT SECTION GENERATOR
    // =========================================================================

    /**
     * Generate Word document elements for scenario comparison
     * This returns an array of docx elements (requires docx library)
     * @param {object} payload - Export payload from prepareForExport()
     * @returns {Array} Array of docx elements
     */
    function generateWordSection(payload) {
        if (!payload || typeof docx === 'undefined') {
            return [];
        }
        
        const { Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, 
                WidthType, AlignmentType, ShadingType } = docx;
        
        const elements = [];
        
        // Section heading
        elements.push(new Paragraph({
            text: 'Scenario Comparison',
            heading: 'Heading1'
        }));
        
        // Scenario labels
        elements.push(new Paragraph({
            children: [
                new TextRun({ text: 'Baseline: ', bold: true }),
                new TextRun({ text: payload.baselineLabel }),
                new TextRun({ text: '  |  ' }),
                new TextRun({ text: 'Scenario: ', bold: true }),
                new TextRun({ text: payload.scenarioLabel })
            ],
            spacing: { after: 200 }
        }));
        
        // Confidence summary
        if (payload.confidence?.scenario) {
            const conf = payload.confidence.scenario;
            elements.push(new Paragraph({
                children: [
                    new TextRun({ text: 'Confidence: ', bold: true }),
                    new TextRun({ 
                        text: conf.overallLabel,
                        color: conf.overall === 'high' ? '16A34A' 
                             : conf.overall === 'moderate' ? 'F59E0B' 
                             : 'DC2626'
                    }),
                    new TextRun({ 
                        text: ` (${conf.summary.computed} computed, ${conf.summary.estimated} estimated, ${conf.summary.unavailable} unavailable)`,
                        size: 18,
                        color: '6B7280'
                    })
                ],
                spacing: { after: 200 }
            }));
        }
        
        // Comparison table
        if (payload.comparison && payload.comparison.rows.length > 0) {
            const tableRows = [
                // Header row
                new TableRow({
                    tableHeader: true,
                    children: [
                        new TableCell({
                            children: [new Paragraph({ text: 'Metric', alignment: AlignmentType.LEFT })],
                            shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
                            width: { size: 30, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: payload.baselineLabel, alignment: AlignmentType.CENTER })],
                            shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
                            width: { size: 20, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: payload.scenarioLabel, alignment: AlignmentType.CENTER })],
                            shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
                            width: { size: 20, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: 'Change', alignment: AlignmentType.CENTER })],
                            shading: { type: ShadingType.SOLID, color: 'F3F4F6' },
                            width: { size: 30, type: WidthType.PERCENTAGE }
                        })
                    ]
                })
            ];
            
            // Data rows
            for (const row of payload.comparison.rows) {
                // Use quality-based colouring (accounts for desiredDirection)
                // good = green, bad = red, neutral = gray
                const changeColor = row.change.quality === 'good' ? '16A34A'
                                  : row.change.quality === 'bad' ? 'DC2626'
                                  : '374151';
                
                tableRows.push(new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ 
                                children: [
                                    new TextRun({ text: row.label }),
                                    row.unit ? new TextRun({ text: ` (${row.unit})`, size: 18, color: '6B7280' }) : null
                                ].filter(Boolean)
                            })]
                        }),
                        new TableCell({
                            children: [new Paragraph({ 
                                text: row.baseline.formatted,
                                alignment: AlignmentType.CENTER 
                            })]
                        }),
                        new TableCell({
                            children: [new Paragraph({ 
                                text: row.scenario.formatted,
                                alignment: AlignmentType.CENTER 
                            })]
                        }),
                        new TableCell({
                            children: [new Paragraph({ 
                                children: [new TextRun({ text: row.change.formatted, color: changeColor })],
                                alignment: AlignmentType.CENTER 
                            })]
                        })
                    ]
                }));
            }
            
            elements.push(new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
                }
            }));
        }
        
        // Preset-specific content
        if (payload.gypsumData && payload.gypsumData.required) {
            elements.push(new Paragraph({ text: '' })); // Spacer
            elements.push(new Paragraph({
                text: 'Gypsum Amendment Details',
                heading: 'Heading2'
            }));
            elements.push(new Paragraph({
                children: [
                    new TextRun({ text: 'Application Rate: ', bold: true }),
                    new TextRun({ text: `${payload.gypsumData.rate} ${payload.gypsumData.unit}` })
                ]
            }));
            elements.push(new Paragraph({
                children: [
                    new TextRun({ text: 'ESP Reduction: ', bold: true }),
                    new TextRun({ text: `${payload.gypsumData.inputs.espCurrent}% → ${payload.gypsumData.inputs.espTarget}%` })
                ]
            }));
            if (payload.gypsumData.staging) {
                elements.push(new Paragraph({
                    children: [
                        new TextRun({ text: 'Staging: ', bold: true }),
                        new TextRun({ text: payload.gypsumData.staging.schedule })
                    ]
                }));
            }
            elements.push(new Paragraph({
                children: [
                    new TextRun({ text: 'Ca supplied: ', size: 20, color: '6B7280' }),
                    new TextRun({ text: `${payload.gypsumData.caSupplied} kg/ha`, size: 20, color: '6B7280' }),
                    new TextRun({ text: '  |  S supplied: ', size: 20, color: '6B7280' }),
                    new TextRun({ text: `${payload.gypsumData.sSupplied} kg/ha`, size: 20, color: '6B7280' })
                ]
            }));
        }
        
        return elements;
    }

    // =========================================================================
    // INTEGRATION HELPERS
    // =========================================================================

    /**
     * Check if scenario data is available for export
     */
    function hasExportData() {
        return global.GAIP_SCENARIO_EXPORT_CACHE !== null;
    }

    /**
     * Clear the export cache
     */
    function clearExportCache() {
        global.GAIP_SCENARIO_EXPORT_CACHE = null;
        log('Export cache cleared');
    }

    /**
     * Get summary for Word export collectData integration
     * Returns simplified object for existing export flow
     */
    function getExportSummary() {
        const cache = global.GAIP_SCENARIO_EXPORT_CACHE;
        if (!cache) return null;
        
        return {
            hasScenario: true,
            presetType: cache.presetType,
            baselineLabel: cache.baselineLabel,
            scenarioLabel: cache.scenarioLabel,
            confidence: cache.confidence?.scenario?.overallLabel || 'Unknown',
            comparisonRows: cache.comparison?.rows?.length || 0,
            gypsumRate: cache.gypsumData?.rate || null,
            generatedAt: cache.generatedAt
        };
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaScenarioExport = {
        version: EXPORT_VERSION,
        
        // Main functions
        prepare: prepareForExport,
        generateWordSection,
        
        // Confidence
        assessConfidence,
        generateConfidenceSummary,
        
        // Metrics
        extractMetric,
        extractAllMetrics,
        generateComparison,
        
        // Integration helpers
        hasExportData,
        clearExportCache,
        getExportSummary,
        
        // Direct cache access
        getCache: () => global.GAIP_SCENARIO_EXPORT_CACHE,
        
        // Configuration
        getConfig: () => ({ ...CONFIG }),
        getConfidenceLevels: () => ({ ...CONFIG.confidenceLevels })
    };


})(typeof window !== 'undefined' ? window : this);
