/**
 * SpeciesController - Single Source of Truth for Species Identity
 * Version: 1.0.0
 * 
 * PURPOSE:
 * This controller enforces species identity at the Hub core. ALL modules
 * must use this controller to get species information - never read from
 * DOM, GAIP_STATE, or local variables directly.
 * 
 * USAGE:
 *   const species = SpeciesController.getSpecies();           // Canonical form
 *   const effective = SpeciesController.getEffectiveSpecies(); // Accounts for overseed
 *   const isC4 = SpeciesController.isC4();                    // Boolean
 *   const isC4Base = SpeciesController.isC4Base();            // Base species (ignoring overseed)
 * 
 * CANONICAL SPECIES KEYS (use these in all modules):
 *   C4: 'couch', 'kikuyu', 'zoysia', 'buffalo', 'seashore_paspalum'
 *   C3: 'perennialRyegrass', 'bentgrass', 'browntopBent', 'kentuckyBluegrass', 
 *       'tallFescue', 'fineFescue', 'poaAnnua'
 *   Dicot bypass: 'cotula' (Leptinella — NZ bowling green, not a grass)
 * 
 * EVENTS:
 *   Fires 'gaip:species-changed' when species changes, with detail:
 *   { species, effectiveSpecies, isC4, isC4Base, overseed, timestamp }
 */

