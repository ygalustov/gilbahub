/**
 * =============================================================================
 * GILBA HUB EXPORT METADATA v1.1.3
 * =============================================================================
 * 
 * Enhances Word/PDF exports with:
 * - Version stamps for all engines used
 * - Citation references
 * - Data quality indicators
 * - Provenance metadata
 * - Disclaimer logic based on data completeness
 * - Engine confidence harvesting from computed results (v1.1.0)
 * 
 * Part of Phase 1 epistemic infrastructure.
 * 
 * v1.1.3: Added advisory disclaimer for confidence scores
 * v1.1.2: Defensive null checks in createMetadataSection
 *   - Fixes "Cannot read properties of undefined (reading 'level')" in section builder
 *   - Extracts all metadata fields with safe defaults at function start
 *   - Handles missing dataQuality, citations, disclaimer gracefully
 * 
 * v1.1.1: Defensive null checks in createMetadataBadge
 *   - Fixes "Cannot read properties of undefined (reading 'level')" error
 *   - Gracefully handles missing metadata.dataQuality
 *   - Returns empty array if metadata is null/undefined
 * 
 * v1.1.0: Added engine confidence harvesting
 *   - Pulls _meta.confidence from computed engine results
 *   - Includes per-engine confidence in export metadata
 *   - Factors engine confidence into overall quality score
 *   - Adds low-confidence engine warnings to issues list
 * 
 * @author Gilba Solutions
 * @version 1.1.2
 * =============================================================================
 */

