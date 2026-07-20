/**
 * Unified Fungicide Filter Service
 * =================================
 * 
 * Central gatekeeper for jurisdiction-safe fungicide recommendations.
 * Routes to correct regional database based on user location.
 * 
 * Version: 1.0.0
 * 
 * Dependencies:
 *   - regional-profiles.js (for region detection)
 *   - nz-fungicides.js (NZ ACVM database)
 *   - extended-regional-fungicides.js (Nordic + Japan)
 *   - european-regional-fungicides.js (FR, ES, DE)
 *   - au-fungicides.js (Australia APVMA - if exists)
 *   - uk-fungicides.js (UK - if exists)
 */

(function() {
    'use strict';

    // ========================================================================
    // REGION TO DATABASE MAPPING
    // ========================================================================

    /**
     * Maps detected regions to their fungicide database configuration.
     * 
     * Each region specifies:
     *   - countries: Array of country codes for multi-country regions
     *   - dbType: Which database module to query
     *   - registrationBody: Regulatory authority name
     */
    const REGION_TO_FUNGICIDE_DB = {
        // Australia & New Zealand - NOW SEPARATE
        'australia': {
            countries: ['AU'],
            dbType: 'au',
            registrationBody: 'APVMA'
        },
        'new_zealand': {
            countries: ['NZ'],
            dbType: 'nz',
            registrationBody: 'ACVM/MPI'
        },
        // Legacy combined region - route based on coordinates
        'australia_nz': {
            countries: ['AU', 'NZ'],
            dbType: 'au_nz',  // Special handling required
            registrationBody: 'APVMA/ACVM'
        },

        // UK & Ireland
        'uk_ireland': {
            countries: ['GB', 'UK', 'IE'],
            dbType: 'uk',
            registrationBody: 'HSE/CRD'
        },

        // Scandinavia
        'scandinavia': {
            countries: ['SE', 'DK', 'NO'],
            dbType: 'extended',
            registrationBody: 'National authorities'
        },

        // Nordic + Finland
        'nordic': {
            countries: ['SE', 'DK', 'NO', 'FI'],
            dbType: 'extended',
            registrationBody: 'National authorities'
        },

        // Japan
        'japan': {
            countries: ['JP'],
            dbType: 'extended',
            registrationBody: 'MAFF'
        },

        // Germany
        'germany': {
            countries: ['DE'],
            dbType: 'european',
            registrationBody: 'BVL'
        },

        // France
        'france': {
            countries: ['FR'],
            dbType: 'european',
            registrationBody: 'ANSES'
        },

        // Spain
        'spain': {
            countries: ['ES'],
            dbType: 'european',
            registrationBody: 'MAPA'
        },

        // Continental Europe (general)
        'continental_europe': {
            countries: ['FR', 'DE', 'NL', 'BE'],
            dbType: 'european',
            registrationBody: 'EU/National'
        },

        // Mediterranean
        'mediterranean': {
            countries: ['ES', 'IT', 'PT', 'GR'],
            dbType: 'european',
            registrationBody: 'EU/National'
        },

        // USA regions
        'us_north': {
            countries: ['US'],
            dbType: 'us',
            registrationBody: 'EPA'
        },
        'us_transition': {
            countries: ['US'],
            dbType: 'us',
            registrationBody: 'EPA'
        },
        'us_south': {
            countries: ['US'],
            dbType: 'us',
            registrationBody: 'EPA'
        }
    };

    // ========================================================================
    // DISEASE NAME NORMALIZATION
    // ========================================================================

    const DISEASE_ALIASES = {
        // Fusarium / Microdochium
        'fusarium': 'microdochium_patch',
        'fusarium_patch': 'microdochium_patch',
        'pink_snow_mold': 'microdochium_patch',
        'microdochium': 'microdochium_patch',
        
        // Dollar spot
        'dollarspot': 'dollar_spot',
        'sclerotinia_homoeocarpa': 'dollar_spot',
        
        // Brown patch
        'brownpatch': 'brown_patch',
        'rhizoctonia': 'brown_patch',
        'rhizoctonia_solani': 'brown_patch',
        
        // Anthracnose
        'colletotrichum': 'anthracnose',
        'anthracnose_foliar': 'anthracnose',
        'anthracnose_basal': 'anthracnose',
        
        // Take-all
        'take_all': 'take_all_patch',
        'takeall': 'take_all_patch',
        'gaeumannomyces': 'take_all_patch',
        
        // Pythium
        'pythium': 'pythium_blight',
        'pythium_root_rot': 'pythium_blight',
        
        // Fairy ring
        'fairyring': 'fairy_ring',
        'fairy_rings': 'fairy_ring',
        
        // Red thread
        'redthread': 'red_thread',
        'laetisaria': 'red_thread',
        
        // Leaf spot complex
        'bipolaris': 'leaf_spot',
        'drechslera': 'leaf_spot',
        'helminthosporium': 'leaf_spot',
        
        // Spring dead spot
        'sds': 'spring_dead_spot',
        'ophiosphaerella': 'spring_dead_spot',
        
        // Grey leaf spot
        'gray_leaf_spot': 'grey_leaf_spot',
        'pyricularia': 'grey_leaf_spot',
        'magnaporthe': 'grey_leaf_spot'
    };

    /**
     * Normalise a raw actives array from any regional DB to the canonical shape:
     *   { activeIngredient, fracGroup, type, registration, ... }
     * Handles DBs that return 'active' instead of 'activeIngredient',
     * 'frac' instead of 'fracGroup', and registration as an object instead of string.
     */
    function normaliseActives(actives) {
        if (!Array.isArray(actives)) return [];
        return actives.map(a => {
            const out = Object.assign({}, a);
            // activeIngredient takes priority; fall back to active
            if (!out.activeIngredient && out.active) {
                out.activeIngredient = out.active;
            }
            // fracGroup takes priority; fall back to frac
            if (!out.fracGroup && out.frac !== undefined) {
                out.fracGroup = String(out.frac);
            }
            // registration may be an object { body, status } — flatten to string
            if (out.registration && typeof out.registration === 'object') {
                out.registration = out.registration.body || out.registration.status || 'Registered';
            }
            return out;
        });
    }

    function normalizeDiseaseName(disease) {
        if (!disease) return null;
        // Convert camelCase to snake_case first (engine uses camelCase internally)
        // e.g. 'dollarSpot' → 'dollar_spot', 'brownPatch' → 'brown_patch'
        const snake = disease.replace(/([A-Z])/g, '_$1').toLowerCase();
        const key = snake.replace(/[\s-]+/g, '_').trim();
        return DISEASE_ALIASES[key] || DISEASE_ALIASES[disease.toLowerCase()] || key;
    }

    // ========================================================================
    // REGION DETECTION HELPERS
    // ========================================================================

    /**
     * Detect region from coordinates
     * Enhanced version that separates AU and NZ
     */
    function detectRegionFromCoords(lat, lon) {
        if (lat === undefined || lon === undefined) return null;

        // New Zealand (lon > 165, southern hemisphere)
        if (lat < 0 && lon > 165 && lon < 180) {
            return 'new_zealand';
        }

        // Australia (lon 110-165, southern hemisphere)
        if (lat < 0 && lon > 110 && lon <= 165) {
            return 'australia';
        }

        // Japan
        if (lat > 24 && lat < 46 && lon > 123 && lon < 146) {
            return 'japan';
        }

        // Europe detection
        if (lat > 35 && lat < 72 && lon > -12 && lon < 45) {
            // UK/Ireland — lon > -11 covers Ireland (Dublin -6.3, Belfast -5.9) through
            // to east England; lat 49.9-61.1 covers Scilly Isles to Shetland.
            // Previous bound (lon < 2) excluded Manchester (-2.2), Edinburgh (-3.2),
            // Cardiff (-3.2), Belfast (-5.9), Dublin (-6.3) — all now correctly included.
            if (lon > -11 && lon < 2 && lat > 49.9 && lat < 61.1) {
                return 'uk_ireland';
            }
            // Scandinavia
            if (lat > 55 && lon > 4 && lon < 32) {
                return 'scandinavia';
            }
            // Germany
            if (lat > 47 && lat < 55 && lon > 6 && lon < 15) {
                return 'germany';
            }
            // France
            if (lat > 42 && lat < 51 && lon > -5 && lon < 8) {
                return 'france';
            }
            // Spain
            if (lat > 36 && lat < 44 && lon > -9 && lon < 4) {
                return 'spain';
            }
            return 'continental_europe';
        }

        // USA
        if (lat > 24 && lat < 72 && lon > -170 && lon < -50) {
            if (lat > 40) return 'us_north';
            if (lat > 33) return 'us_transition';
            return 'us_south';
        }

        return null;
    }

    /**
     * Get current region from hub state or regional profiles
     */
    function getCurrentRegion(options = {}) {
        // Option 1: Explicit region passed in
        if (options.region) {
            return options.region;
        }

        // Option 2: Coordinates passed in
        if (options.lat !== undefined && options.lon !== undefined) {
            return detectRegionFromCoords(options.lat, options.lon);
        }

        // Option 3: From GAIP_RegionalProfiles if available
        if (typeof window !== 'undefined' && window.GAIP_RegionalProfiles) {
            const profile = window.GAIP_RegionalProfiles;
            if (profile.getCurrentRegion) {
                return profile.getCurrentRegion();
            }
            if (profile.detectRegionFromHub) {
                return profile.detectRegionFromHub();
            }
        }

        // Option 4: From canonical state
        if (typeof window !== 'undefined' && window.GAIP_CANONICAL_STATE) {
            const state = window.GAIP_CANONICAL_STATE;
            if (state.location?.lat && state.location?.lon) {
                return detectRegionFromCoords(state.location.lat, state.location.lon);
            }
        }

        // Default fallback
        return 'australia';
    }

    // ========================================================================
    // DATABASE QUERY FUNCTIONS
    // ========================================================================

    /**
     * Query NZ fungicide database
     */
    function queryNZDatabase(disease, options = {}) {
        const NZ_DB = (typeof window !== 'undefined' && window.GAIP_NZ_FUNGICIDES) ||
                      (typeof require !== 'undefined' && require('./nz-fungicides.js'));

        if (!NZ_DB) {
            console.warn('[FungicideFilter] NZ fungicide database not loaded');
            return { actives: [], source: 'nz', error: 'Database not loaded' };
        }

        // NZ DB normalises internally (strips underscores, lowercases) so either
        // camelCase or snake_case works. Pass camelCase for consistency with DB targets.
        const camelKey = disease.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const lookupKey = camelKey || normalizeDiseaseName(disease);

        // NZ DB exports getProductsForDisease (flat array), not getActivesForDisease
        const products = NZ_DB.getProductsForDisease
            ? NZ_DB.getProductsForDisease(lookupKey)
            : (NZ_DB.getActivesForDisease ? NZ_DB.getActivesForDisease(lookupKey) : null);

        if (!products) {
            return { actives: [], source: 'nz', error: 'No lookup method available' };
        }

        // getProductsForDisease returns flat array of product objects
        // getActivesForDisease returns { primary, secondary, rotationPartners }
        const actives = [];

        if (Array.isArray(products)) {
            // Flat array from getProductsForDisease — one record per trade name.
            // Deduplicate by active ingredient: keep first occurrence (pre-sorted by efficacy desc).
            const seenAI = new Set();
            products.forEach(p => {
                const ai = p.active || p.trade;
                if (seenAI.has(ai)) return;
                seenAI.add(ai);
                actives.push({
                    activeIngredient: ai,
                    type: 'primary',
                    fracGroup: p.frac ? String(p.frac) : null,
                    registration: 'NZT',
                    rateRange: p.rate || null,
                    interval: p.interval || null,
                    resistanceRisk: p.resistanceRisk || 'unknown',
                    trade: p.trade || null,
                });
            });
        } else {
            // Structured response from getActivesForDisease
            const result = products;
            if (result.primary) {
                result.primary.forEach(a => {
                    actives.push({
                        activeIngredient: a.active,
                        type: 'primary',
                        fracGroup: a.fracGroup,
                        registration: a.registrationNZ,
                        rateRange: a.rateRange,
                        interval: a.interval,
                        resistanceRisk: NZ_DB.FRAC_GROUPS[a.fracGroup]?.risk || 'unknown'
                    });
                });
            }
            if (result.secondary) {
                result.secondary.forEach(a => {
                    actives.push({
                        activeIngredient: a.active,
                        type: 'secondary',
                        fracGroup: a.fracGroup,
                        registration: a.registrationNZ,
                        rateRange: a.rateRange,
                        interval: a.interval,
                        resistanceRisk: NZ_DB.FRAC_GROUPS[a.fracGroup]?.risk || 'unknown'
                    });
                });
            }
            if (result.rotationPartners) {
                result.rotationPartners.forEach(a => {
                    actives.push({
                        activeIngredient: a.active,
                        type: 'rotation',
                        fracGroup: a.fracGroup,
                        registration: a.registrationNZ,
                        resistanceRisk: NZ_DB.FRAC_GROUPS[a.fracGroup]?.risk || 'unknown'
                    });
                });
            }
        }

        // Filter by turf registration if strict mode
        let filtered = actives;
        if (options.turfRegisteredOnly) {
            filtered = actives.filter(a => a.registration === 'NZT');
        }

        return {
            actives: filtered,
            source: 'nz',
            registrationBody: 'ACVM/MPI',
        };
    }

    /**
     * Query AU fungicide database
     * Placeholder - implement when AU database exists
     */
    function queryAUDatabase(disease, options = {}) {
        const AU_DB = (typeof window !== 'undefined' && window.GAIP_AU_FUNGICIDES);

        if (!AU_DB) {
            // Fallback: return generic message
            console.warn('[FungicideFilter] AU fungicide database not loaded');
            return {
                actives: [],
                source: 'au',
                registrationBody: 'APVMA',
                warnings: ['AU fungicide database not available. Consult APVMA PubCRIS for registered products.']
            };
        }

        // AU DB uses camelCase targets internally (dollarSpot, brownPatch etc)
        // Pass raw disease key; AU getActivesForDisease handles it directly
        // Also try camelCase version if snake_case was passed
        const camelKey = disease.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const rawResult = AU_DB.getActivesForDisease(camelKey);
        if (rawResult && rawResult.actives && rawResult.actives.length > 0) {
            return Object.assign({}, rawResult, { actives: normaliseActives(rawResult.actives) });
        }
        // Fallback: try normalised key
        const normalizedDisease = normalizeDiseaseName(disease);
        const fallbackResult = AU_DB.getActivesForDisease(normalizedDisease);
        return Object.assign({}, fallbackResult, { actives: normaliseActives(fallbackResult.actives || []) });
    }

    /**
     * Query UK fungicide database (HSE CRD MAPP register)
     */
    function queryUKDatabase(disease, options = {}) {
        const UK_DB = (typeof window !== 'undefined' && window.GAIP_UK_FUNGICIDES) ||
                      (typeof require !== 'undefined' && (() => {
                          try { return require('./uk-fungicides.js'); } catch(e) { return null; }
                      })());

        if (!UK_DB) {
            console.warn('[FungicideFilter] UK fungicide database not loaded');
            return {
                actives: [],
                source: 'uk',
                registrationBody: 'HSE CRD',
                warnings: ['UK fungicide database not available. Consult HSE Pesticide Register at secure.pesticides.gov.uk/pestreg']
            };
        }

        // UK DB uses camelCase targets internally — pass camelCase key
        const camelKey = disease.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const rawResult = UK_DB.getActivesForDisease(camelKey);
        if (rawResult && rawResult.actives && rawResult.actives.length > 0) {
            return Object.assign({}, rawResult, { actives: normaliseActives(rawResult.actives) });
        }
        const normalizedDisease = normalizeDiseaseName(disease);
        const fallbackResult = UK_DB.getActivesForDisease(normalizedDisease);
        return Object.assign({}, fallbackResult, { actives: normaliseActives(fallbackResult.actives || []) });
    }

    /**
     * Query Extended Regional database (Nordic + Japan)
     */
    function queryExtendedDatabase(disease, countryCode, options = {}) {
        const EXT_DB = (typeof window !== 'undefined' && window.GAIP_ExtendedRegionalFungicides);

        if (!EXT_DB || !EXT_DB.getFungicidesForDisease) {
            return {
                actives: [],
                source: 'extended',
                warnings: ['Extended regional database not loaded']
            };
        }

        const normalizedDisease = normalizeDiseaseName(disease);
        const products = EXT_DB.getFungicidesForDisease(normalizedDisease, countryCode);

        return {
            actives: products.map(p => ({
                activeIngredient: p.activeIngredient || p.active,
                type: 'primary',
                fracGroup: p.frac ? String(p.frac) : (p.fracGroup || null),
                registration: p.registration,
                allowedUses: p.allowedUses
            })),
            source: 'extended',
            countryCode
        };
    }

    /**
     * Query European database (FR, ES, DE)
     */
    function queryEuropeanDatabase(disease, countryCode, options = {}) {
        const EU_DB = (typeof window !== 'undefined' && window.GAIP_EuropeanRegionalFungicides);

        if (!EU_DB || !EU_DB.getEuropeanFungicidesForDisease) {
            return {
                actives: [],
                source: 'european',
                warnings: ['European regional database not loaded']
            };
        }

        const normalizedDisease = normalizeDiseaseName(disease);
        const products = EU_DB.getEuropeanFungicidesForDisease(normalizedDisease, countryCode);

        return {
            actives: products.map(p => ({
                activeIngredient: p.activeIngredient || p.active,
                type: 'primary',
                fracGroup: p.frac ? String(p.frac) : (p.fracGroup || null),
                registration: p.registration,
                allowedUses: p.allowedUses,
                loiLabbe: p.loiLabbe  // France-specific
            })),
            source: 'european',
            countryCode
        };
    }

    // ========================================================================
    // MAIN FILTER FUNCTION
    // ========================================================================

    /**
     * Get approved fungicide actives for a disease in the user's region
     * 
     * @param {string} disease - Disease name (will be normalized)
     * @param {object} options - Optional configuration
     * @param {string} options.region - Override region detection
     * @param {number} options.lat - Latitude for region detection
     * @param {number} options.lon - Longitude for region detection
     * @param {string} options.useType - 'golf', 'sportsfield', 'amenity'
     * @param {boolean} options.turfRegisteredOnly - Only return turf-registered products
     * @param {boolean} options.includeRotationOptions - Include resistance rotation suggestions
     * 
     * @returns {object} Result with actives, warnings, and metadata
     */
    function getApprovedFungicides(disease, options = {}) {
        const region = getCurrentRegion(options);
        const mapping = REGION_TO_FUNGICIDE_DB[region];

        if (!mapping) {
            return {
                actives: [],
                region,
                warnings: [`Unknown region: ${region}. Unable to determine approved fungicides.`],
                suggestion: 'Consult your local regulatory authority for approved products.'
            };
        }

        const useType = options.useType || 'golf';
        let result = { actives: [], warnings: [] };

        // Route to correct database based on dbType
        switch (mapping.dbType) {
            case 'nz':
                result = queryNZDatabase(disease, options);
                break;

            case 'au':
                result = queryAUDatabase(disease, options);
                break;

            case 'au_nz':
                // Legacy combined region - need coordinates to distinguish
                if (options.lon && options.lon > 165) {
                    result = queryNZDatabase(disease, options);
                } else {
                    result = queryAUDatabase(disease, options);
                }
                break;

            case 'extended':
                // Query each country in the region
                const extResults = [];
                mapping.countries.forEach(cc => {
                    const countryResult = queryExtendedDatabase(disease, cc, options);
                    extResults.push(...countryResult.actives.map(a => ({ ...a, countryCode: cc })));
                });
                result = { actives: extResults, source: 'extended' };
                break;

            case 'european':
                const euResults = [];
                mapping.countries.forEach(cc => {
                    const countryResult = queryEuropeanDatabase(disease, cc, options);
                    euResults.push(...countryResult.actives.map(a => ({ ...a, countryCode: cc })));
                });
                result = { actives: euResults, source: 'european' };
                break;

            case 'uk':
                result = queryUKDatabase(disease, options);
                break;

            case 'us':
                // US database - implement when available
                result = {
                    actives: [],
                    source: 'us',
                    warnings: ['US fungicide database not yet implemented. Consult EPA registration.']
                };
                break;

            default:
                result = {
                    actives: [],
                    warnings: [`No database configured for region type: ${mapping.dbType}`]
                };
        }

        // Filter by use type if actives have allowedUses
        if (result.actives.length > 0 && useType) {
            result.actives = result.actives.filter(a => {
                if (!a.allowedUses) return true;  // No restriction
                return a.allowedUses.includes(useType);
            });
        }

        // Add metadata
        result.region = region;
        result.registrationBody = mapping.registrationBody;
        result.disease = normalizeDiseaseName(disease);

        // Warning if no products found
        if (result.actives.length === 0 && !result.warnings?.length) {
            result.warnings = result.warnings || [];
            result.warnings.push(`No registered products found for ${disease} in ${region}.`);
            result.suggestion = `Consult ${mapping.registrationBody} or your local agronomic advisor.`;
        }

        return result;
    }

    // ========================================================================
    // ROTATION RECOMMENDATIONS
    // ========================================================================

    /**
     * Get resistance rotation recommendation
     * 
     * @param {string} currentActive - Active ingredient just used
     * @param {string} disease - Target disease
     * @param {object} options - Region options
     */
    function getRotationRecommendation(currentActive, disease, options = {}) {
        const region = getCurrentRegion(options);
        const mapping = REGION_TO_FUNGICIDE_DB[region];

        // NZ has built-in rotation function
        if (mapping?.dbType === 'nz') {
            const NZ_DB = (typeof window !== 'undefined' && window.GAIP_NZ_FUNGICIDES);
            if (NZ_DB?.getRotationRecommendation) {
                return NZ_DB.getRotationRecommendation(currentActive, normalizeDiseaseName(disease));
            }
        }

        // Generic rotation logic for other regions
        const currentResult = getApprovedFungicides(disease, options);
        const currentData = currentResult.actives.find(a => 
            a.activeIngredient.toLowerCase() === currentActive.toLowerCase()
        );

        if (!currentData) {
            return {
                error: `Active ingredient "${currentActive}" not found in ${region} database`
            };
        }

        const currentGroup = currentData.fracGroup;

        // Find actives in different MOA groups
        const rotationOptions = currentResult.actives.filter(a => 
            a.fracGroup !== currentGroup
        );

        return {
            currentActive,
            currentFracGroup: currentGroup,
            rotationOptions: rotationOptions.map(a => ({
                activeIngredient: a.activeIngredient,
                fracGroup: a.fracGroup,
                type: a.type
            })),
            recommendation: rotationOptions.length > 0
                ? `Rotate to FRAC group ${rotationOptions[0].fracGroup} (${rotationOptions[0].activeIngredient}) for next application.`
                : 'No alternative MOA groups available. Consider tank-mix with multi-site protectant.'
        };
    }

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Check if a specific active is registered in a region for turf
     */
    function isActiveRegistered(active, options = {}) {
        const region = getCurrentRegion(options);
        const mapping = REGION_TO_FUNGICIDE_DB[region];

        if (mapping?.dbType === 'nz') {
            const NZ_DB = (typeof window !== 'undefined' && window.GAIP_NZ_FUNGICIDES);
            if (NZ_DB?.isNZTurfRegistered) {
                return {
                    registered: NZ_DB.isNZTurfRegistered(active),
                    region,
                    registrationBody: 'ACVM/MPI'
                };
            }
        }

        // For other regions, return unknown
        return {
            registered: null,
            region,
            warning: `Unable to verify registration for ${active} in ${region}`
        };
    }

    /**
     * Get all supported regions
     */
    function getSupportedRegions() {
        return Object.keys(REGION_TO_FUNGICIDE_DB).map(key => ({
            id: key,
            ...REGION_TO_FUNGICIDE_DB[key]
        }));
    }

    /**
     * Format fungicide recommendation for display
     */
    function formatRecommendation(result) {
        if (!result || !result.actives || result.actives.length === 0) {
            return {
                html: `<p class="gaip-fungicide-warning">No registered fungicides found. ${result?.suggestion || 'Consult your local advisor.'}</p>`,
                text: `No registered fungicides found. ${result?.suggestion || ''}`
            };
        }

        const primary = result.actives.filter(a => a.type === 'primary');
        const secondary = result.actives.filter(a => a.type === 'secondary');
        const rotation = result.actives.filter(a => a.type === 'rotation');

        let html = '<div class="gaip-fungicide-recommendations">';
        
        if (primary.length > 0) {
            html += '<h4>Primary Options</h4><ul>';
            primary.forEach(a => {
                html += `<li><strong>${a.activeIngredient}</strong> (FRAC ${a.fracGroup}) - ${a.registration || 'Registered'}</li>`;
            });
            html += '</ul>';
        }

        if (secondary.length > 0) {
            html += '<h4>Secondary Options</h4><ul>';
            secondary.forEach(a => {
                html += `<li>${a.activeIngredient} (FRAC ${a.fracGroup})</li>`;
            });
            html += '</ul>';
        }

        if (rotation.length > 0) {
            html += '<h4>Rotation Partners</h4><ul>';
            rotation.forEach(a => {
                html += `<li>${a.activeIngredient} (FRAC ${a.fracGroup}) - ${a.resistanceRisk || ''} resistance risk</li>`;
            });
            html += '</ul>';
        }

        if (result.notes) {
            html += `<p class="gaip-fungicide-notes"><em>${result.notes}</em></p>`;
        }

        html += `<p class="gaip-fungicide-source">Source: ${result.registrationBody} (${result.region})</p>`;
        html += '</div>';

        return { html, actives: result.actives };
    }

    // ========================================================================
    // EXPORTS
    // ========================================================================

    function getMixtureCredit(blockKey, disease, options = {}) {
        const region  = getCurrentRegion(options);
        const dbType  = REGION_TO_FUNGICIDE_DB[region]?.dbType;
        const DB_BY_TYPE = {
            nz:  typeof window !== 'undefined' ? window.GAIP_NZ_FUNGICIDES : null,
            au:  typeof window !== 'undefined' ? window.GAIP_AU_FUNGICIDES : null,
        };
        const DB = DB_BY_TYPE[dbType] || null;
        if (DB?.getMixtureCredit) return DB.getMixtureCredit(blockKey, disease);
        return [];
    }

    const FungicideFilter = {
        // Main API
        getApprovedFungicides,
        getRotationRecommendation,
        getMixtureCredit,
        isActiveRegistered,
        
        // Utilities
        normalizeDiseaseName,
        getCurrentRegion,
        detectRegionFromCoords,
        getSupportedRegions,
        formatRecommendation,

        // Constants
        REGION_TO_FUNGICIDE_DB,
        DISEASE_ALIASES,

        // Version
        version: '1.0.0'
    };

    // Node.js / CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FungicideFilter;
    }

    // Browser / WordPress global
    if (typeof window !== 'undefined') {
        window.GAIP_FungicideFilter = FungicideFilter;
    }

})();
