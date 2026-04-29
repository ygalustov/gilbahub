/**
 * =============================================================================
 * GILBA IDENTITY ENFORCEMENT v1.0.0
 * =============================================================================
 * 
 * Tiered enforcement of primary identity keys across all engines.
 * 
 * TIER 0 (Hard fail): speciesKey - blocks execution if missing
 * TIER 1 (Soft default): surfaceKey, climateRegimeKey, turfIntentKey - allowed
 *                        to default but with explicit tracking and penalties
 * TIER 2 (Output gating): Blocks exports/prescriptions when assumptions are
 *                         medium/high impact
 * 
 * Design principles:
 * - "Unknown" is a valid key that forces conservative engine behaviour
 * - Defaults are contextual and minimally presumptive
 * - All assumptions are surfaced explicitly, never buried
 * - Engines declare their identity requirements and constraints
 * 
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const VERSION = '1.0.0';

    // =========================================================================
    // IDENTITY KEY DEFINITIONS
    // =========================================================================

    /**
     * Primary identity keys and their enforcement tiers
     */
    const IDENTITY_KEYS = {
        speciesKey: {
            tier: 0,  // Hard fail
            required: true,
            validValues: [
                'perennialRyegrass', 'annualRyegrass', 'kentuckyBluegrass',
                'tallFescue', 'fineFescue', 'chewingsFescue', 'creepingRedFescue',
                'creepingBentgrass', 'colonialBentgrass', 'velvetBentgrass',
                'bentgrass', 'browntopBent',
                'couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'seashore',
                'paspalum', 'seashore_paspalum',  // b35fix366: SpeciesController.normalize() emits 'seashore_paspalum' (with underscore). Pre-fix, the array had 'seashore' and 'paspalum' as separate strings — neither matched the canonical form, so paspalum selection produced TIER 0 VIOLATION at setIdentityKey line 297 (validValues.includes('seashore_paspalum') === false). Localised by b35fix365 [b35fix365 disease-inputs-species] diagnostic in production log gilbasolutions_com-1777268462018: SC_getBaseSpecies returned 'seashore_paspalum' correctly but canonical_speciesKey was null because populateCanonicalState early-returned on the TIER 0 fail before reaching its species resolution. Dead-string entries 'seashore' and 'paspalum' (and other never-emitted aliases like 'annualRyegrass', 'creepingBentgrass', 'velvetBentgrass', 'stAugustine', 'centipede', 'bahia') retained as-is — out of scope for this build. The wider asymmetry between IDENTITY_KEYS.speciesKey.validValues and SpeciesController's actual canonical output set is a known fragility (any new species addition must touch both files) — pinned by regression test in tests/identity-validvalues-vs-speciescontroller.test.js.
                'stAugustine', 'centipede', 'bahia',
                'poa', 'poaAnnua', 'poaTrivialis',
                'cotula'  // b35fix389: same pattern as b35fix366 paspalum closure. SpeciesController.normalize('cotula') returns 'cotula' via the DICOT_BYPASS branch (species-controller.js:234); IDENTITY_KEYS.speciesKey.validValues was missing the entry, so setIdentityKey('speciesKey', 'cotula', ...) hit the validValues.includes() check at line 297, returned valid:false, and logged the TIER 0 VIOLATION at line 304. The cotula bypass at line 411 then rescued _identityState.quality.tier0Valid back to true, but setIdentityKey's own return value was still {valid:false} — so downstream identity-gated engines (wear-recovery at hub-orchestrator.js:1063) saw "Missing required identity: speciesKey" and refused to run. Production evidence: gilbasolutions_com-1777418778208.log lines 151/153/178 (X Cotula BC, NZ, AA methodology) — the TIER 0 VIOLATION + bypass + wear engine block triad. Pairs with b35fix388 to fully clear that triad — b35fix388 makes the four cotula state writes (turfType/surfaceType/speciesKey/cotula) actually persist, which lets the intent resolver find the bowls intent (clearing the unknownIntent default at line 154); b35fix389 makes setIdentityKey return valid for the persisted speciesKey (clearing the VIOLATION at line 151 and unblocking the wear engine at line 178).
            ],
            unknownValue: null,  // Not allowed - hard fail
            displayName: 'Grass Species',
            errorMessage: 'Species is required. Please select a grass species to continue.'
        },

        surfaceKey: {
            tier: 1,  // Soft default
            required: false,
            validValues: [
                'sandProfile', 'usga', 'californiaProfile', 'pushUp',
                'nativeSoil', 'sandCap', 'hybrid', 'synthetic',
                'unknownProfile'  // Valid unknown
            ],
            unknownValue: 'unknownProfile',
            defaultValue: 'unknownProfile',
            displayName: 'Rootzone Profile',
            defaultImpact: 'medium',
            confidencePenalty: 15,
            affectedEngines: ['wear-recovery', 'irrigation-scheduler', 'soil-structure']
        },

        climateRegimeKey: {
            tier: 1,  // Soft default
            required: false,
            validValues: [
                'coolHumid', 'coolArid', 'warmHumid', 'warmArid',
                'tropical', 'mediterranean', 'continental', 'maritime',
                'subtropical', 'transitionZone',
                'unknownRegime'  // Valid unknown
            ],
            unknownValue: 'unknownRegime',
            defaultValue: 'unknownRegime',
            displayName: 'Climate Regime',
            defaultImpact: 'medium',
            confidencePenalty: 10,
            affectedEngines: ['disease-engine', 'irrigation-scheduler', 'stress-trajectory']
        },

        turfIntentKey: {
            tier: 1,  // Soft default
            required: false,
            validValues: [
                'eliteMatchPlay', 'professionalSport', 'collegiateSport',
                'communityRecreation', 'generalMaintenance', 'establishment',
                'renovation', 'overseeding',
                'unknownIntent'  // Valid unknown
            ],
            unknownValue: 'unknownIntent',
            defaultValue: 'unknownIntent',
            displayName: 'Turf Intent',
            defaultImpact: 'high',
            confidencePenalty: 20,
            affectedEngines: ['wear-recovery', 'pgr-module', 'nutrition-demand']
        },

        regionKey: {
            tier: 1,  // Soft default
            required: false,
            validValues: [
                'australia', 'newZealand', 'ukIreland', 'europe',
                'scandinavia', 'japan', 'usaNorth', 'usaSouth',
                'usaTransition', 'unknownRegion'
            ],
            unknownValue: 'unknownRegion',
            defaultValue: 'unknownRegion',
            displayName: 'Geographic Region',
            defaultImpact: 'low',
            confidencePenalty: 5,
            affectedEngines: ['fungicide-filter', 'variety-traits']
        }
    };

    // =========================================================================
    // ENGINE DECLARATIONS
    // =========================================================================

    /**
     * Engine identity requirements
     * Each engine declares which keys it needs and how it behaves under unknown
     */
    const ENGINE_REQUIREMENTS = {
        'disease-engine': {
            requires: ['speciesKey'],
            optional: ['climateRegimeKey', 'surfaceKey'],
            canRunUnknown: {
                climateRegimeKey: true,  // Runs with reduced confidence
                surfaceKey: true
            },
            unknownBehaviour: {
                climateRegimeKey: 'Disables regional disease weighting',
                surfaceKey: 'Uses conservative drainage assumptions'
            },
            canEmitRecommendations: {
                climateRegimeKey: false,  // No fungicide timing with unknown regime
                surfaceKey: true
            }
        },

        'wear-recovery': {
            requires: ['speciesKey'],
            optional: ['surfaceKey', 'turfIntentKey'],
            canRunUnknown: {
                surfaceKey: true,
                turfIntentKey: false  // Cannot run - recovery defined by intent
            },
            unknownBehaviour: {
                surfaceKey: 'Uses median recovery coefficients',
                turfIntentKey: 'BLOCKED - recovery windows require defined intent'
            },
            canEmitRecommendations: {
                surfaceKey: false,
                turfIntentKey: false
            }
        },

        'irrigation-scheduler': {
            requires: ['speciesKey'],
            optional: ['surfaceKey', 'climateRegimeKey'],
            canRunUnknown: {
                surfaceKey: true,
                climateRegimeKey: true
            },
            unknownBehaviour: {
                surfaceKey: 'Uses conservative infiltration rates',
                climateRegimeKey: 'Uses measured ET only, no regime adjustments'
            },
            canEmitRecommendations: {
                surfaceKey: false,  // No mm/day with unknown profile
                climateRegimeKey: true
            }
        },

        'pgr-module': {
            requires: ['speciesKey'],
            optional: ['turfIntentKey', 'climateRegimeKey'],
            canRunUnknown: {
                turfIntentKey: true,
                climateRegimeKey: true
            },
            unknownBehaviour: {
                turfIntentKey: 'Uses conservative GDD thresholds',
                climateRegimeKey: 'No seasonal regime adjustments'
            },
            canEmitRecommendations: {
                turfIntentKey: false,  // No rate recommendations with unknown intent
                climateRegimeKey: true
            }
        },

        'nutrition-demand': {
            requires: ['speciesKey'],
            optional: ['turfIntentKey', 'surfaceKey'],
            canRunUnknown: {
                turfIntentKey: true,
                surfaceKey: true
            },
            unknownBehaviour: {
                turfIntentKey: 'Uses maintenance-level demand curves',
                surfaceKey: 'Ignores CEC-based adjustments'
            },
            canEmitRecommendations: {
                turfIntentKey: false,  // No kg/ha with unknown intent
                surfaceKey: true
            }
        },

        'stress-trajectory': {
            requires: ['speciesKey'],
            optional: ['climateRegimeKey', 'turfIntentKey'],
            canRunUnknown: {
                climateRegimeKey: true,
                turfIntentKey: true
            },
            unknownBehaviour: {
                climateRegimeKey: 'Uses conservative stress thresholds',
                turfIntentKey: 'Uses general maintenance thresholds'
            },
            canEmitRecommendations: {
                climateRegimeKey: true,
                turfIntentKey: true  // Advisory only anyway
            }
        },

        'shade-engine': {
            requires: ['speciesKey'],
            optional: ['surfaceKey'],
            canRunUnknown: {
                surfaceKey: true
            },
            unknownBehaviour: {
                surfaceKey: 'Uses species-only DLI thresholds'
            },
            canEmitRecommendations: {
                surfaceKey: true
            }
        }
    };

    // =========================================================================
    // IDENTITY STATE
    // =========================================================================

    /**
     * Current identity state with tracking
     */
    let _identityState = {
        keys: {},
        assumptions: [],
        quality: {
            tier0Valid: false,
            defaultedKeys: [],
            totalConfidencePenalty: 0,
            canExport: true,
            canPrescribe: true,
            blockedEngines: [],
            restrictedEngines: []
        },
        validatedAt: null
    };

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /**
     * Validate and set an identity key
     * @param {string} keyName - Identity key name
     * @param {string|null} value - Provided value (null = not provided)
     * @param {string} source - Where the value came from ('user', 'derived', 'default')
     * @returns {object} { valid: boolean, value: string, assumption: object|null }
     */
    function setIdentityKey(keyName, value, source = 'user') {
        const keyDef = IDENTITY_KEYS[keyName];
        if (!keyDef) {
            console.warn(`[IdentityEnforcement] Unknown identity key: ${keyName}`);
            return { valid: false, value: null, assumption: null };
        }

        let finalValue = value;
        let assumption = null;
        let isDefaulted = false;

        // Normalise value
        if (finalValue && typeof finalValue === 'string') {
            finalValue = finalValue.trim();
        }

        // Check if value is valid
        const isValid = finalValue && keyDef.validValues.includes(finalValue);

        // Handle missing/invalid values
        if (!isValid) {
            if (keyDef.tier === 0) {
                // TIER 0: Hard fail - no default allowed
                console.error(`[IdentityEnforcement] TIER 0 VIOLATION: ${keyName} is required but ${value ? 'invalid' : 'missing'}`);
                return {
                    valid: false,
                    value: null,
                    error: keyDef.errorMessage,
                    tier: 0
                };
            } else {
                // TIER 1: Soft default with tracking
                finalValue = keyDef.defaultValue || keyDef.unknownValue;
                isDefaulted = true;
                source = 'default';

                assumption = {
                    key: keyName,
                    displayName: keyDef.displayName,
                    providedValue: value || null,
                    assumedValue: finalValue,
                    impact: keyDef.defaultImpact,
                    confidencePenalty: keyDef.confidencePenalty,
                    affectedEngines: keyDef.affectedEngines || [],
                    reason: value ? `"${value}" is not a recognised ${keyDef.displayName.toLowerCase()}` : `No ${keyDef.displayName.toLowerCase()} specified`
                };

                console.warn(`[IdentityEnforcement] ${keyName} defaulted to "${finalValue}" (impact: ${keyDef.defaultImpact}, penalty: -${keyDef.confidencePenalty}%)`);
            }
        }

        // Store in state
        _identityState.keys[keyName] = {
            value: finalValue,
            source: source,
            isDefaulted: isDefaulted,
            isUnknown: finalValue === keyDef.unknownValue,
            validatedAt: new Date().toISOString()
        };

        return {
            valid: true,
            value: finalValue,
            assumption: assumption,
            isDefaulted: isDefaulted
        };
    }

    /**
     * Validate all identity keys from input state
     * @param {object} inputs - Hub input state
     * @returns {object} Validation result with identity quality
     */
    function validateIdentity(inputs) {
        const startTime = Date.now();

        // Reset state
        _identityState = {
            keys: {},
            assumptions: [],
            quality: {
                tier0Valid: false,
                defaultedKeys: [],
                totalConfidencePenalty: 0,
                canExport: true,
                canPrescribe: true,
                blockedEngines: [],
                restrictedEngines: []
            },
            validatedAt: new Date().toISOString()
        };

        const turf = inputs?.turf || {};
        const site = inputs?.site || {};
        const location = inputs?.location || {};

        // ─────────────────────────────────────────────────────────────────────
        // TIER 0: Species (hard fail)
        // Cotula bypass: dicot species satisfy TIER 0 with a 'cotula' speciesKey.
        // Grass-specific engines will be suppressed by the isCotula flag, not here.
        // ─────────────────────────────────────────────────────────────────────
        const _extractedSpeciesKey = extractSpeciesKey(turf);
        const _isCotulaSurface = _extractedSpeciesKey === 'cotula'
            || turf.cotula === true
            || turf.turfType === 'bowls'
            || turf.surfaceType === 'cotula_bowling_green';

        const speciesResult = setIdentityKey(
            'speciesKey',
            _extractedSpeciesKey,
            turf.grassSpecies ? 'user' : (_isCotulaSurface ? 'cotula_bypass' : 'derived')
        );

        if (!speciesResult.valid && !_isCotulaSurface) {
            _identityState.quality.tier0Valid = false;
            _identityState.quality.canExport = false;
            _identityState.quality.canPrescribe = false;
            _identityState.quality.blockReason = speciesResult.error;

            console.error('[IdentityEnforcement] TIER 0 FAILURE:', speciesResult.error);

            return {
                valid: false,
                error: speciesResult.error,
                tier: 0,
                identityState: _identityState
            };
        }

        // For cotula: override speciesKey to 'cotula' and mark as dicot bypass
        if (_isCotulaSurface) {
            _identityState.speciesKey = 'cotula';
            _identityState.isCotula = true;
            _identityState.quality.tier0Valid = true;
            if (global.SpeciesController?.isDicotBypass) {
                console.log('[IdentityEnforcement] Cotula dicot bypass — TIER 0 satisfied, grass engines suppressed.');
            }
        }

        _identityState.quality.tier0Valid = true;

        // ─────────────────────────────────────────────────────────────────────
        // TIER 1: Surface, Climate, Intent, Region (soft defaults)
        // ─────────────────────────────────────────────────────────────────────

        // Surface/Profile
        const surfaceResult = setIdentityKey(
            'surfaceKey',
            extractSurfaceKey(turf, site),
            turf.profileType ? 'user' : 'derived'
        );
        if (surfaceResult.assumption) {
            _identityState.assumptions.push(surfaceResult.assumption);
        }

        // Climate Regime
        const climateResult = setIdentityKey(
            'climateRegimeKey',
            extractClimateRegimeKey(location, site),
            location.climateRegime ? 'user' : 'derived'
        );
        if (climateResult.assumption) {
            _identityState.assumptions.push(climateResult.assumption);
        }

        // Turf Intent
        const intentResult = setIdentityKey(
            'turfIntentKey',
            extractTurfIntentKey(turf, site),
            turf.turfIntent || site.intent ? 'user' : 'derived'
        );
        if (intentResult.assumption) {
            _identityState.assumptions.push(intentResult.assumption);
        }

        // Region
        const regionResult = setIdentityKey(
            'regionKey',
            extractRegionKey(location),
            location.region ? 'user' : 'derived'
        );
        if (regionResult.assumption) {
            _identityState.assumptions.push(regionResult.assumption);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Calculate quality metrics
        // ─────────────────────────────────────────────────────────────────────
        _identityState.assumptions.forEach(assumption => {
            _identityState.quality.defaultedKeys.push(assumption.key);
            _identityState.quality.totalConfidencePenalty += assumption.confidencePenalty;

            // Check if this blocks exports/prescriptions
            if (assumption.impact === 'high') {
                _identityState.quality.canPrescribe = false;
            }
            if (assumption.impact === 'high' || assumption.impact === 'medium') {
                // Check which engines are affected
                assumption.affectedEngines.forEach(engineId => {
                    const req = ENGINE_REQUIREMENTS[engineId];
                    if (req) {
                        if (!req.canRunUnknown?.[assumption.key]) {
                            if (!_identityState.quality.blockedEngines.includes(engineId)) {
                                _identityState.quality.blockedEngines.push(engineId);
                            }
                        } else if (!req.canEmitRecommendations?.[assumption.key]) {
                            if (!_identityState.quality.restrictedEngines.includes(engineId)) {
                                _identityState.quality.restrictedEngines.push(engineId);
                            }
                        }
                    }
                });
            }
        });

        // If any high-impact assumptions, block export
        const hasHighImpact = _identityState.assumptions.some(a => a.impact === 'high');
        if (hasHighImpact) {
            _identityState.quality.canExport = false;
        }

        const elapsed = Date.now() - startTime;

        return {
            valid: true,
            identityState: _identityState
        };
    }

    // =========================================================================
    // EXTRACTION HELPERS
    // =========================================================================

    /**
     * Extract species key from turf input
     */
    function extractSpeciesKey(turf) {
        if (!turf) return null;

        // Cotula fast-path: if turf profile is explicitly set to cotula/bowls,
        // return 'cotula' directly — no grass normalisation needed.
        if (turf.cotula === true || turf.speciesKey === 'cotula' ||
            turf.surfaceType === 'cotula_bowling_green' ||
            turf.turfType === 'bowls') {
            return 'cotula';
        }

        // Try SpeciesController first (also handles cotula via DICOT_BYPASS)
        if (global.SpeciesController && typeof global.SpeciesController.normalize === 'function') {
            const raw = turf.grassSpecies || turf.species?.grassSpecies || turf.species;
            if (raw) {
                const canonical = global.SpeciesController.normalize(raw);
                // normalize() now returns 'cotula' for Leptinella — pass it through
                return canonical;
            }
        }

        // Direct extraction
        const raw = turf.grassSpecies ||
                   (typeof turf.species === 'string' ? turf.species : null) ||
                   turf.species?.grassSpecies ||
                   turf.species?.name;

        if (!raw) return null;

        // Simple normalisation
        return raw.toLowerCase()
            .replace(/\s+/g, '')
            .replace('bermudagrass', 'bermuda')
            .replace('couchgrass', 'couch');
    }

    /**
     * Extract surface/profile key
     */
    function extractSurfaceKey(turf, site) {
        const raw = turf.profileType || 
                   turf.profile?.type || 
                   turf.construction ||
                   site.profileType ||
                   site.construction;

        // Map common values to canonical keys
        const mapping = {
            'usga': 'usga',
            'usga green': 'usga',
            'usga_sand': 'usga',
            'usga_green': 'usga',
            'california': 'californiaProfile',
            'california green': 'californiaProfile',
            'california_green': 'californiaProfile',
            'sand': 'sandProfile',
            'sand profile': 'sandProfile',
            'sand_profile': 'sandProfile',
            'push up': 'pushUp',
            'push-up': 'pushUp',
            'push_up': 'pushUp',
            'native': 'nativeSoil',
            'native soil': 'nativeSoil',
            'native_soil': 'nativeSoil',
            'sand cap': 'sandCap',
            'sandcap': 'sandCap',
            'sand_cap': 'sandCap',
            'sand_carpet': 'sandCap',
            'hybrid': 'hybrid',
            'hybrid_turf': 'hybrid',
            'synthetic': 'synthetic',
            'pipe_drained': 'nativeSoil',
            'pipe-drained': 'nativeSoil'
        };

        if (raw) {
            const normalised = raw.toLowerCase().trim();
            const mapped = mapping[normalised];
            if (mapped) return mapped;
        }

        // b35fix170: construction absent or unrecognised — derive a penalty-free default
        // from turfType + subCategory using the same defaults TurfProfile applies.
        // This prevents unknownProfile (-15%) for sites where TurfProfile wiped
        // state.construction during a species/subCategory reset (e.g. lawns + null subCategory).
        const turfType    = (turf.turfType    || site.turfType    || '').toLowerCase();
        const subCategory = (turf.subCategory || site.subCategory || '').toLowerCase();

        // Golf greens → USGA (industry standard default)
        if (turfType === 'golf' && (subCategory === 'greens' || subCategory === 'green')) return 'usga';
        // Golf tees/fairways → sand profile
        if (turfType === 'golf' && (subCategory === 'tees' || subCategory === 'fairways' || subCategory === 'fairway')) return 'sandProfile';
        // Golf general (no subCategory)
        if (turfType === 'golf') return 'sandProfile';
        // Sports stadium / elite → sand carpet (sandCap)
        if (turfType === 'sports' && (subCategory === 'stadium' || subCategory === 'elite' || subCategory === 'professional')) return 'sandCap';
        // Sports general → sand carpet
        if (turfType === 'sports') return 'sandCap';
        // Lawns / bowling / general → native soil
        if (turfType === 'lawns' || turfType === 'bowls') return 'nativeSoil';

        // Still nothing — return null and let setIdentityKey apply unknownProfile
        return null;
    }

    /**
     * Extract climate regime key
     */
    function extractClimateRegimeKey(location, site) {
        const raw = location.climateRegime || site.climateRegime;

        if (!raw) {
            // Try to derive from latitude if available
            if (location.latitude) {
                return deriveClimateRegime(location.latitude, location.longitude);
            }
            return null;
        }

        // Map to canonical keys
        const mapping = {
            'cool humid': 'coolHumid',
            'cool arid': 'coolArid',
            'warm humid': 'warmHumid',
            'warm arid': 'warmArid',
            'tropical': 'tropical',
            'mediterranean': 'mediterranean',
            'continental': 'continental',
            'maritime': 'maritime',
            'subtropical': 'subtropical',
            'transition': 'transitionZone',
            'transition zone': 'transitionZone'
        };

        const normalised = raw.toLowerCase().trim();
        return mapping[normalised] || null;
    }

    /**
     * Derive climate regime from latitude (approximate)
     */
    function deriveClimateRegime(lat, lon) {
        const absLat = Math.abs(lat);

        if (absLat < 23.5) return 'tropical';
        if (absLat < 35) return 'subtropical';
        if (absLat < 45) return 'transitionZone';
        if (absLat < 55) return 'coolHumid';  // Simplified
        return 'continental';
    }

    /**
     * Extract turf intent key
     */
    function extractTurfIntentKey(turf, site) {
        // First try explicit intent fields
        const explicitIntent = turf.turfIntent || turf.intent || site.intent;
        
        // Then try to derive from turfType + subCategory (Hub standard)
        const turfType = turf.turfType || '';
        const subCategory = turf.subCategory || '';
        
        // Combine for matching: e.g., "golf" + "greens" → "golf_greens"
        const combined = (turfType + '_' + subCategory).toLowerCase().trim().replace(/\s+/g, '_');
        const raw = explicitIntent || combined || turfType;

        if (!raw) return null;

        // Map to canonical keys
        const mapping = {
            'elite': 'eliteMatchPlay',
            'elite match': 'eliteMatchPlay',
            'elite match play': 'eliteMatchPlay',
            'professional': 'professionalSport',
            'professional sport': 'professionalSport',
            'pro': 'professionalSport',
            'collegiate': 'collegiateSport',
            'college': 'collegiateSport',
            'community': 'communityRecreation',
            'recreation': 'communityRecreation',
            'general': 'generalMaintenance',
            'maintenance': 'generalMaintenance',
            'establishment': 'establishment',
            'renovation': 'renovation',
            'overseed': 'overseeding',
            'overseeding': 'overseeding',
            // Hub turfType + subCategory combinations
            'golf_greens': 'eliteMatchPlay',
            'golf_tees': 'professionalSport',
            'golf_fairways': 'professionalSport',
            'golf_fairway': 'professionalSport',
            'golf_surrounds': 'generalMaintenance',
            'golf_': 'professionalSport',
            'sports_stadium': 'eliteMatchPlay',
            'sports_elite': 'eliteMatchPlay',
            'sports_professional': 'professionalSport',
            'sports_community': 'communityRecreation',
            'sports_training': 'communityRecreation',
            'sports_': 'professionalSport',
            'lawns_': 'generalMaintenance',
            // b35fix390: cotula bowls turfType mapping. Pre-fix, no entry for
            // 'bowls' or 'bowls_*'; cotula sites with turfType='bowls' and
            // subCategory=null produced a `combined` of 'bowls_' which mapped
            // to nothing → returned null → triggered the unknownIntent default
            // at the call site (-20% confidence penalty), which in turn blocked
            // the wear engine at hub-orchestrator.js:1063 with "BLOCKED -
            // recovery windows require defined intent" (post-b35fix389; pre-
            // b35fix389 the wear engine had been blocked one rung earlier on
            // missing speciesKey). eliteMatchPlay chosen as the closest
            // existing intent: bowls is precision short-mown competition turf,
            // agronomically equivalent intent profile to elite golf greens
            // (eliteMatchPlay maps 'golf_greens' and 'sports_stadium' / 'sports_elite').
            // Production evidence: gilbasolutions_com-1777421036591.log lines
            // 196/252 (X Cotula BC, Christchurch, post-b35fix389 deploy at
            // ?ver=1777420942). Pairs with b35fix388 (turfType durability)
            // and b35fix389 (cotula speciesKey validValues) to close the
            // cotula bowls log triad: TIER 0 VIOLATION (closed b35fix389),
            // unknownIntent default (closed b35fix390), wear engine block
            // on speciesKey (closed b35fix389), wear engine block on intent
            // (closed b35fix390). Cotula dicot bypass log line stays — that's
            // intended (grass engines are correctly suppressed for a dicot).
            'bowls': 'eliteMatchPlay',
            'bowls_': 'eliteMatchPlay',
            'bowling': 'eliteMatchPlay',
            'bowling_green': 'eliteMatchPlay',
            'bowling_greens': 'eliteMatchPlay',
            // Legacy single-value mappings
            'greens': 'eliteMatchPlay',
            'fairway': 'professionalSport',
            'fairways': 'professionalSport',
            'tees': 'professionalSport',
            'sports': 'professionalSport',
            'stadium': 'eliteMatchPlay',
            'golf': 'professionalSport',
            'lawns': 'generalMaintenance'
        };

        const normalised = (typeof raw === 'string') ? raw.toLowerCase().trim() : '';
        return mapping[normalised] || null;
    }

    /**
     * Extract region key
     */
    function extractRegionKey(location) {
        const raw = location.region || location.country;

        if (!raw) {
            // Try to derive from coordinates
            if (location.latitude && location.longitude) {
                return deriveRegion(location.latitude, location.longitude);
            }
            return null;
        }

        // Map to canonical keys
        const mapping = {
            'australia': 'australia',
            'au': 'australia',
            'new zealand': 'newZealand',
            'nz': 'newZealand',
            'uk': 'ukIreland',
            'united kingdom': 'ukIreland',
            'ireland': 'ukIreland',
            'europe': 'europe',
            'eu': 'europe',
            'scandinavia': 'scandinavia',
            'nordic': 'scandinavia',
            'japan': 'japan',
            'jp': 'japan',
            'usa north': 'usaNorth',
            'usa south': 'usaSouth',
            'usa transition': 'usaTransition'
        };

        const normalised = raw.toLowerCase().trim();
        return mapping[normalised] || null;
    }

    /**
     * Derive region from coordinates (simplified)
     */
    function deriveRegion(lat, lon) {
        // Australia/NZ
        if (lat < -10 && lon > 110 && lon < 180) {
            return lon > 165 ? 'newZealand' : 'australia';
        }
        // Southeast Asia / tropical Asia (Vietnam, Thailand, Malaysia, Philippines, Indonesia north)
        if (lat >= -10 && lat <= 25 && lon >= 95 && lon <= 140) {
            return 'australia'; // nearest supported profile — tropical C4 management
        }
        // Japan
        if (lat > 24 && lat < 46 && lon > 122 && lon < 154) {
            return 'japan';
        }
        // UK/Ireland
        if (lat > 49 && lat < 61 && lon > -12 && lon < 2) {
            return 'ukIreland';
        }
        // Scandinavia
        if (lat > 54 && lon > 4 && lon < 32) {
            return 'scandinavia';
        }
        // Europe (general)
        if (lat > 35 && lat < 60 && lon > -10 && lon < 40) {
            return 'europe';
        }

        return null;
    }

    // =========================================================================
    // ENGINE INTERFACE
    // =========================================================================

    /**
     * Check if an engine can run given current identity state
     * @param {string} engineId - Engine identifier
     * @returns {object} { canRun: boolean, reason: string, restrictions: [] }
     */
    function canEngineRun(engineId) {
        const req = ENGINE_REQUIREMENTS[engineId];
        if (!req) {
            // Unknown engine - allow by default
            return { canRun: true, reason: null, restrictions: [] };
        }

        // Check required keys
        for (const keyName of req.requires) {
            const keyState = _identityState.keys[keyName];
            if (!keyState || !keyState.value) {
                return {
                    canRun: false,
                    reason: `Missing required identity: ${keyName}`,
                    restrictions: []
                };
            }
        }

        // Check optional keys that are unknown
        const restrictions = [];
        for (const keyName of (req.optional || [])) {
            const keyState = _identityState.keys[keyName];
            if (keyState?.isUnknown || keyState?.isDefaulted) {
                if (!req.canRunUnknown?.[keyName]) {
                    return {
                        canRun: false,
                        reason: req.unknownBehaviour?.[keyName] || `Cannot run with unknown ${keyName}`,
                        restrictions: []
                    };
                } else {
                    restrictions.push({
                        key: keyName,
                        behaviour: req.unknownBehaviour?.[keyName],
                        canEmitRecommendations: req.canEmitRecommendations?.[keyName] ?? true
                    });
                }
            }
        }

        return {
            canRun: true,
            reason: null,
            restrictions: restrictions
        };
    }

    /**
     * Check if an engine can emit recommendations
     * @param {string} engineId - Engine identifier
     * @returns {boolean}
     */
    function canEngineRecommend(engineId) {
        const runCheck = canEngineRun(engineId);
        if (!runCheck.canRun) return false;

        // Check if any restriction blocks recommendations
        for (const restriction of runCheck.restrictions) {
            if (!restriction.canEmitRecommendations) {
                return false;
            }
        }

        return _identityState.quality.canPrescribe;
    }

    /**
     * Get confidence penalty for current identity state
     * @returns {number} Total penalty (0-100)
     */
    function getConfidencePenalty() {
        return Math.min(50, _identityState.quality.totalConfidencePenalty);
    }

    /**
     * Get identity quality for inclusion in results
     * @returns {object}
     */
    function getIdentityQuality() {
        return {
            ..._identityState.quality,
            keys: { ..._identityState.keys },
            assumptions: [..._identityState.assumptions]
        };
    }

    // =========================================================================
    // OUTPUT GATING
    // =========================================================================

    /**
     * Check if export is allowed
     * @param {string} exportType - 'pdf', 'word', 'prescription'
     * @returns {object} { allowed: boolean, reason: string, assumptions: [] }
     */
    function canExport(exportType = 'word') {
        if (!_identityState.quality.tier0Valid) {
            return {
                allowed: false,
                reason: 'Species is required for export',
                assumptions: []
            };
        }

        const highImpactAssumptions = _identityState.assumptions.filter(a => a.impact === 'high');
        const mediumImpactAssumptions = _identityState.assumptions.filter(a => a.impact === 'medium');

        if (exportType === 'prescription') {
            if (highImpactAssumptions.length > 0 || mediumImpactAssumptions.length > 0) {
                return {
                    allowed: false,
                    reason: 'Prescription outputs require explicit identity inputs',
                    assumptions: [...highImpactAssumptions, ...mediumImpactAssumptions]
                };
            }
        }

        if (exportType === 'pdf' || exportType === 'word') {
            if (highImpactAssumptions.length > 0) {
                return {
                    allowed: false,
                    reason: 'Export blocked due to high-impact assumptions. Please specify: ' +
                           highImpactAssumptions.map(a => a.displayName).join(', '),
                    assumptions: highImpactAssumptions
                };
            }
        }

        return {
            allowed: true,
            reason: null,
            assumptions: _identityState.assumptions,
            warning: mediumImpactAssumptions.length > 0 ?
                'Report includes assumed inputs: ' + mediumImpactAssumptions.map(a => a.displayName).join(', ') :
                null
        };
    }

    /**
     * Format assumptions for display in reports
     * @returns {string} HTML or text block
     */
    function formatAssumptionsForExport(format = 'html') {
        if (_identityState.assumptions.length === 0) {
            return '';
        }

        if (format === 'html') {
            let html = '<div class="gaip-assumptions-block" style="';
            html += 'background: var(--gaip-warning-bg); border: 1px solid #f59e0b; border-left: 4px solid #f59e0b; ';
            html += 'padding: 12px; margin: 12px 0; border-radius: 4px;">';
            html += '<div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">⚠️ Assumed Inputs</div>';
            html += '<div style="font-size: 13px; color: #78350f;">';
            html += 'The following inputs were not specified and have been assumed:';
            html += '<ul style="margin: 8px 0 0 0; padding-left: 20px;">';

            _identityState.assumptions.forEach(a => {
                html += `<li><strong>${a.displayName}:</strong> "${a.assumedValue}" `;
                html += `<span style="color: #b45309;">(${a.impact} impact)</span></li>`;
            });

            html += '</ul>';
            html += '<div style="margin-top: 8px; font-size: 12px; color: #92400e;">';
            html += 'Recommendations should be treated as informational only until these inputs are confirmed.';
            html += '</div></div></div>';

            return html;
        }

        // Plain text
        let text = '=== ASSUMED INPUTS ===\n';
        text += 'The following inputs were not specified:\n';
        _identityState.assumptions.forEach(a => {
            text += `• ${a.displayName}: "${a.assumedValue}" (${a.impact} impact)\n`;
        });
        text += '\nRecommendations should be treated as informational only.\n';

        return text;
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    global.GilbaIdentityEnforcement = {
        version: VERSION,

        // Core validation
        validateIdentity: validateIdentity,
        setIdentityKey: setIdentityKey,

        // State access
        getIdentityState: function() { return _identityState; },
        getIdentityQuality: getIdentityQuality,
        getConfidencePenalty: getConfidencePenalty,

        // Engine interface
        canEngineRun: canEngineRun,
        canEngineRecommend: canEngineRecommend,

        // Output gating
        canExport: canExport,
        formatAssumptionsForExport: formatAssumptionsForExport,

        // Configuration
        IDENTITY_KEYS: IDENTITY_KEYS,
        ENGINE_REQUIREMENTS: ENGINE_REQUIREMENTS
    };

})(typeof window !== 'undefined' ? window : this);