(function(global) {
    'use strict';

    const METADATA_VERSION = '1.1.2';

    // =========================================================================
    // EXPORT METADATA GENERATION
    // =========================================================================

    /**
     * Determine which engines were used based on collected data
     * @param {object} data - Data from GAIP_WordExport.collectData()
     * @returns {array} List of engine IDs
     */
    function detectEnginesUsed(data) {
        const engines = ['hub-orchestrator']; // Always present

        if (data.soil) engines.push('mlsn-calculator');
        if (data.tissue) engines.push('nutrient-demand-engine');
        if (data.water) engines.push('water-quality');
        if (data.climate) engines.push('climate-engine');
        if (data.disease) engines.push('disease-engine');
        if (data.pgr) engines.push('pgr-module');
        if (data.shade) engines.push('shade-engine');
        if (data.dew) engines.push('dew-prediction-engine');
        if (data.wear) engines.push('wear-recovery-engine');
        if (data.irrigation) engines.push('irrigation-scheduler');
        if (data.stress) engines.push('stress-trajectory-engine');
        if (data.variety) engines.push('variety-traits');
        
        // Check for Bipolaris models
        if (data.disease?.diseases?.some(d => 
            d.disease?.includes('bipolaris') || d.disease?.includes('curvularia') || d.disease?.includes('drechslera')
        )) {
            engines.push('bipolaris-curvularia');
        }

        return engines;
    }

    // =========================================================================
    // ENGINE CONFIDENCE HARVESTING
    // =========================================================================

    /**
     * Map of computed result keys to their display names
     */
    const ENGINE_DISPLAY_NAMES = {
        climate: 'Climate Analysis',
        disease: 'Disease Prediction',
        shade: 'Shade/DLI Analysis',
        dew: 'Dew Prediction',
        soil: 'Soil Analysis',
        tissue: 'Tissue Analysis',
        water: 'Water Quality',
        irrigation: 'Irrigation Scheduling',
        pgr: 'PGR Management',
        wear: 'Wear/Recovery',
        stress: 'Stress Assessment',
        nutrition: 'Nutrition Planning'
    };

    /**
     * Harvest confidence scores from computed engine results
     * Pulls _meta.confidence from GaipOrchestrator.getComputed() or GAIP_STATE
     * @returns {object} { engines: {engineId: {score, level, factors}}, lowest: number, average: number }
     */
    function harvestEngineConfidence() {
        const result = {
            engines: {},
            lowest: 100,
            lowestEngine: null,
            average: 100,
            count: 0,
            warnings: []
        };

        // Try to get computed results from orchestrator
        let computed = null;
        if (global.GaipOrchestrator && typeof global.GaipOrchestrator.getComputed === 'function') {
            computed = global.GaipOrchestrator.getComputed();
        } else if (global.GAIP_STATE?.computed) {
            computed = global.GAIP_STATE.computed;
        }

        if (!computed) {
            return result;
        }

        let totalScore = 0;
        let engineCount = 0;

        // Iterate through computed results looking for _meta.confidence
        Object.keys(computed).forEach(key => {
            const engineResult = computed[key];
            if (!engineResult) return;

            // Check for _meta.confidence
            let confidence = null;
            
            if (engineResult._meta?.confidence) {
                confidence = engineResult._meta.confidence;
            } else if (engineResult.confidence) {
                // Some engines put confidence at top level
                confidence = engineResult.confidence;
            } else if (engineResult._meta?.applicability?.confidence) {
                // Alternative structure
                confidence = engineResult._meta.applicability.confidence;
            }

            if (confidence) {
                // Normalize to score
                let score;
                if (typeof confidence === 'number') {
                    score = confidence;
                } else if (typeof confidence.score === 'number') {
                    score = confidence.score;
                } else if (typeof confidence.level === 'string') {
                    // Convert level to score
                    const levelScores = { high: 90, medium: 70, low: 40, insufficient: 10 };
                    score = levelScores[confidence.level.toLowerCase()] || 50;
                } else {
                    return; // Can't determine score
                }

                result.engines[key] = {
                    score: score,
                    level: confidence.level || (score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'),
                    factors: confidence.factors || [],
                    displayName: ENGINE_DISPLAY_NAMES[key] || key
                };

                totalScore += score;
                engineCount++;

                // Track lowest
                if (score < result.lowest) {
                    result.lowest = score;
                    result.lowestEngine = key;
                }

                // Flag low confidence engines
                if (score < 50) {
                    result.warnings.push({
                        engine: key,
                        displayName: ENGINE_DISPLAY_NAMES[key] || key,
                        score: score,
                        message: `${ENGINE_DISPLAY_NAMES[key] || key} has low confidence (${score}%)`
                    });
                }
            }
        });

        result.count = engineCount;
        result.average = engineCount > 0 ? Math.round(totalScore / engineCount) : 100;

        return result;
    }

    /**
     * Assess overall data quality for export
     * @param {object} data - Collected export data
     * @returns {object} Quality assessment
     */
    function assessDataQuality(data) {
        const issues = [];
        let inputScore = 100;

        // Check for missing critical data (input completeness)
        if (!data.soil?.hasData) {
            issues.push('No soil test data - MLSN recommendations estimated');
            inputScore -= 15;
        }
        
        if (!data.tissue?.hasData) {
            issues.push('No tissue test data - nutrient status inferred from soil');
            inputScore -= 10;
        }
        
        if (!data.water?.hasData) {
            issues.push('No water quality data - irrigation impacts not assessed');
            inputScore -= 10;
        }
        
        if (!data.climate?.temperature && !data.climate?.current) {
            issues.push('No current weather data - using defaults or estimates');
            inputScore -= 20;
        }

        // Check for extrapolated data
        const hasExtrapolated = data.validation?.level === 'extrapolated' ||
            data.nutrientDemand?.validationStatus?.level === 'extrapolated';
        
        if (hasExtrapolated) {
            issues.push('Some calculations extrapolated beyond validated range');
            inputScore -= 10;
        }

        // Check for conflicts
        const contradictions = global.GaipOrchestrator?.getState()?.contradictions;
        if (contradictions?.summary?.critical > 0) {
            issues.push(`${contradictions.summary.critical} critical conflict(s) detected between recommendations`);
            inputScore -= 15;
        }

        // Harvest engine confidence scores
        const engineConfidence = harvestEngineConfidence();
        
        // Add low-confidence engine warnings to issues
        engineConfidence.warnings.forEach(warning => {
            issues.push(warning.message);
        });

        // Calculate overall score: blend input completeness with engine confidence
        // Weight: 40% input completeness, 60% engine confidence (if available)
        let overallScore;
        if (engineConfidence.count > 0) {
            // Use ceiling model: overall cannot exceed lowest engine confidence
            const blendedScore = Math.round(inputScore * 0.4 + engineConfidence.average * 0.6);
            overallScore = Math.min(blendedScore, engineConfidence.lowest + 10); // Allow small buffer above lowest
            
            // Note if a specific engine is capping confidence
            if (engineConfidence.lowest < 60 && engineConfidence.lowestEngine) {
                const cappingEngine = ENGINE_DISPLAY_NAMES[engineConfidence.lowestEngine] || engineConfidence.lowestEngine;
                if (!issues.some(i => i.includes(cappingEngine))) {
                    issues.push(`Confidence capped by ${cappingEngine} (${engineConfidence.lowest}%)`);
                }
            }
        } else {
            // No engine confidence available, use input score only
            overallScore = inputScore;
        }

        overallScore = Math.max(0, Math.min(100, overallScore));

        return {
            score: overallScore,
            level: overallScore >= 80 ? 'high' : overallScore >= 60 ? 'medium' : 'low',
            issues: issues,
            hasExtrapolated: hasExtrapolated,
            hasCriticalConflicts: contradictions?.summary?.critical > 0,
            
            // v1.1.0: Engine confidence details
            engineConfidence: engineConfidence.count > 0 ? {
                engines: engineConfidence.engines,
                lowest: engineConfidence.lowest,
                lowestEngine: engineConfidence.lowestEngine,
                average: engineConfidence.average,
                count: engineConfidence.count
            } : null,
            inputScore: inputScore
        };
    }

    /**
     * Generate full export metadata block
     * @param {object} data - Collected export data
     * @returns {object} Metadata for inclusion in export
     */
    function generateExportMetadata(data) {
        const engines = detectEnginesUsed(data);
        const quality = assessDataQuality(data);
        
        // Get citation registry data if available
        let citations = [];
        let engineVersions = {};
        
        if (global.GilbaCitationRegistry) {
            const registryMeta = global.GilbaCitationRegistry.generateExportMetadata(engines);
            citations = registryMeta.citations;
            engineVersions = registryMeta.engines;
        } else {
            // b35fix315: if PHP inline injection failed, 'unknown' surfaces
            // the deploy issue in the docx footer rather than silently stamping
            // a hardcoded fallback that will drift from reality over time.
            engineVersions = {
                'hub': global.GAIP_HUB_VERSION || 'unknown'
            };
        }

        return {
            generatedAt: new Date().toISOString(),
            hubVersion: global.GAIP_HUB_VERSION || 'unknown',  // b35fix315: visible sentinel instead of hardcoded fallback
            metadataVersion: METADATA_VERSION,
            
            enginesUsed: engines,
            engineVersions: engineVersions,
            
            dataQuality: quality,
            
            // v1.1.0: Per-engine confidence (for optional detailed display)
            engineConfidence: quality.engineConfidence || null,
            
            citations: citations,
            
            disclaimer: generateDisclaimer(quality, data),
            footerText: generateFooterText(engineVersions, quality)
        };
    }

    /**
     * Generate appropriate disclaimer based on data quality and completeness
     * @param {object} quality - Quality assessment
     * @param {object} data - Export data
     * @returns {string}
     */
    function generateDisclaimer(quality, data) {
        let disclaimer = 'DISCLAIMER: ';
        
        disclaimer += 'This report was generated by the Gilba Agronomic Intelligence Hub. ';
        disclaimer += 'Recommendations are based on peer-reviewed research methodologies ';
        disclaimer += 'and should be validated against local conditions and professional judgment. ';
        disclaimer += 'Confidence scores are advisory indicators, not validation gates. ';
        
        if (quality.level === 'low') {
            disclaimer += 'DATA QUALITY NOTICE: This report is based on limited input data. ';
            disclaimer += 'Recommendations should be considered preliminary. ';
        }
        
        // v1.1.0: Note low engine confidence
        if (quality.engineConfidence && quality.engineConfidence.lowest < 50) {
            const lowEngine = ENGINE_DISPLAY_NAMES[quality.engineConfidence.lowestEngine] || quality.engineConfidence.lowestEngine;
            disclaimer += `CONFIDENCE NOTICE: ${lowEngine} analysis has reduced confidence (${quality.engineConfidence.lowest}%) due to data limitations. `;
        }
        
        if (quality.hasExtrapolated) {
            disclaimer += 'Some calculations are extrapolated beyond peer-reviewed validation ranges ';
            disclaimer += 'and should be verified with additional testing. ';
        }
        
        if (quality.hasCriticalConflicts) {
            disclaimer += 'IMPORTANT: Internal conflicts were detected between recommendations. ';
            disclaimer += 'Review the Consistency Checks section carefully. ';
        }
        
        disclaimer += 'Gilba Solutions accepts no liability for agronomic outcomes.';
        
        return disclaimer;
    }

    /**
     * Generate footer text with version info
     * @param {object} versions - Engine versions
     * @param {object} quality - Quality assessment
     * @returns {string}
     */
    function generateFooterText(versions, quality) {
        const date = new Date().toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const versionStr = `Hub v${versions.hub || global.GAIP_HUB_VERSION || 'unknown'}`;  // b35fix315: visible sentinel
        const qualityStr = `Data Quality: ${quality.level.toUpperCase()}`;
        
        return `Generated ${date} | ${versionStr} | ${qualityStr}`;
    }

    // =========================================================================
    // WORD EXPORT INTEGRATION
    // =========================================================================

    /**
     * Create docx elements for metadata section
     * Requires docx library to be loaded
     * @param {object} metadata - Generated metadata
     * @returns {array} Array of docx elements
     */
    function createMetadataSection(metadata) {
        if (typeof docx === 'undefined') {
            console.warn('[ExportMetadata] docx library not loaded');
            return [];
        }

        // Defensive: ensure metadata exists
        if (!metadata) {
            console.warn('[ExportMetadata] createMetadataSection called with null/undefined metadata');
            return [];
        }

        const { Paragraph, TextRun, Table, TableRow, TableCell, 
                BorderStyle, WidthType, ShadingType } = docx;

        const elements = [];

        // Extract values with safe defaults
        const generatedAt = metadata.generatedAt || new Date().toISOString();
        const hubVersion = metadata.hubVersion || 'unknown';
        const dataQuality = metadata.dataQuality || {};
        const qualityLevel = dataQuality.level || 'medium';
        const qualityScore = dataQuality.score ?? 50;
        const qualityIssues = dataQuality.issues || [];
        const citations = metadata.citations || [];
        const disclaimer = metadata.disclaimer || 'This report was generated by the Gilba Agronomic Intelligence Hub.';

        // Section header
        elements.push(new Paragraph({
            spacing: { before: 400, after: 200 },
            children: [
                new TextRun({
                    text: 'Report Metadata',
                    bold: true,
                    size: 24,
                    color: '374151'
                })
            ]
        }));

        // Version info
        elements.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({
                    text: `Generated: ${new Date(generatedAt).toLocaleString()}`,
                    size: 18,
                    color: '6B7280'
                })
            ]
        }));

        elements.push(new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({
                    text: `Hub Version: ${hubVersion}`,
                    size: 18,
                    color: '6B7280'
                })
            ]
        }));

        // Data quality indicator
        const qualityColors = {
            high: { bg: 'D1FAE5', text: '059669' },
            medium: { bg: 'FEF3C7', text: 'D97706' },
            low: { bg: 'FEE2E2', text: 'DC2626' }
        };
        const qc = qualityColors[qualityLevel] || qualityColors.medium;

        elements.push(new Paragraph({
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: 'Data Quality: ',
                    size: 18,
                    color: '374151'
                }),
                new TextRun({
                    text: `${qualityLevel.toUpperCase()} (${qualityScore}%)`,
                    size: 18,
                    bold: true,
                    color: qc.text
                })
            ]
        }));

        // Quality issues if any
        if (qualityIssues.length > 0) {
            elements.push(new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: 'Data Notes:',
                        size: 18,
                        bold: true,
                        color: '374151'
                    })
                ]
            }));

            qualityIssues.forEach(issue => {
                elements.push(new Paragraph({
                    spacing: { after: 50 },
                    children: [
                        new TextRun({
                            text: '• ' + issue,
                            size: 16,
                            color: '6B7280'
                        })
                    ]
                }));
            });
        }

        // Citations section
        if (citations.length > 0) {
            elements.push(new Paragraph({
                spacing: { before: 200, after: 100 },
                children: [
                    new TextRun({
                        text: 'Methodology References:',
                        size: 18,
                        bold: true,
                        color: '374151'
                    })
                ]
            }));

            citations.forEach(citation => {
                elements.push(new Paragraph({
                    spacing: { after: 50 },
                    children: [
                        new TextRun({
                            text: `• ${citation.shortRef}`,
                            size: 16,
                            color: '6B7280'
                        }),
                        citation.year ? new TextRun({
                            text: ` (${citation.year})`,
                            size: 16,
                            color: '9CA3AF'
                        }) : null
                    ].filter(Boolean)
                }));
            });
        }

        // Disclaimer
        elements.push(new Paragraph({
            spacing: { before: 300, after: 200 },
            children: [
                new TextRun({
                    text: disclaimer,
                    size: 16,
                    italics: true,
                    color: '6B7280'
                })
            ]
        }));

        return elements;
    }

    /**
     * Create compact metadata badge for header/summary area
     * @param {object} metadata 
     * @returns {array} docx elements
     */
    function createMetadataBadge(metadata) {
        if (typeof docx === 'undefined') return [];

        const { Paragraph, TextRun } = docx;

        // Defensive: ensure metadata and dataQuality exist
        if (!metadata) {
            console.warn('[ExportMetadata] createMetadataBadge called with null/undefined metadata');
            return [];
        }

        const qualityIcons = { high: '✓', medium: '~', low: '!' };
        const qualityLevel = metadata.dataQuality?.level || 'medium';
        const icon = qualityIcons[qualityLevel] || '~';
        const hubVersion = metadata.hubVersion || 'unknown';
        const generatedAt = metadata.generatedAt || new Date().toISOString();

        return [
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: `${icon} Hub v${hubVersion}`,
                        size: 16,
                        color: '9CA3AF'
                    }),
                    new TextRun({
                        text: ` | Data Quality: ${qualityLevel.toUpperCase()}`,
                        size: 16,
                        color: '9CA3AF'
                    }),
                    new TextRun({
                        text: ` | ${new Date(generatedAt).toLocaleDateString()}`,
                        size: 16,
                        color: '9CA3AF'
                    })
                ]
            })
        ];
    }

    // =========================================================================
    // HOOK INTO WORD EXPORT
    // =========================================================================

    /**
     * Patch GAIP_WordExport to include metadata
     */
    function patchWordExport() {
        if (!global.GAIP_WordExport) {
            console.warn('[ExportMetadata] GAIP_WordExport not found');
            return false;
        }

        // Store original collectData
        const originalCollectData = global.GAIP_WordExport.collectData;

        // Enhanced collectData that adds metadata
        global.GAIP_WordExport.collectData = function() {
            const data = originalCollectData.call(this);
            
            // Generate and attach metadata
            data._exportMetadata = generateExportMetadata(data);
            
            return data;
        };

        // Add metadata helpers to export object
        global.GAIP_WordExport.getMetadata = generateExportMetadata;
        global.GAIP_WordExport.createMetadataSection = createMetadataSection;
        global.GAIP_WordExport.createMetadataBadge = createMetadataBadge;

        return true;
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        // Try to patch word export
        if (global.GAIP_WordExport) {
            patchWordExport();
        } else {
            // Wait for it to load
            const checkInterval = setInterval(() => {
                if (global.GAIP_WordExport) {
                    clearInterval(checkInterval);
                    patchWordExport();
                }
            }, 100);
            
            // Give up after 5 seconds
            setTimeout(() => clearInterval(checkInterval), 5000);
        }
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaExportMetadata = {
        version: METADATA_VERSION,
        
        // Core functions
        generateExportMetadata: generateExportMetadata,
        assessDataQuality: assessDataQuality,
        detectEnginesUsed: detectEnginesUsed,
        
        // v1.1.0: Engine confidence harvesting
        harvestEngineConfidence: harvestEngineConfidence,
        
        // Disclaimer generation
        generateDisclaimer: generateDisclaimer,
        generateFooterText: generateFooterText,
        
        // docx integration
        createMetadataSection: createMetadataSection,
        createMetadataBadge: createMetadataBadge,
        
        // Patching
        patchWordExport: patchWordExport
    };

    // Initialize
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }


})(typeof window !== 'undefined' ? window : this);