(function(global) {
    'use strict';

    // =========================================================================
    // CANONICAL SPECIES MAPPING - THE SINGLE SOURCE OF TRUTH
    // =========================================================================
    
    const SPECIES_ALIASES = {
        // === C4 WARM SEASON ===
        // Couch/Bermuda - canonical: 'couch'
        'couch': 'couch',
        'bermuda': 'couch',
        'bermudagrass': 'couch',
        'couchgrass': 'couch',
        'couch (bermudagrass)': 'couch',
        'couch / bermudagrass': 'couch',
        'couch/bermuda': 'couch',
        'couch / bermudagrass (ultradwarf)': 'couch',
        'hybrid couch': 'couch',
        'hybrid bermuda': 'couch',
        'hybrid bermudagrass': 'couch',
        'couch (hybrid)': 'couch',
        'bermuda (hybrid)': 'couch',
        'cynodon': 'couch',
        'cynodon dactylon': 'couch',
        'cynodon hybrid': 'couch',
        
        // Kikuyu - canonical: 'kikuyu'
        'kikuyu': 'kikuyu',
        'kikuyugrass': 'kikuyu',
        'pennisetum clandestinum': 'kikuyu',
        
        // Zoysia - canonical: 'zoysia'
        'zoysia': 'zoysia',
        'zoysiagrass': 'zoysia',
        'zoysia (empire, nara)': 'zoysia',
        'empire': 'zoysia',
        'nara': 'zoysia',
        
        // Buffalo/St Augustine - canonical: 'buffalo'
        'buffalo': 'buffalo',
        'buffalograss': 'buffalo',
        'buffalo grass': 'buffalo',
        'buffalo (sir walter, sapphire)': 'buffalo',
        'st augustine': 'buffalo',
        'st augustinegrass': 'buffalo',
        'staugustine': 'buffalo',
        'stenotaphrum': 'buffalo',
        'stenotaphrum secundatum': 'buffalo',
        'sir walter': 'buffalo',
        'sapphire': 'buffalo',
        
        // Seashore Paspalum - canonical: 'seashore_paspalum'
        'paspalum': 'seashore_paspalum',
        'seashore paspalum': 'seashore_paspalum',
        'seashore_paspalum': 'seashore_paspalum',
        'paspalum vaginatum': 'seashore_paspalum',
        
        // === C3 COOL SEASON ===
        // Perennial Ryegrass - canonical: 'perennialRyegrass'
        'perennial ryegrass': 'perennialRyegrass',
        'perennialryegrass': 'perennialRyegrass',
        'perennial ryegrass (sports)': 'perennialRyegrass',
        'ryegrass': 'perennialRyegrass',
        'prg': 'perennialRyegrass',
        'lolium perenne': 'perennialRyegrass',
        
        // Creeping Bentgrass - canonical: 'bentgrass'
        'bentgrass': 'bentgrass',
        'bent': 'bentgrass',
        'creeping bentgrass': 'bentgrass',
        'creepingbentgrass': 'bentgrass',
        'creeping bentgrass (greens)': 'bentgrass',
        'agrostis stolonifera': 'bentgrass',
        
        // Browntop/Colonial Bent - canonical: 'browntopBent'
        'browntop bent': 'browntopBent',
        'browntopbent': 'browntopBent',
        'browntop': 'browntopBent',
        'browntop bent (greens)': 'browntopBent',
        'colonial bent': 'browntopBent',
        'colonialbent': 'browntopBent',
        'colonial bentgrass': 'browntopBent',
        'agrostis capillaris': 'browntopBent',
        
        // Kentucky Bluegrass - canonical: 'kentuckyBluegrass'
        'kentucky bluegrass': 'kentuckyBluegrass',
        'kentuckybluegrass': 'kentuckyBluegrass',
        'bluegrass': 'kentuckyBluegrass',
        'kbg': 'kentuckyBluegrass',
        'poa pratensis': 'kentuckyBluegrass',
        
        // Poa annua - canonical: 'poaAnnua'
        'poa annua': 'poaAnnua',
        'poaannua': 'poaAnnua',
        'poa': 'poaAnnua',
        'annual bluegrass': 'poaAnnua',
        'annualbluegrass': 'poaAnnua',
        'annual bluegrass (greens)': 'poaAnnua',
        'annual bluegrass (fairway)': 'poaAnnua',
        
        // Tall Fescue - canonical: 'tallFescue'
        'tall fescue': 'tallFescue',
        'tallfescue': 'tallFescue',
        'festuca arundinacea': 'tallFescue',
        
        // Fine Fescue - canonical: 'fineFescue' (default for unqualified 'fescue')
        'fescue': 'fineFescue',
        'fine fescue': 'fineFescue',
        'finefescue': 'fineFescue',
        'chewings fescue': 'fineFescue',
        'hard fescue': 'fineFescue',
        'sheep fescue': 'fineFescue',
        'creeping red fescue': 'fineFescue',
        'festuca rubra': 'fineFescue',

        // Cotula (Leptinella) — NZ bowling green dicot
        // Returns canonical key 'cotula' — NOT a grass, bypass GP/tissue models
        'cotula': 'cotula',
        'leptinella': 'cotula',
        'leptinella dioica': 'cotula',
        'leptinelladioica': 'cotula',
        'cotula dioica': 'cotula',
        'cotuladioica': 'cotula',
        'cotula maniototo': 'cotula',
        'cotulamaniototo': 'cotula',
        'grasslands pahia': 'cotula',
        'grasslandspahia': 'cotula',
        'cotula bowling green': 'cotula',
        'cotulabowlinggreen': 'cotula'
    };

    // C4 species list for quick lookup
    const C4_SPECIES = ['couch', 'kikuyu', 'zoysia', 'buffalo', 'seashore_paspalum'];

    // Dicot bypass species — not grasses, exempt from C3/C4 GP and tissue N models.
    // SpeciesController returns their canonical key directly; no default fallback.
    // Identity enforcement must treat these as valid non-grass identities.
    const DICOT_BYPASS_SPECIES = ['cotula'];

    // Default fallback — only used for true unknowns, NOT for registered dicots
    const DEFAULT_SPECIES = 'perennialRyegrass';

    // =========================================================================
    // SPECIES CONTROLLER
    // =========================================================================

    const SpeciesController = {
        version: '1.0.0',
        
        // Internal state cache (mirrors GaipTurfProfile but normalised)
        _cache: {
            species: null,
            effectiveSpecies: null,
            baseSpecies: null,
            overseed: null,
            c3Fraction: 0,
            lastUpdate: 0
        },

        /**
         * Normalise any species string to canonical form
         * THIS IS THE ONLY NORMALISATION FUNCTION - all modules must use this
         * @param {string|object} species - Species name in any format
         * @returns {string} Canonical species key
         */
        normalize: function(species) {
            if (!species) return DEFAULT_SPECIES;
            
            // Handle object with species property
            if (typeof species === 'object') {
                species = species.species || species.grassSpecies || species.value || '';
            }
            
            if (typeof species !== 'string') return DEFAULT_SPECIES;
            
            // Clean the string
            const cleaned = species
                .toLowerCase()
                .trim()
                .replace(/\s*\([^)]*\)/g, '')  // Remove parenthetical suffixes like (Greens)
                .trim();
            
            // Direct lookup
            if (SPECIES_ALIASES[cleaned]) {
                return SPECIES_ALIASES[cleaned];
            }
            
            // Try without spaces
            const noSpaces = cleaned.replace(/\s+/g, '');
            if (SPECIES_ALIASES[noSpaces]) {
                return SPECIES_ALIASES[noSpaces];
            }
            
            // Try alphanumeric only
            const alphaOnly = cleaned.replace(/[^a-z0-9]/g, '');
            for (const [alias, canonical] of Object.entries(SPECIES_ALIASES)) {
                if (alias.replace(/[^a-z0-9]/g, '') === alphaOnly) {
                    return canonical;
                }
            }
            
            // Check if this is a registered dicot bypass species
            // (after alias lookup has already been attempted above)
            if (DICOT_BYPASS_SPECIES.includes(alphaOnly) || 
                DICOT_BYPASS_SPECIES.includes(cleaned) ||
                DICOT_BYPASS_SPECIES.includes(noSpaces)) {
                return alphaOnly || cleaned || noSpaces;
            }

            // If still not found, log warning and return default
            console.warn(`[SpeciesController] Unknown species "${species}", defaulting to ${DEFAULT_SPECIES}`);
            return DEFAULT_SPECIES;
        },

        /**
         * Check if a species is C4 (warm season)
         * @param {string} species - Canonical or raw species name
         * @returns {boolean}
         */
        isC4Species: function(species) {
            const canonical = this.normalize(species);
            return C4_SPECIES.includes(canonical);
        },

        /**
         * Check if a species is a registered dicot bypass (not a grass).
         * These species bypass GP, tissue N ratios, and grass-specific models.
         * @param {string} species - Raw or canonical species name
         * @returns {boolean}
         */
        isDicotBypass: function(species) {
            if (!species) return false;
            const canonical = this.normalize(species);
            return DICOT_BYPASS_SPECIES.includes(canonical);
        },

        /**
         * Check if species requires standard grass identity enforcement.
         * Returns false for dicot bypass species (cotula etc).
         * @param {string} species - Raw or canonical species name
         * @returns {boolean}
         */
        requiresGrassIdentity: function(species) {
            return !this.isDicotBypass(species);
        },

        /**
         * Get the current base species (canonical form)
         * @returns {string} Canonical species key
         */
        getSpecies: function() {
            this._updateCache();
            return this._cache.species || DEFAULT_SPECIES;
        },

        /**
         * Get the effective species (accounts for overseed dominance)
         * When overseed > 50%, returns the overseed species instead of base
         * @returns {string} Canonical species key
         */
        getEffectiveSpecies: function() {
            this._updateCache();
            return this._cache.effectiveSpecies || this._cache.species || DEFAULT_SPECIES;
        },

        /**
         * Get the base species (ignoring overseed)
         * @returns {string} Canonical species key
         */
        getBaseSpecies: function() {
            this._updateCache();
            return this._cache.baseSpecies || this._cache.species || DEFAULT_SPECIES;
        },

        /**
         * Check if current effective species is C4
         * @returns {boolean}
         */
        isC4: function() {
            return this.isC4Species(this.getEffectiveSpecies());
        },

        /**
         * Check if base species is C4 (regardless of overseed)
         * @returns {boolean}
         */
        isC4Base: function() {
            return this.isC4Species(this.getBaseSpecies());
        },

        /**
         * Get overseed information
         * @returns {object|null} { species, variety, c3Fraction } or null
         */
        getOverseed: function() {
            this._updateCache();
            return this._cache.overseed;
        },

        /**
         * Get C3 fraction (0-100)
         * @returns {number}
         */
        getC3Fraction: function() {
            this._updateCache();
            return this._cache.c3Fraction || 0;
        },

        /**
         * Check if overseed is dominant (>50% C3)
         * @returns {boolean}
         */
        isOverseedDominant: function() {
            return this.getC3Fraction() > 50;
        },

        /**
         * Get full species state object
         * @returns {object}
         */
        getState: function() {
            this._updateCache();
            return {
                species: this._cache.species,
                effectiveSpecies: this._cache.effectiveSpecies,
                baseSpecies: this._cache.baseSpecies,
                isC4: this.isC4(),
                isC4Base: this.isC4Base(),
                overseed: this._cache.overseed,
                c3Fraction: this._cache.c3Fraction,
                timestamp: this._cache.lastUpdate
            };
        },

        /**
         * Internal: Update cache from GaipTurfProfile and GAIP_STATE
         */
        _updateCache: function() {
            const now = Date.now();
            
            // Don't update more than once per 100ms
            if (now - this._cache.lastUpdate < 100) {
                return;
            }

            // Primary source: GaipTurfProfile
            let rawSpecies = null;
            let rawOverseed = null;
            let c3Fraction = 0;

            if (global.GaipTurfProfile && global.GaipTurfProfile.state) {
                rawSpecies = global.GaipTurfProfile.state.species;
                rawOverseed = global.GaipTurfProfile.state.overseedSpecies;
            }

            // Secondary source: GAIP_STATE
            if (!rawSpecies && global.GAIP_STATE) {
                const state = global.GAIP_STATE;
                rawSpecies = state.turf?.grassSpecies || 
                             state.turf?.species || 
                             state.species;
                rawOverseed = state.turf?.overseedSpecies ||
                              state.overseed?.species;
            }

            // Get C3 fraction from overseed state
            if (global.GAIP_OVERSEED_STATE) {
                c3Fraction = global.GAIP_OVERSEED_STATE.c3Fraction || 0;
            } else if (global.GAIP_STATE?.overseed?.c3Fraction) {
                c3Fraction = global.GAIP_STATE.overseed.c3Fraction;
            }

            // Normalise
            const species = this.normalize(rawSpecies);
            const baseSpecies = species;
            let effectiveSpecies = species;

            // Handle overseed dominance
            let overseed = null;
            if (rawOverseed) {
                const overseedNorm = this.normalize(rawOverseed);
                overseed = {
                    species: overseedNorm,
                    c3Fraction: c3Fraction
                };
                
                // If overseed is dominant (>50% C3), use overseed as effective species
                if (c3Fraction > 50 && this.isC4Species(species) && !this.isC4Species(overseedNorm)) {
                    effectiveSpecies = overseedNorm;
                }
            }

            // Also check turf.effectiveSpecies if set by another module
            if (global.GAIP_STATE?.turf?.effectiveSpecies) {
                const stateEffective = this.normalize(global.GAIP_STATE.turf.effectiveSpecies);
                // Only use if it differs from base (indicating overseed scenario)
                if (stateEffective !== species) {
                    effectiveSpecies = stateEffective;
                }
            }

            // Update cache
            this._cache = {
                species: species,
                effectiveSpecies: effectiveSpecies,
                baseSpecies: baseSpecies,
                overseed: overseed,
                c3Fraction: c3Fraction,
                lastUpdate: now
            };
        },

        /**
         * Force cache refresh and fire change event
         * Call this after programmatic species changes
         */
        refresh: function() {
            this._cache.lastUpdate = 0;
            this._updateCache();
            this._fireChangeEvent();
        },

        /**
         * Internal: Fire species changed event
         */
        _fireChangeEvent: function() {
            const detail = this.getState();
            const event = new CustomEvent('gaip:species-changed', {
                detail: detail,
                bubbles: true
            });
            document.dispatchEvent(event);
        },

        /**
         * Initialise controller and set up listeners
         */
        init: function() {
            // Listen to turf profile changes
            document.addEventListener('gaip:turf-profile-change', (e) => {
                const oldEffective = this._cache.effectiveSpecies;
                this._cache.lastUpdate = 0; // Force refresh
                this._updateCache();
                
                // Only fire if species actually changed
                if (this._cache.effectiveSpecies !== oldEffective) {
                    this._fireChangeEvent();
                }
            });

            // Listen to overseed changes
            document.addEventListener('gaip:overseed-update', (e) => {
                const oldEffective = this._cache.effectiveSpecies;
                this._cache.lastUpdate = 0;
                this._updateCache();
                
                if (this._cache.effectiveSpecies !== oldEffective) {
                    this._fireChangeEvent();
                }
            });

            // Initial cache population
            this._updateCache();
            
        },

        // =====================================================================
        // COMPATIBILITY HELPERS - Help migrate modules to use this controller
        // =====================================================================

        /**
         * For modules that need the old normalizeSpecies function signature
         * @deprecated Use SpeciesController.normalize() directly
         */
        normalizeSpecies: function(species) {
            console.warn('[SpeciesController] normalizeSpecies() is deprecated, use normalize()');
            return this.normalize(species);
        },

        /**
         * Get species info in the format some modules expect
         * @returns {object}
         */
        getLegacyFormat: function() {
            const state = this.getState();
            return {
                species: state.species,
                grassSpecies: state.species,
                effectiveSpecies: state.effectiveSpecies,
                isC4: state.isC4,
                isC4Base: state.isC4Base,
                warmBase: state.isC4Base ? state.baseSpecies : null,
                c3Fraction: state.c3Fraction
            };
        },

        /**
         * Get display name for a canonical species key
         * @param {string} canonicalKey - Canonical species key from normalize()
         * @returns {string} Human-readable display name
         */
        getDisplayName: function(canonicalKey) {
            const DISPLAY_NAMES = {
                'couch': 'Couch / Bermudagrass',
                'kikuyu': 'Kikuyu',
                'zoysia': 'Zoysia',
                'buffalo': 'Buffalo / St Augustine',
                'seashore_paspalum': 'Seashore Paspalum',
                'perennialRyegrass': 'Perennial Ryegrass',
                'bentgrass': 'Creeping Bentgrass',
                'browntopBent': 'Browntop Bent / Colonial',
                'kentuckyBluegrass': 'Kentucky Bluegrass',
                'poaAnnua': 'Annual Bluegrass (Poa annua)',
                'tallFescue': 'Tall Fescue',
                'fineFescue': 'Fine Fescue'
            };
            return DISPLAY_NAMES[canonicalKey] || canonicalKey;
        },

        /**
         * Map canonical species key to nutrient demand engine key
         * The nutrient demand engine uses slightly different keys in some cases.
         * @param {string} canonicalKey - Canonical species key from normalize()
         * @returns {string} Key recognised by GilbaNutrientDemandEngine
         */
        toNutrientKey: function(canonicalKey) {
            const NUTRIENT_KEY_MAP = {
                'couch': 'bermuda',
                'buffalo': 'buffalograss',
                'seashore_paspalum': 'seashorePaspalum',
                'browntopBent': 'creepingBentgrass'  // Use bentgrass tissue concentrations
            };
            return NUTRIENT_KEY_MAP[canonicalKey] || canonicalKey;
        },

        /**
         * Get the SPECIES_ALIASES map (read-only)
         * For modules that need to build their own lookup tables
         * @returns {object}
         */
        getAliases: function() {
            return Object.assign({}, SPECIES_ALIASES);
        }
    };

    // =========================================================================
    // EXPORT
    // =========================================================================

    global.SpeciesController = SpeciesController;

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SpeciesController.init());
    } else {
        SpeciesController.init();
    }

})(window);
