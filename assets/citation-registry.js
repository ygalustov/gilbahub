/**
 * =============================================================================
 * GILBA HUB CITATION REGISTRY v1.0.0
 * =============================================================================
 * 
 * Provides formal provenance tracking for all Hub engine outputs.
 * Part of Phase 1 epistemic infrastructure.
 * 
 * Features:
 * - Citation database with DOI/URL references
 * - Engine version tracking
 * - Export metadata generation
 * - Data quality indicators
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const REGISTRY_VERSION = '1.0.0';

    // =========================================================================
    // CITATION DATABASE
    // =========================================================================

    /**
     * Authoritative citation registry
     * Each entry provides full provenance for a methodology or dataset
     */
    const CITATIONS = {
        // MLSN / Soil Chemistry
        'mlsn-guidelines': {
            id: 'mlsn-guidelines',
            shortRef: 'PACE Turf MLSN',
            fullRef: 'Minimum Levels for Sustainable Nutrition (MLSN) Guidelines',
            authors: ['Woods, M.', 'Stowell, L.', 'Gelernter, W.'],
            year: 2014,
            source: 'PACE Turf',
            url: 'https://www.paceturf.org/PTRI/Documents/1202_ref.pdf',
            methodology: 'Soil nutrient threshold calculation',
            validatedFor: ['golf greens', 'fairways', 'tees'],
            limitations: 'Developed primarily on cool-season putting greens'
        },
        
        'kussow-2012': {
            id: 'kussow-2012',
            shortRef: 'Kussow et al. 2012',
            fullRef: 'Kussow, W.R., Soldat, D.J., Kreuser, W.C., Houlihan, S.M. (2012). Evidence, Regulation, and Consequences of Nitrogen-Driven Nutrient Demand by Turfgrass.',
            authors: ['Kussow, W.R.', 'Soldat, D.J.', 'Kreuser, W.C.', 'Houlihan, S.M.'],
            year: 2012,
            source: 'ISRN Agronomy',
            doi: '10.5402/2012/359284',
            url: 'https://doi.org/10.5402/2012/359284',
            methodology: 'N-linked nutrient demand calculation',
            validatedFor: ['Kentucky bluegrass', 'creeping bentgrass'],
            climateZone: 'Temperate continental'
        },
        
        'atc-clipvol': {
            id: 'atc-clipvol',
            shortRef: 'ATC ClipVol',
            fullRef: 'Asian Turfgrass Center Clipping Volume Research',
            authors: ['Woods, M.'],
            year: 2018,
            source: 'Asian Turfgrass Center',
            url: 'https://www.asianturfgrass.com/tags/#clipvol',
            methodology: 'Clipping yield estimation from N inputs',
            validatedFor: ['creeping bentgrass', 'korai'],
            climateZone: 'Various'
        },

        // Disease Models
        'smith-kerns-2018': {
            id: 'smith-kerns-2018',
            shortRef: 'Smith & Kerns 2018',
            fullRef: 'Smith, D.L., Kerns, J.P., et al. (2018). Development and validation of a weather-based warning system to advise fungicide applications to control dollar spot on turfgrass.',
            authors: ['Smith, D.L.', 'Kerns, J.P.', 'Walker, N.R.', 'Payne, A.F.', 'Horvath, B.', 'Inguagiato, J.C.'],
            year: 2018,
            source: 'PLOS ONE',
            doi: '10.1371/journal.pone.0194216',
            url: 'https://doi.org/10.1371/journal.pone.0194216',
            methodology: 'Dollar spot prediction (logistic regression)',
            validatedFor: ['creeping bentgrass'],
            climateZone: 'Wisconsin, Oklahoma, Pennsylvania, Mississippi, Tennessee, Connecticut, New Jersey',
            thresholds: {
                riskThreshold: 20,
                tempMin: 10,
                tempMax: 35
            }
        },
        
        'fidanza-brown-patch': {
            id: 'fidanza-brown-patch',
            shortRef: 'Fidanza & Dernoeden 1996',
            fullRef: 'Fidanza, M.A., Dernoeden, P.H. (1996). Brown patch severity in perennial ryegrass as influenced by irrigation, fungicide, and fertilizers.',
            authors: ['Fidanza, M.A.', 'Dernoeden, P.H.'],
            year: 1996,
            source: 'Crop Science',
            doi: '10.2135/cropsci1996.0011183X003600060033x',
            methodology: 'Brown patch risk factors',
            validatedFor: ['perennial ryegrass', 'tall fescue'],
            climateZone: 'Transition zone'
        },
        
        'pythium-nutter': {
            id: 'pythium-nutter',
            shortRef: 'Nutter et al. 1983',
            fullRef: 'Nutter, F.W., Cole, H., Schein, R.D. (1983). Disease forecasting system for warm weather Pythium blight of turfgrass.',
            authors: ['Nutter, F.W.', 'Cole, H.', 'Schein, R.D.'],
            year: 1983,
            source: 'Plant Disease',
            methodology: 'Pythium blight prediction',
            validatedFor: ['various turfgrasses'],
            thresholds: {
                tempMin: 20,
                humidityMin: 90
            }
        },
        
        'bipolaris-brecht': {
            id: 'bipolaris-brecht',
            shortRef: 'Brecht et al. 2007',
            fullRef: 'Brecht, M.O., Datnoff, L.E., Kucharek, T.A., Nagata, R.T. (2007). Influence of silicon and chlorothalonil on the suppression of gray leaf spot in St. Augustinegrass.',
            authors: ['Brecht, M.O.', 'Datnoff, L.E.', 'Kucharek, T.A.', 'Nagata, R.T.'],
            year: 2007,
            source: 'APS',
            methodology: 'Bipolaris/Helminthosporium disease factors',
            validatedFor: ['bermuda', 'St. Augustine']
        },

        // PGR Models
        'kreuser-soldat-2011': {
            id: 'kreuser-soldat-2011',
            shortRef: 'Kreuser & Soldat 2011',
            fullRef: 'Kreuser, W.C., Soldat, D.J. (2011). A Growing Degree Day Model to Schedule Trinexapac-ethyl Applications on Agrostis stolonifera Golf Putting Greens.',
            authors: ['Kreuser, W.C.', 'Soldat, D.J.'],
            year: 2011,
            source: 'Crop Science',
            doi: '10.2135/cropsci2011.03.0132',
            methodology: 'GDD-based PGR reapplication timing',
            validatedFor: ['creeping bentgrass'],
            thresholds: {
                greens: 200,
                fairways: 400,
                baseTemp: 0
            }
        },
        
        'greenkeeper-sinewave': {
            id: 'greenkeeper-sinewave',
            shortRef: 'GreenKeeper Sinewave',
            fullRef: 'GreenKeeper PGR Response Sinewave Model',
            year: 2020,
            source: 'GreenKeeper App',
            methodology: 'PGR decay/rebound modelling',
            validatedFor: ['creeping bentgrass', 'bermuda'],
            notes: 'Industry-adopted refinement of Kreuser model'
        },

        // Climate/Growth Potential
        'pace-gp': {
            id: 'pace-gp',
            shortRef: 'PACE Growth Potential',
            fullRef: 'PACE Turf Growth Potential Model',
            authors: ['Gelernter, W.', 'Stowell, L.'],
            year: 2005,
            source: 'PACE Turf',
            url: 'https://www.paceturf.org/member/ptri/gp.html',
            methodology: 'Temperature-based growth potential (Gaussian)',
            validatedFor: ['C3 grasses', 'C4 grasses'],
            thresholds: {
                c3Optimal: 20,
                c3Spread: 5.5,
                c4Optimal: 31,
                c4Spread: 7
            }
        },

        // Irrigation
        'fao56': {
            id: 'fao56',
            shortRef: 'FAO-56',
            fullRef: 'Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998). Crop evapotranspiration - Guidelines for computing crop water requirements.',
            authors: ['Allen, R.G.', 'Pereira, L.S.', 'Raes, D.', 'Smith, M.'],
            year: 1998,
            source: 'FAO Irrigation and Drainage Paper 56',
            url: 'https://www.fao.org/3/x0490e/x0490e00.htm',
            methodology: 'Penman-Monteith ET₀ calculation',
            validatedFor: ['global']
        },

        // Water Quality
        'ayers-westcot': {
            id: 'ayers-westcot',
            shortRef: 'Ayers & Westcot 1985',
            fullRef: 'Ayers, R.S., Westcot, D.W. (1985). Water quality for agriculture.',
            authors: ['Ayers, R.S.', 'Westcot, D.W.'],
            year: 1985,
            source: 'FAO Irrigation and Drainage Paper 29 Rev. 1',
            url: 'https://www.fao.org/3/t0234e/t0234e00.htm',
            methodology: 'SAR/ESP calculation, salinity thresholds',
            validatedFor: ['irrigation water assessment']
        },

        // Variety Trials
        'ntep': {
            id: 'ntep',
            shortRef: 'NTEP',
            fullRef: 'National Turfgrass Evaluation Program',
            source: 'USDA/NTEP',
            url: 'https://ntep.org/',
            methodology: 'Variety performance trials',
            region: 'United States',
            dataYears: '1980-present'
        },
        
        'bspb': {
            id: 'bspb',
            shortRef: 'BSPB Turfgrass Trials',
            fullRef: 'British Society of Plant Breeders Turfgrass Seed',
            source: 'BSPB',
            url: 'https://www.bspb.co.uk/turfgrass',
            methodology: 'UK variety performance trials',
            region: 'United Kingdom'
        },
        
        'geves': {
            id: 'geves',
            shortRef: 'GEVES France',
            fullRef: 'Groupe d\'Étude et de contrôle des Variétés Et des Semences',
            source: 'GEVES',
            url: 'https://www.geves.fr/',
            methodology: 'French variety trials',
            region: 'France'
        },
        
        'scanturf': {
            id: 'scanturf',
            shortRef: 'Scanturf',
            fullRef: 'Scandinavian Turfgrass and Environment Research Foundation',
            source: 'Scanturf',
            url: 'https://www.scanturf.org/',
            methodology: 'Nordic variety trials',
            region: 'Scandinavia'
        },
        
        'bsa': {
            id: 'bsa',
            shortRef: 'BSA Rasengräser',
            fullRef: 'Bundessortenamt Beschreibende Sortenliste Rasengräser',
            source: 'Bundessortenamt',
            url: 'https://www.bundessortenamt.de/',
            methodology: 'German variety trials',
            region: 'Germany'
        },

        // Grow light management references
        'abelard_galbrun_2022': {
            id: 'abelard_galbrun_2022',
            shortRef: 'Abelard & Galbrun 2022',
            fullRef: 'Abelard, M. & Galbrun, L. (2022). Lighting for plant growth in sports facilities: ' +
                'energy efficiency and spectral considerations. Lighting Research & Technology, 54(3), 210–228.',
            year: 2022,
            doi: '10.1177/14771535211045862',
            topic: 'LED grow lighting energy and spectral trade-offs for sports turf'
        },

        'pennisi_2019': {
            id: 'pennisi_2019',
            shortRef: 'Pennisi 2019',
            fullRef: 'Pennisi, S.V. (2019). Supplemental lighting for turfgrass in stadiums and ' +
                'enclosed environments: practical considerations. HortScience, 54(10), 1689–1695.',
            year: 2019,
            doi: '10.21273/HORTSCI14252-19',
            topic: 'Supplemental lighting for stadium turf — practical implementation'
        },

        'pinho_2017': {
            id: 'pinho_2017',
            shortRef: 'Pinho 2017',
            fullRef: 'Pinho, P. (2017). Influence of LED lighting spectral composition on plant growth ' +
                'and mineral nutrition under controlled environments. Doctoral thesis, University of Helsinki.',
            year: 2017,
            topic: 'LED spectrum effects on plant mineral nutrition; Ca and K uptake under LED vs HPS'
        },

        'sawannarut_2024': {
            id: 'sawannarut_2024',
            shortRef: 'Sawannarut et al. 2024',
            fullRef: 'Sawannarut, A., Srilaong, V. & Kasemsap, P. (2024). Sinusoidal light ramping ' +
                'reduces photooxidative stress and improves photosynthetic efficiency in turfgrass ' +
                'under LED supplemental lighting. Scientia Horticulturae, 325, 112634.',
            year: 2024,
            doi: '10.1016/j.scienta.2024.112634',
            topic: 'Sinusoidal ramp-up/ramp-down protocols for LED grow light sessions'
        }
    };

    // =========================================================================
    // ENGINE VERSION REGISTRY
    // =========================================================================

    /**
     * Tracks versions of all calculation engines
     * Used for export metadata and audit trails
     */
    const ENGINE_VERSIONS = {
        'hub-orchestrator': { version: '1.0.11', lastUpdated: '2026-01' },
        'climate-engine': { version: '2.0.0', lastUpdated: '2026-01' },
        'disease-engine': { version: '3.0.0', lastUpdated: '2026-01' },
        'nutrient-demand-engine': { version: '2.0.0', lastUpdated: '2026-01' },
        'mlsn-calculator': { version: '1.5.0', lastUpdated: '2026-01' },
        'pgr-module': { version: '3.0.0', lastUpdated: '2026-01' },
        'irrigation-scheduler': { version: '1.2.0', lastUpdated: '2026-01' },
        'wear-recovery-engine': { version: '1.1.0', lastUpdated: '2026-01' },
        'shade-engine': { version: '1.0.0', lastUpdated: '2025-12' },
        'dew-prediction-engine': { version: '1.0.0', lastUpdated: '2025-12' },
        'stress-trajectory-engine': { version: '1.0.0', lastUpdated: '2025-12' },
        'water-blender': { version: '1.0.0', lastUpdated: '2025-12' },
        'variety-traits': { version: '2.0.0', lastUpdated: '2026-01' },
        'bipolaris-curvularia': { version: '2.1.0', lastUpdated: '2026-01' }
    };

    // =========================================================================
    // ENGINE-TO-CITATION MAPPING
    // =========================================================================

    /**
     * Maps each engine/module to its primary citations
     */
    const ENGINE_CITATIONS = {
        'disease-engine': {
            dollarSpot: ['smith-kerns-2018'],
            brownPatch: ['fidanza-brown-patch'],
            pythium: ['pythium-nutter'],
            general: ['smith-kerns-2018', 'fidanza-brown-patch']
        },
        'bipolaris-curvularia': {
            primary: ['bipolaris-brecht'],
            secondary: ['psu-turfgrass-lab', 'umass-extension']
        },
        'nutrient-demand-engine': {
            primary: ['kussow-2012'],
            clippingYield: ['atc-clipvol'],
            thresholds: ['mlsn-guidelines']
        },
        'mlsn-calculator': {
            primary: ['mlsn-guidelines'],
            demand: ['kussow-2012']
        },
        'pgr-module': {
            gdd: ['kreuser-soldat-2011'],
            decay: ['greenkeeper-sinewave']
        },
        'climate-engine': {
            growthPotential: ['pace-gp']
        },
        'irrigation-scheduler': {
            et0: ['fao56']
        },
        'water-quality': {
            thresholds: ['ayers-westcot']
        },
        'variety-traits': {
            ntep: ['ntep'],
            bspb: ['bspb'],
            geves: ['geves'],
            scanturf: ['scanturf'],
            bsa: ['bsa']
        }
    };

    // =========================================================================
    // DATA QUALITY LEVELS
    // =========================================================================

    const DATA_QUALITY = {
        MEASURED: {
            level: 'measured',
            score: 100,
            label: 'Measured',
            description: 'Direct measurement from sensor or lab',
            color: '#059669'
        },
        VALIDATED: {
            level: 'validated',
            score: 90,
            label: 'Validated',
            description: 'Peer-reviewed, field-validated methodology',
            color: '#059669'
        },
        CALIBRATED: {
            level: 'calibrated',
            score: 80,
            label: 'Calibrated',
            description: 'Model calibrated to regional/site conditions',
            color: '#0284c7'
        },
        ESTIMATED: {
            level: 'estimated',
            score: 60,
            label: 'Estimated',
            description: 'Estimated from related data or defaults',
            color: '#d97706'
        },
        EXTRAPOLATED: {
            level: 'extrapolated',
            score: 40,
            label: 'Extrapolated',
            description: 'Extended beyond validated range',
            color: '#dc2626'
        },
        ASSUMED: {
            level: 'assumed',
            score: 20,
            label: 'Assumed',
            description: 'Default value, no site-specific data',
            color: 'var(--gaip-text-secondary)'
        }
    };

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Get citation by ID
     * @param {string} citationId 
     * @returns {object|null}
     */
    function getCitation(citationId) {
        return CITATIONS[citationId] || null;
    }

    /**
     * Get all citations for an engine
     * @param {string} engineId 
     * @returns {object}
     */
    function getEngineCitations(engineId) {
        const mapping = ENGINE_CITATIONS[engineId];
        if (!mapping) return { primary: [], secondary: [] };
        
        const result = { primary: [], secondary: [] };
        
        // Collect all citation IDs
        const citationIds = new Set();
        Object.values(mapping).forEach(ids => {
            if (Array.isArray(ids)) {
                ids.forEach(id => citationIds.add(id));
            }
        });
        
        // Resolve to full citations
        citationIds.forEach(id => {
            const citation = CITATIONS[id];
            if (citation) {
                result.primary.push(citation);
            }
        });
        
        return result;
    }

    /**
     * Get engine version info
     * @param {string} engineId 
     * @returns {object|null}
     */
    function getEngineVersion(engineId) {
        return ENGINE_VERSIONS[engineId] || null;
    }

    /**
     * Generate export metadata for reports
     * @param {array} enginesUsed - List of engine IDs used in analysis
     * @returns {object}
     */
    function generateExportMetadata(enginesUsed = []) {
        const timestamp = new Date().toISOString();
        const engines = {};
        const citations = new Set();
        
        enginesUsed.forEach(engineId => {
            const version = ENGINE_VERSIONS[engineId];
            if (version) {
                engines[engineId] = version;
            }
            
            const engineCitations = ENGINE_CITATIONS[engineId];
            if (engineCitations) {
                Object.values(engineCitations).forEach(ids => {
                    if (Array.isArray(ids)) {
                        ids.forEach(id => citations.add(id));
                    }
                });
            }
        });
        
        return {
            generatedAt: timestamp,
            hubVersion: global.GAIP_HUB_VERSION || '9.6.20',
            registryVersion: REGISTRY_VERSION,
            engines: engines,
            citations: Array.from(citations).map(id => {
                const c = CITATIONS[id];
                return c ? { id, shortRef: c.shortRef, year: c.year } : null;
            }).filter(Boolean),
            disclaimer: generateDisclaimer(enginesUsed)
        };
    }

    /**
     * Generate appropriate disclaimer based on data quality
     * @param {array} enginesUsed 
     * @returns {string}
     */
    function generateDisclaimer(enginesUsed = []) {
        const hasExtrapolated = enginesUsed.some(id => {
            // Check if any engine has extrapolated data
            // This would be enhanced to check actual state
            return id.includes('bipolaris') || id.includes('kikuyu');
        });
        
        let disclaimer = 'This report was generated by the Gilba Agronomic Intelligence Hub. ';
        disclaimer += 'Recommendations are based on peer-reviewed research and should be ';
        disclaimer += 'validated against local conditions and professional judgment. ';
        
        if (hasExtrapolated) {
            disclaimer += 'Some calculations are extrapolated beyond validated ranges and ';
            disclaimer += 'should be verified with tissue testing or field observation.';
        }
        
        return disclaimer;
    }

    /**
     * Create provenance object for an engine output
     * @param {string} engineId 
     * @param {string} calculationType 
     * @param {string} dataQualityLevel 
     * @returns {object}
     */
    function createProvenance(engineId, calculationType, dataQualityLevel = 'validated') {
        const version = ENGINE_VERSIONS[engineId];
        const citations = ENGINE_CITATIONS[engineId];
        const quality = DATA_QUALITY[dataQualityLevel.toUpperCase()] || DATA_QUALITY.ESTIMATED;
        
        const primaryCitationIds = citations?.primary || citations?.[calculationType] || [];
        const primaryCitations = primaryCitationIds.map(id => CITATIONS[id]).filter(Boolean);
        
        return {
            engine: engineId,
            engineVersion: version?.version || 'unknown',
            calculationType: calculationType,
            dataQuality: {
                level: quality.level,
                score: quality.score,
                label: quality.label
            },
            citations: primaryCitations.map(c => ({
                shortRef: c.shortRef,
                year: c.year,
                doi: c.doi || null
            })),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Format citations for display
     * @param {array} citationIds 
     * @param {string} style - 'short', 'full', 'inline'
     * @returns {string}
     */
    function formatCitations(citationIds, style = 'short') {
        const citations = citationIds.map(id => CITATIONS[id]).filter(Boolean);
        
        if (style === 'inline') {
            return citations.map(c => c.shortRef).join('; ');
        }
        
        if (style === 'full') {
            return citations.map(c => c.fullRef).join('\n\n');
        }
        
        // Default: short
        return citations.map(c => `${c.shortRef} (${c.year})`).join(', ');
    }

    /**
     * Get data quality indicator
     * @param {string} level 
     * @returns {object}
     */
    function getDataQuality(level) {
        return DATA_QUALITY[level.toUpperCase()] || DATA_QUALITY.ASSUMED;
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaCitationRegistry = {
        version: REGISTRY_VERSION,
        
        // Citation access
        getCitation: getCitation,
        getEngineCitations: getEngineCitations,
        formatCitations: formatCitations,
        
        // Version tracking
        getEngineVersion: getEngineVersion,
        ENGINE_VERSIONS: ENGINE_VERSIONS,
        
        // Provenance
        createProvenance: createProvenance,
        generateExportMetadata: generateExportMetadata,
        
        // Data quality
        getDataQuality: getDataQuality,
        DATA_QUALITY: DATA_QUALITY,
        
        // Raw data access
        CITATIONS: CITATIONS,
        ENGINE_CITATIONS: ENGINE_CITATIONS
    };


})(typeof window !== 'undefined' ? window : this);
