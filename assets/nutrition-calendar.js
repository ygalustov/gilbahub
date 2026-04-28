/**
 * Gilba Nutrition Calendar Module v2.1.0
 * 
 * Full annual nutrition programming with GP-weighted distribution.
 * Integrates with Hub's SSOT architecture - reads from GAIP_STATE.
 * 
 * Features:
 * - 12-month nutrient calendar (N, P, K, Ca, Mg, S)
 * - GP-weighted distribution using Climate Engine data
 * - MLSN deficit correction spread over years
 * - N-driven nutrient demand (research-backed ratios)
 * - Clipping management awareness (collected vs returned)
 * 
 * Research basis:
 * - Zhou & Soldat (2021): Tissue N ~3.9% in bentgrass, clipping removal = primary N output
 * - Kussow et al. (2012): N removal scales linearly with N input up to very high rates
 * - Law et al. (2016): ~73% N recovery in clippings at moderate fertility
 * - Soldat & Petrovic (2008): P removal 2-15 kg/ha/yr depending on management
 * - PACE Turf GP model: Temperature-based growth potential for distribution
 * 
 * @package Gilba_Hub
 * @version 2.1.0
 * @since 10.2.0
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CONFIG = {
        version: '2.4.0',
        
        // MLSN thresholds (ppm) - Micah Woods / PACE Turf
        // Minimum Level for Sustainable Nutrition - evidence-based minimums
        mlsnThresholds: { P: 21, K: 37, Ca: 331, Mg: 47, S: 6 },
        
        // SLAN thresholds (ppm) - Sufficiency Level of Available Nutrients
        // Traditional "sufficiency" approach - higher targets
        // Sources: Carrow et al. (2001), PACE Turf historical data
        slanThresholds: { P: 40, K: 117, Ca: 750, Mg: 120, S: 12 },

        // Ammonium Acetate thresholds (Hill Labs NZ)
        // Upper bound of "low" range = minimum sufficiency threshold
        // Soil texture-dependent for K and Mg (sands vs others)
        // P uses Olsen extraction (mg/L, equivalent to ppm for soil)
        // Source: Hill Labs NZ standard soil test interpretation ranges
        aaThresholds: {
            sands:  { P: 12, K: 75,  Ca: 500, Mg: 100, S: 30 },
            others: { P: 12, K: 100, Ca: 500, Mg: 140, S: 30 }
        },
        
        // Years to spread deficit correction
        yearsToCorrect: { P: 2, K: 2, Ca: 3, Mg: 3, S: 2 },
        
        // Default soil parameters
        defaultSoilDepth: 10,  // cm
        defaultBulkDensity: 1.4,  // g/cm³
        
        // GP calculation parameters (PACE Turf)
        gpParams: {
            c3: { optimalTemp: 20, sigma: 5.5 },
            c4: { optimalTemp: 31, sigma: 7 }
        },
        
        // Minimum GP to allocate nutrients
        minGpThreshold: 0.10,
        
        // ====================================================================
        // ANNUAL N REFERENCE VALUES (for user guidance only)
        // ====================================================================
        // These are NOT defaults - user must enter their target.
        // Shown as hints in the UI to help users choose appropriate values.
        //
        // Research basis:
        // - Schlossberg & Schmidt (2007): 244+ kg N/ha for quality on push-up greens
        // - Wisconsin research: 140-190 kg N/ha for good quality
        // - STRI (UK): 200-300 kg N/ha for intensively used PRG sports turf
        // - PACE Turf GP model: scales with growth potential
        //
        // Actual requirements vary significantly by:
        // - Soil type / CEC / leaching potential
        // - Species (PRG needs more than bent)
        // - Use intensity and quality expectations
        // - Budget constraints
        // ====================================================================
        annualNDefaults: {
            // Reference values only - user enters actual target
            greens:         100,   // Typical range: 80-150
            golf_greens:    100,
            tees:           150,   // Typical range: 120-180
            fairways:       150,   // Typical range: 150-250
            sports:         180,   // Typical range: 180-350
            cricket_wickets: 120,
            bowling_greens: 100,
            landscaping:    120,
            lawn:           100,
        },
        
        // ====================================================================
        // NUTRIENT RATIOS RELATIVE TO N (research-backed)
        // ====================================================================
        // Tissue composition determines nutrient demand ratios
        // When you apply N, plant demands other nutrients proportionally
        //
        // Research basis:
        // - Typical cool-season tissue: 4% N, 0.4% P, 2% K (Turner & Hummel 1992)
        // - N:P:K tissue ratio approximately 10:1:5
        // - Ca, Mg, S from various extension sources
        // ====================================================================
        nutrientRatiosToN: {
            P: 0.10,    // P = 10% of N (tissue ~0.4% P vs 4% N)
            K: 0.55,    // K = 55% of N (tissue ~2% K vs 4% N) 
            Ca: 0.17,   // Ca = 17% of N
            Mg: 0.08,   // Mg = 8% of N
            S: 0.05,    // S = 5% of N
        },
        
        // ====================================================================
        // CLIPPING MANAGEMENT IMPACT
        // ====================================================================
        // When clippings are returned, nutrients are recycled
        // Research: Kopp & Guillard (2002), Qian et al. (2003)
        // 
        // NOTE: N factor is 1.0 for both modes. The user's N target already
        // accounts for their site conditions (clipping management, leaching,
        // soil type, etc.). We don't second-guess their input.
        // P/K factors remain for informational purposes only.
        // ====================================================================
        clippingManagement: {
            collected: {
                // All removed nutrients must be replaced
                nFactor: 1.0,
                pFactor: 1.0,
                kFactor: 1.0,
            },
            returned: {
                // User's N target is respected - no automatic reduction
                // P/K factors for reference only (not currently applied)
                nFactor: 1.0,   // No adjustment - user knows their site
                pFactor: 0.4,   // Reference: 60% recycling efficiency
                kFactor: 0.5,   // Reference: 50% recycling efficiency
            },
        },
        
        // Traffic modifiers (affects wear/recovery, hence nutrient demand)
        trafficModifiers: { low: 0.85, moderate: 1.0, high: 1.15, extreme: 1.3 },
        
        // Month names
        monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        
        // Season mapping (Southern Hemisphere)
        seasonsSouth: {
            0: 'Summer', 1: 'Summer', 2: 'Autumn', 3: 'Autumn', 4: 'Autumn',
            5: 'Winter', 6: 'Winter', 7: 'Winter', 8: 'Spring', 9: 'Spring', 10: 'Spring', 11: 'Summer'
        },
        // Season mapping (Northern Hemisphere)
        seasonsNorth: {
            0: 'Winter', 1: 'Winter', 2: 'Spring', 3: 'Spring', 4: 'Spring',
            5: 'Summer', 6: 'Summer', 7: 'Summer', 8: 'Autumn', 9: 'Autumn', 10: 'Autumn', 11: 'Winter'
        }
    };

    // ========================================================================
    // MODULE STATE
    // ========================================================================

    const NutritionCalendar = {
        program: null,
        elements: {},
        config: CONFIG,
    };

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    NutritionCalendar.init = function() {
        const container = document.querySelector('[data-nutrition-calendar-module]');
        if (!container) {
            return;
        }

        this.elements = {
            container: container,
            results: container.querySelector('[data-nutrition-results]'),
            calendar: container.querySelector('[data-nutrition-calendar]'),
            summary: container.querySelector('[data-nutrition-summary]'),
            generateBtn: container.querySelector('[data-nutrition-generate]'),
            distributionSelect: container.querySelector('.gaip-nutrition-distribution'),
            annualNInput: container.querySelector('.gaip-nutrition-annual-n'),
            maxNInput: container.querySelector('.gaip-nutrition-max-n'),
            clippingSelect: container.querySelector('.gaip-nutrition-clipping'),
        };

        this.bindEvents();
    };

    NutritionCalendar.bindEvents = function() {
        if (this.elements.generateBtn) {
            this.elements.generateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.generate();
            });
        }
    };

    // ========================================================================
    // DATA EXTRACTION FROM HUB STATE
    // ========================================================================

    /**
     * Extract all required data from GAIP_STATE
     */
    NutritionCalendar.collectFromState = function() {
        const state = window.GAIP_STATE || {};
        const climate = window.climateMetrics || state.climate || {};
        
        // Location — DOM is always authoritative for current site lat.
        // state.location is never populated; climateMetrics.latitude may be stale
        // (still holding the previous site's weather data before the climate engine re-runs).
        const domLat = parseFloat(document.querySelector('.gaip-lat')?.value);
        const lat = (!isNaN(domLat) && domLat !== 0 ? domLat : null) ||
                    (state.inputs?.site?.latitude != null ? state.inputs?.site?.latitude : null) ||
                    climate.latitude ||
                    null;
        // Only treat as southern if we have a real negative lat — never assume hemisphere.
        const hemisphere = (lat !== null && lat < 0) ? 'south' : 'north';
        
        // Species - prioritize effectiveSpecies from turf profile (set by orchestrator)
        const rawSpecies = state.turf?.effectiveSpecies || 
                          state.turf?.grassSpecies || 
                          state.grassSpecies ||
                          window.GAIP_CANONICAL_STATE?.turf?.effectiveSpeciesKey ||
                          window.GAIP_CANONICAL_STATE?.turf?.speciesKey ||
                          // Do NOT default to ryegrass — read from DOM as last resort
                          (function() {
                              const domSpecies = document.querySelector('.gaip-grass-species')?.value ||
                                               document.querySelector('[name="grassSpecies"]')?.value;
                              return domSpecies || 'creepingBentgrass'; // neutral fallback, not C3 ryegrass
                          })();
        const species = this.normalizeSpecies(rawSpecies);
        const isC4 = this.isC4Species(species);
        
        // Soil values (ppm)
        // b35fix282: include micronutrients so Mulder's interaction checker
        // has the full nutrient panel (Fe, Mn, Zn, Cu needed for ratio checks)
        const soil = state.soil || {};
        const soilPpm = {
            P: this.extractPpm(soil, 'P'),
            K: this.extractPpm(soil, 'K'),
            Ca: this.extractPpm(soil, 'Ca'),
            Mg: this.extractPpm(soil, 'Mg'),
            S: this.extractPpm(soil, 'S'),
            Fe: this.extractPpm(soil, 'Fe'),
            Mn: this.extractPpm(soil, 'Mn'),
            Zn: this.extractPpm(soil, 'Zn'),
            Cu: this.extractPpm(soil, 'Cu'),
        };
        
        // Soil parameters
        const bulkDensity = parseFloat(soil.bulkDensity) || CONFIG.defaultBulkDensity;
        const soilDepth = parseFloat(soil.depth) || CONFIG.defaultSoilDepth;
        
        // Methodology
        // Cotula/bowls: force ammonium_acetate regardless of what soil.methodology says.
        // The HubStore initialises inputs.soil.methodology as 'mlsn' and it may not
        // be updated by the time the calendar runs. Read from DOM select directly
        // as the reliable source for NZ sites with AA auto-selected.
        let methodology = soil.methodology || 'mlsn';
        // Map cotula_s78 to ammonium_acetate
        if (methodology === 'cotula_s78' || methodology === 'cotula') {
            methodology = 'ammonium_acetate';
        }
        // If turfType is bowls or cotula is active, force AA regardless
        if (methodology === 'mlsn') {
            const _tpc = window.GaipTurfProfile?.state || window.gaipTurfProfile?.state || {};
            const _gt  = window.GAIP_STATE?.turf || {};
            if (_tpc.turfType === 'bowls' || _gt.turfType === 'bowls' || _gt.cotula === true) {
                methodology = 'ammonium_acetate';
            } else {
                // Also read DOM select as fallback — most reliable for AA auto-select
                const _ms = document.querySelector('.gaip-soil-methodology');
                if (_ms && _ms.value && _ms.value !== 'mlsn') {
                    methodology = _ms.value;
                }
            }
        }
        
        // Monthly temperatures from climate engine
        const monthlyTemps = this.extractMonthlyTemps(climate, state);
        
        // User overrides from form
        const annualNOverride = parseFloat(this.elements.annualNInput?.value) || null;
        const maxNPerMonth = parseFloat(this.elements.maxNInput?.value) || 50;
        const distribution = this.elements.distributionSelect?.value || 'gp_weighted';
        
        // Traffic
        const traffic = state.turf?.traffic || 'moderate';
        
        // Clipping management - default based on surface type
        // Greens typically collect, fairways/sports typically return
        const surfaceType = state.soil?.surfaceType || state.turf?.subCategory || 'sports';
        const defaultClippingMgmt = ['greens', 'golf_greens', 'bowling_greens', 'tees'].includes(surfaceType) 
            ? 'collected' : 'returned';
        const clippingManagement = this.elements.clippingSelect?.value || state.turf?.clippingManagement || defaultClippingMgmt;
        
        return {
            hemisphere,
            latitude: lat,
            species,
            isC4,
            soilPpm,
            bulkDensity,
            soilDepth,
            methodology,
            monthlyTemps,
            annualNOverride,
            maxNPerMonth,
            distribution,
            traffic,
            surfaceType,
            clippingManagement,
        };
    };

    /**
     * Extract ppm value handling nested structure
     */
    NutritionCalendar.extractPpm = function(soil, nutrient) {
        // Try direct ppm object
        if (soil.ppm && soil.ppm[nutrient] !== undefined) {
            return parseFloat(soil.ppm[nutrient]) || 0;
        }
        // Try direct property
        if (soil[nutrient] !== undefined) {
            return parseFloat(soil[nutrient]) || 0;
        }
        return 0;
    };

    /**
     * Sync soil data from DOM inputs to GAIP_STATE
     * Ensures state is current before generating program
     */
    NutritionCalendar.syncSoilFromDOM = function() {
        // Ensure GAIP_STATE exists and has a writable soil object
        if (!window.GAIP_STATE) window.GAIP_STATE = {};

        // Always create a fresh local soil object to avoid frozen/replaced state issues
        var soilState = {};
        try {
            // Carry over existing ppm values if present
            var existing = window.GAIP_STATE.soil;
            if (existing && existing.ppm) {
                soilState = { ppm: Object.assign({}, existing.ppm) };
            } else {
                soilState = { ppm: {} };
            }
        } catch(e) {
            soilState = { ppm: {} };
        }

        // Read nutrient values from DOM inputs with data-mlsn attributes
        const nutrients = ['P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Cu', 'Zn', 'Na'];
        nutrients.forEach(nutrient => {
            const input = document.querySelector(`[data-mlsn="${nutrient}"]`);
            if (input && input.value) {
                const value = parseFloat(input.value);
                if (!isNaN(value)) {
                    soilState.ppm[nutrient] = value;
                    soilState[nutrient] = value;
                }
            }
        });

        // Read remaining soil fields into soilState BEFORE write-back
        const cecInput = document.querySelector('.gaip-cec');
        if (cecInput && cecInput.value) {
            const cec = parseFloat(cecInput.value);
            if (!isNaN(cec)) soilState.cec = cec;
        }

        const bdInput = document.querySelector('.gaip-bulk-density, [name="bulk-density"]');
        if (bdInput && bdInput.value) {
            const bd = parseFloat(bdInput.value);
            if (!isNaN(bd)) soilState.bulkDensity = bd;
        }

        const methodSelect = document.querySelector('[name="soil-methodology"], .gaip-soil-methodology');
        if (methodSelect && methodSelect.value) {
            soilState.methodology = methodSelect.value;
        }

        const surfaceSelect = document.querySelector('.gaip-surface-type');
        if (surfaceSelect && surfaceSelect.value) {
            soilState.surfaceType = surfaceSelect.value;
        }

        // Single write-back — all fields collected, one assignment
        try {
            window.GAIP_STATE.soil = soilState;
        } catch(e) {
            window.GAIP_STATE = Object.assign({}, window.GAIP_STATE, { soil: soilState });
        }
    };

    /**
     * Extract monthly temperatures from various sources
     */
    NutritionCalendar.extractMonthlyTemps = function(climate, state) {
        // Try climate engine monthly temps
        if (climate.monthlyTemps && Object.keys(climate.monthlyTemps).length === 12) {
            return climate.monthlyTemps;
        }
        
        // Try state.climate
        if (state.climate?.monthlyTemps) {
            return state.climate.monthlyTemps;
        }
        
        // Generate from latitude (fallback)
        // DOM is authoritative — climateMetrics.latitude may be stale from prior site.
        const _domLat = parseFloat(document.querySelector('.gaip-lat')?.value);
        const rawLat = (!isNaN(_domLat) && _domLat !== 0 ? _domLat : null) ||
                       climate.latitude ||
                       null;
        const absLat = rawLat !== null ? Math.abs(rawLat) : 20; // 20 tropical default
        const isSouthern = rawLat !== null ? rawLat < 0 : false;
        return this.estimateMonthlyTemps(absLat, isSouthern);
    };

    /**
     * Estimate monthly temps from latitude
     */
    NutritionCalendar.estimateMonthlyTemps = function(absLat, isSouthern) {
        // Mean annual temperature by latitude band (northern hemisphere reference)
        // Tropics (0-15°): ~27°C mean | Subtropics (15-30°): ~22°C | Temperate (30-45°): ~15°C | Cool (45+): ~8°C
        let meanTemp;
        if (absLat < 15)       { meanTemp = 27; }
        else if (absLat < 25)  { meanTemp = 24; }
        else if (absLat < 35)  { meanTemp = 18; }
        else if (absLat < 45)  { meanTemp = 13; }
        else                   { meanTemp = 7; }

        // Seasonal amplitude: near zero at equator, ~12°C at 35°, ~18°C at 50°+
        // amplitude = 0.5 * (max_monthly_T - min_monthly_T)
        const amplitude = Math.max(1, Math.min(18, absLat * 0.42 - 2));

        const temps = {};
        for (let m = 0; m < 12; m++) {
            // For northern hemisphere: peak warmth July (m=6), trough January (m=0)
            // cos(0) = 1 at m=6 (NH summer) when monthOffset=0
            const monthOffset = isSouthern ? 6 : 0;
            const adjustedMonth = (m + monthOffset) % 12;
            const factor = Math.cos((adjustedMonth - 6) * Math.PI / 6);
            temps[m] = meanTemp + amplitude * factor;
        }
        return temps;
    };

    /**
     * Normalize species name to key
     */
    NutritionCalendar.normalizeSpecies = function(species) {
        // Delegate to SpeciesController (single source of truth for species identity)
        // Then map to the nutrition calendar's internal keys
        if (window.SpeciesController) {
            const canonical = window.SpeciesController.normalize(species);
            // Map SpeciesController canonical keys to nutrient demand engine keys
            return window.SpeciesController.toNutrientKey(canonical);
        }
        
        // Fallback if SpeciesController not loaded (shouldn't happen in production)
        if (!species) return 'perennialRyegrass';
        if (typeof species === 'object') {
            species = species.name || species.species || species.grassSpecies || 'perennialRyegrass';
        }
        if (typeof species !== 'string') return 'perennialRyegrass';
        
        const cleanedKey = species.toLowerCase().replace(/\s*\([^)]*\)/g, '').replace(/[\s-]+/g, '');
        const mapping = {
            'perennialryegrass': 'perennialRyegrass',
            'creepingbentgrass': 'bentgrass',
            'creepingbent': 'bentgrass',
            'browntopbent': 'bentgrass',
            'bentgrass': 'bentgrass',
            'annualbluegrass': 'poaAnnua',
            'poaannua': 'poaAnnua',
            'kentuckybluegrass': 'kentuckyBluegrass',
            'tallfescue': 'tallFescue',
            'finefescue': 'fineFescue',
            'bermuda': 'bermuda',
            'couch': 'couch',
            'zoysia': 'zoysiagrass',
            'kikuyu': 'kikuyu',
            'buffalo': 'buffalo',
            'paspalum': 'seashorePaspalum',
        };
        return mapping[cleanedKey] || 'perennialRyegrass';
    };

    /**
     * Check if species is C4
     */
    NutritionCalendar.isC4Species = function(species) {
        const c4Species = ['bermuda', 'couch', 'zoysiagrass', 'kikuyu', 'buffalo', 'seashorePaspalum', 'mixedWarm'];
        return c4Species.includes(species);
    };

    /**
     * Get surface type modifier for removal rates
     * Greens have lower removal rates due to:
     * - Very low height of cut (less biomass)
     * - Clippings often removed (less nutrient cycling)
     * - Slower growth rates maintained
     * 
     * Research basis: 
     * - Greens typically need 100-150 kg N/ha/yr vs 150-200 for fairways
     * - USGA recommends 73-146 kg N/ha/yr for bentgrass greens
     * 
     * @deprecated v2.1.0 - Now using direct N defaults by surface type (CONFIG.annualNDefaults)
     */
    NutritionCalendar.getSurfaceModifier = function(surfaceType) {
        // DEPRECATED: Kept for backwards compatibility
        // v2.1+ uses CONFIG.annualNDefaults directly
        if (!surfaceType) return 1.0;
        
        const surface = surfaceType.toLowerCase().replace(/[\s-]/g, '_');
        
        // Surface modifiers based on typical management intensity and biomass removal
        const modifiers = {
            // Fine turf - very low HOC, intensive management
            'greens': 0.7,
            'golf_greens': 0.7,
            'putting_green': 0.7,
            'bowling_greens': 0.75,
            'cricket_wickets': 0.75,
            
            // Medium turf
            'tees': 0.85,
            'low_cut': 0.85,
            'approaches': 0.85,
            
            // Standard turf - baseline
            'fairways': 1.0,
            'sports': 1.0,
            'sports_fields': 1.0,
            'landscaping': 0.9,
            'lawns': 0.9,
        };
        
        return modifiers[surface] || 1.0;
    };

    // ========================================================================
    // CALCULATIONS
    // ========================================================================

    /**
     * Calculate Growth Potential for a temperature
     */
    NutritionCalendar.calculateGP = function(temp, isC4) {
        const params = isC4 ? CONFIG.gpParams.c4 : CONFIG.gpParams.c3;
        const exponent = -0.5 * Math.pow((temp - params.optimalTemp) / params.sigma, 2);
        return Math.exp(exponent);
    };

    /**
     * Calculate monthly GP values
     */
    NutritionCalendar.calculateMonthlyGP = function(monthlyTemps, isC4) {
        const gp = {};
        for (let m = 0; m < 12; m++) {
            const temp = monthlyTemps[m] || 15;
            gp[m] = this.calculateGP(temp, isC4);
        }
        return gp;
    };

    /**
     * Calculate deficit for a nutrient based on methodology (MLSN or SLAN)
     * @param {number} currentPpm - Current soil level
     * @param {string} nutrient - Nutrient name (P, K, Ca, Mg, S)
     * @param {number} bulkDensity - Soil bulk density (g/cm³)
     * @param {number} soilDepth - Soil depth (cm)
     * @param {string} methodology - 'mlsn' or 'slan'
     * @returns {number} Deficit in kg/ha (0 if at or above threshold)
     */
    NutritionCalendar.calculateDeficit = function(currentPpm, nutrient, bulkDensity, soilDepth, methodology = 'mlsn') {
        // Select threshold based on methodology
        const thresholds = this.getThresholds(methodology);
        
        const threshold = thresholds[nutrient];
        if (!threshold || currentPpm >= threshold) return 0;
        
        const deficit = threshold - currentPpm;
        // Convert ppm deficit to kg/ha: ppm × bulk density × depth × 0.1
        const kgHa = deficit * bulkDensity * soilDepth * 0.1;
        return kgHa;
    };
    
    /**
     * Get threshold values for a methodology
     * @param {string} methodology - 'mlsn', 'slan', or 'ammonium_acetate'
     * @returns {object} Threshold values for each nutrient
     */
    NutritionCalendar.getThresholds = function(methodology = 'mlsn') {
        const m = (methodology || 'mlsn').toLowerCase();
        if (m === 'slan') {
            return { ...CONFIG.slanThresholds };
        }
        if (m === 'ammonium_acetate' || m === 'ammoniumacetate' || m === 'aa') {
            // Read soil texture for texture-dependent thresholds
            const textureEl = document.querySelector('.gaip-aa-soil-texture');
            const texture = (textureEl?.value || 'sands').toLowerCase();
            const key = texture === 'others' ? 'others' : 'sands';
            return { ...CONFIG.aaThresholds[key] };
        }
        return { ...CONFIG.mlsnThresholds };
    };

    /**
     * Distribute annual amount by GP weighting
     */
    NutritionCalendar.distributeByGP = function(annualAmount, monthlyGP, method = 'gp_weighted') {
        const allocations = {};
        
        if (method === 'even') {
            // Even distribution
            const monthly = annualAmount / 12;
            for (let m = 0; m < 12; m++) {
                allocations[m] = monthly;
            }
        } else if (method === 'front_loaded') {
            // 60% in spring (months 8-10 south, 2-4 north)
            // Simplified: weight first half more
            const total = annualAmount;
            for (let m = 0; m < 12; m++) {
                const gp = monthlyGP[m] || 0;
                allocations[m] = gp >= CONFIG.minGpThreshold ? total / 10 : 0;
            }
            // Boost spring months
            [8, 9, 10].forEach(m => { allocations[m] *= 1.5; });
        } else {
            // GP-weighted (default)
            let totalGP = 0;
            for (let m = 0; m < 12; m++) {
                if (monthlyGP[m] >= CONFIG.minGpThreshold) {
                    totalGP += monthlyGP[m];
                }
            }
            
            if (totalGP === 0) {
                // Fallback to even
                const monthly = annualAmount / 12;
                for (let m = 0; m < 12; m++) {
                    allocations[m] = monthly;
                }
            } else {
                for (let m = 0; m < 12; m++) {
                    if (monthlyGP[m] >= CONFIG.minGpThreshold) {
                        allocations[m] = annualAmount * (monthlyGP[m] / totalGP);
                    } else {
                        allocations[m] = 0;
                    }
                }
            }
        }
        
        return allocations;
    };

    /**
     * Apply monthly N cap
     */
    NutritionCalendar.applyNCap = function(nAllocations, maxN) {
        const capped = {};
        let totalCapped = 0;
        let originalTotal = 0;
        
        for (let m = 0; m < 12; m++) {
            originalTotal += nAllocations[m] || 0;
            capped[m] = Math.min(nAllocations[m] || 0, maxN);
            totalCapped += capped[m];
        }
        
        return {
            allocations: capped,
            capApplied: totalCapped < originalTotal * 0.99,
            originalTotal: Math.round(originalTotal),
            cappedTotal: Math.round(totalCapped),
        };
    };

    // ========================================================================
    // PROGRAM GENERATION
    // ========================================================================

    /**
     * Generate the full nutrition program
     * 
     * N-driven approach based on research:
     * - Annual N is primary driver (user input or surface-type default)
     * - Other nutrients calculated as ratios of N (tissue composition)
     * - Clipping management affects all nutrient requirements
     * - MLSN deficits added on top for P, K, Ca, Mg, S
     */
    NutritionCalendar.generate = function() {
        
        // Sync soil data from DOM to GAIP_STATE first
        this.syncSoilFromDOM();
        
        const inputs = this.collectFromState();
        
        // ================================================================
        // STEP 1: Validate Annual N (REQUIRED)
        // ================================================================
        // User must enter their N target - we don't guess
        if (!inputs.annualNOverride || inputs.annualNOverride < 50) {
            alert('Please enter your Annual N Target (kg/ha).\n\nTypical ranges:\n• Greens: 80-150\n• Tees: 120-180\n• Fairways: 150-250\n• Sports fields: 180-350');
            if (this.elements.annualNInput) {
                this.elements.annualNInput.focus();
            }
            return;
        }
        
        const baseAnnualN = inputs.annualNOverride;
        
        // Traffic modifier - only applies if explicitly high/extreme
        const trafficMod = CONFIG.trafficModifiers[inputs.traffic] || 1.0;
        const annualN = Math.round(baseAnnualN * trafficMod);
        
        // ================================================================
        // STEP 2: Calculate base nutrient removal (N-driven ratios)
        // ================================================================
        // Based on typical tissue composition ratios
        const baseRemoval = {
            N: annualN,
            P: Math.round(annualN * CONFIG.nutrientRatiosToN.P),
            K: Math.round(annualN * CONFIG.nutrientRatiosToN.K),
            Ca: Math.round(annualN * CONFIG.nutrientRatiosToN.Ca),
            Mg: Math.round(annualN * CONFIG.nutrientRatiosToN.Mg),
            S: Math.round(annualN * CONFIG.nutrientRatiosToN.S),
        };
        
        // ================================================================
        // STEP 3: Apply clipping management factor
        // ================================================================
        const clipMgmt = CONFIG.clippingManagement[inputs.clippingManagement] || CONFIG.clippingManagement.collected;
        const adjustedRemoval = {
            N: Math.round(baseRemoval.N * clipMgmt.nFactor),
            P: Math.round(baseRemoval.P * clipMgmt.pFactor),
            K: Math.round(baseRemoval.K * clipMgmt.kFactor),
            Ca: Math.round(baseRemoval.Ca * clipMgmt.kFactor), // Use K factor for Ca/Mg/S
            Mg: Math.round(baseRemoval.Mg * clipMgmt.kFactor),
            S: Math.round(baseRemoval.S * clipMgmt.kFactor),
        };
        
        // ================================================================
        // STEP 4: Calculate deficits and correction based on methodology
        // ================================================================
        const deficits = {};
        const annualCorrection = {};
        const methodologyUsed = inputs.methodology || 'mlsn';
        
        
        ['P', 'K', 'Ca', 'Mg', 'S'].forEach(nutrient => {
            const deficit = this.calculateDeficit(
                inputs.soilPpm[nutrient],
                nutrient,
                inputs.bulkDensity,
                inputs.soilDepth,
                methodologyUsed
            );
            deficits[nutrient] = deficit;
            annualCorrection[nutrient] = deficit / (CONFIG.yearsToCorrect[nutrient] || 2);
        });
        
        // ================================================================
        // STEP 5: Calculate final annual requirements
        // ================================================================
        // Removal (adjusted for clipping management) + deficit correction
        // N: Apply clipping factor to reduce applied N when clippings returned
        // Research: Kopp & Guillard (2002) - 33-50% N reduction with clipping return
        const adjustedAnnualN = Math.round(annualN * clipMgmt.nFactor);
        
        const annualRequirements = {
            N: adjustedAnnualN,
            P: Math.round(adjustedRemoval.P + annualCorrection.P),
            K: Math.round(adjustedRemoval.K + annualCorrection.K),
            Ca: Math.round(adjustedRemoval.Ca + annualCorrection.Ca),
            Mg: Math.round(adjustedRemoval.Mg + annualCorrection.Mg),
            S: Math.round(adjustedRemoval.S + annualCorrection.S),
        };
        
        // Calculate monthly GP
        const monthlyGP = this.calculateMonthlyGP(inputs.monthlyTemps, inputs.isC4);
        const distributions = {};
        Object.keys(annualRequirements).forEach(nutrient => {
            distributions[nutrient] = this.distributeByGP(
                annualRequirements[nutrient],
                monthlyGP,
                inputs.distribution
            );
        });
        
        // Apply N cap
        const nCapResult = this.applyNCap(distributions.N, inputs.maxNPerMonth);
        distributions.N = nCapResult.allocations;
        
        // Build monthly program
        const seasons = inputs.hemisphere === 'south' ? CONFIG.seasonsSouth : CONFIG.seasonsNorth;
        const monthly = [];
        
        for (let m = 0; m < 12; m++) {
            monthly.push({
                month_num: m,
                month_name: CONFIG.monthNames[m],
                season: seasons[m],
                gp: Math.round(monthlyGP[m] * 100) / 100,
                temp: Math.round((inputs.monthlyTemps[m] || 15) * 10) / 10,
                N: Math.round(distributions.N[m] * 10) / 10,
                P: Math.round(distributions.P[m] * 10) / 10,
                K: Math.round(distributions.K[m] * 10) / 10,
                Ca: Math.round(distributions.Ca[m] * 10) / 10,
                Mg: Math.round(distributions.Mg[m] * 10) / 10,
                S: Math.round(distributions.S[m] * 10) / 10,
            });
        }
        
        // Build program object
        this.program = {
            meta: {
                generated: new Date().toISOString(),
                version: CONFIG.version,
                methodology: inputs.methodology.toUpperCase(),
                species: inputs.species,
                surfaceType: inputs.surfaceType,
                hemisphere: inputs.hemisphere,
                distribution: inputs.distribution,
                clippingManagement: inputs.clippingManagement,
            },
            soil: {
                ppm: inputs.soilPpm,
                deficits: deficits,
                methodology: inputs.methodology,
            },
            annual_totals: annualRequirements,
            adjustments: {
                n_cap_applied: nCapResult.capApplied,
                original_n_total: nCapResult.originalTotal,
                capped_n_total: nCapResult.cappedTotal,
                traffic_modifier: trafficMod,
                clipping_management: inputs.clippingManagement,
                clipping_factors: clipMgmt,
                target_n: annualN,           // Pre-clipping target
                applied_n: adjustedAnnualN,  // Post-clipping (what's actually applied)
                n_recycled: annualN - adjustedAnnualN, // N returned via clippings
            },
            program: {
                monthly: monthly,
            },
        };
        
        
        // Render results
        this.renderResults();
        this.showResults();
        
        // Dispatch event for Prebble integration
        console.log('[NutritionCalendar] Dispatching gaip:nutrition-calendar-generated — program keys:', Object.keys(this.program || {}));
        document.dispatchEvent(new CustomEvent('gaip:nutrition-calendar-generated', {
            detail: { program: this.program }
        }));
        
        return this.program;
    };

    // ========================================================================
    // RENDERING
    // ========================================================================

    NutritionCalendar.renderResults = function() {
        if (!this.program) return;
        
        this.renderSummary();
        this.renderCalendar();
    };

    NutritionCalendar.renderSummary = function() {
        const summary = this.elements.summary;
        if (!summary) return;
        
        const p = this.program;
        const totals = p.annual_totals;
        const meta = p.meta;
        
        summary.innerHTML = `
            <div class="gilba-nutrition-summary" style="margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px;">
                    <div style="padding: 12px; background: var(--gaip-good-bg); border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: var(--gaip-text); text-transform: uppercase;">Species</div>
                        <div style="font-size: 14px; font-weight: 600; color: #166534;">${this.formatSpecies(meta.species)}</div>
                    </div>
                    <div style="padding: 12px; background: var(--gaip-info-bg); border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: var(--gaip-text); text-transform: uppercase;">Methodology</div>
                        <div style="font-size: 14px; font-weight: 600; color: #1e40af;">${this.formatMethodology(meta.methodology)}</div>
                    </div>
                    <div style="padding: 12px; background: var(--gaip-warning-bg); border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: var(--gaip-text); text-transform: uppercase;">Distribution</div>
                        <div style="font-size: 14px; font-weight: 600; color: #92400e;">${this.formatDistribution(meta.distribution)}</div>
                    </div>
                    <div style="padding: 12px; background: var(--gaip-info-bg); border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: var(--gaip-text); text-transform: uppercase;">Clippings</div>
                        <div style="font-size: 14px; font-weight: 600; color: #6b21a8;">${meta.clippingManagement === 'collected' ? '🗑️ Collected' : '♻️ Returned'}</div>
                        ${p.adjustments.n_recycled > 0 ? `<div style="font-size: 11px; color: #059669; margin-top: 4px;">↻ ${p.adjustments.n_recycled} kg N/ha recycled</div>` : ''}
                    </div>
                </div>
                
                ${p.adjustments.n_recycled > 0 ? `
                    <div style="margin: 12px 0; padding: 10px; background: var(--gaip-good-bg); border-left: 3px solid #10b981; border-radius: 4px; font-size: 12px; color: #065f46;">
                        <strong>♻️ Clipping Recycling:</strong> 
                        Target ${p.adjustments.target_n} kg N/ha reduced to <strong>${p.adjustments.applied_n} kg N/ha</strong> applied 
                        (${p.adjustments.n_recycled} kg N/ha returned via clippings).
                        <span style="color: var(--gaip-text); font-style: italic;">Ref: Kopp & Guillard 2002</span>
                    </div>
                ` : ''}
                
                <h4 style="margin: 16px 0 8px; font-size: 14px; color: var(--gaip-text);">Annual Requirements (kg/ha)</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: var(--gaip-surface-hover);">
                            <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">N</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">P</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">K</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">Ca</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">Mg</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">S</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border); font-weight: 600;">${totals.N}</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">${totals.P}</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">${totals.K}</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">${totals.Ca}</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">${totals.Mg}</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">${totals.S}</td>
                        </tr>
                    </tbody>
                </table>
                
                ${p.adjustments.n_cap_applied ? `
                    <div style="margin-top: 12px; padding: 10px; background: var(--gaip-warning-bg); border-radius: 6px; font-size: 12px; color: #92400e;">
                        <strong>⚠️ Monthly N caps applied:</strong> 
                        Original ${p.adjustments.original_n_total} kg/ha → Capped ${p.adjustments.capped_n_total} kg/ha
                    </div>
                ` : ''}
            </div>
        `;
    };

    NutritionCalendar.renderCalendar = function() {
        const calendar = this.elements.calendar;
        if (!calendar || !this.program) return;

        const monthly = this.program.program.monthly;

        const rows = monthly.map(m => {
            const gpPct = Math.round(m.gp * 100);
            const gpClass = gpPct >= 50 ? 'high' : (gpPct >= 25 ? 'medium' : 'low');
            const gpColor = gpPct >= 50 ? '#166534' : (gpPct >= 25 ? '#ca8a04' : '#dc2626');
            
            return `
                <tr>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); font-weight: 500;">${m.month_name}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); color: var(--gaip-text);">${m.season}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; background: ${gpColor}20; color: ${gpColor}; font-weight: 600; font-size: 12px;">
                            ${gpPct}%
                        </span>
                    </td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right; font-weight: 600;">${m.N.toFixed(1)}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${m.P.toFixed(1)}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${m.K.toFixed(1)}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${m.Ca.toFixed(1)}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${m.Mg.toFixed(1)}</td>
                    <td style="padding: 8px; border: 1px solid var(--gaip-border); text-align: right;">${m.S.toFixed(1)}</td>
                </tr>
            `;
        }).join('');

        calendar.innerHTML = `
            <h4 style="margin: 16px 0 8px; font-size: 14px; color: var(--gaip-text);">Monthly Nutrient Program (kg/ha)</h4>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 600px;">
                    <thead>
                        <tr style="background: var(--gaip-surface-hover);">
                            <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Month</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid var(--gaip-border);">Season</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid var(--gaip-border);">GP</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">N</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">P</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">K</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">Ca</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">Mg</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid var(--gaip-border);">S</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="gaip-btn" onclick="GilbaNutritionCalendar.exportCSV()" style="padding: 8px 16px; background: var(--gaip-surface-hover); border: 1px solid var(--gaip-border); border-radius: 4px; cursor: pointer; font-size: 13px;">
                    📥 Export CSV
                </button>
            </div>
        `;
    };

    NutritionCalendar.showResults = function() {
        if (this.elements.results) {
            this.elements.results.style.display = 'block';
        }
    };

    // ========================================================================
    // UTILITIES
    // ========================================================================

    NutritionCalendar.formatSpecies = function(species) {
        const names = {
            perennialRyegrass: 'Perennial Ryegrass',
            kentuckyBluegrass: 'Kentucky Bluegrass',
            bentgrass: 'Creeping Bentgrass',
            fineFescue: 'Fine Fescue',
            tallFescue: 'Tall Fescue',
            bermuda: 'Bermudagrass',
            couch: 'Couch',
            zoysiagrass: 'Zoysiagrass',
            kikuyu: 'Kikuyu',
            buffalo: 'Buffalo',
            seashorePaspalum: 'Seashore Paspalum',
        };
        return names[species] || species;
    };

    NutritionCalendar.formatDistribution = function(method) {
        const labels = {
            gp_weighted: 'GP-Weighted',
            even: 'Even Monthly',
            front_loaded: 'Front-Loaded',
        };
        return labels[method] || method;
    };

    NutritionCalendar.formatMethodology = function(methodology) {
        const m = (methodology || 'mlsn').toLowerCase();
        if (m === 'ammonium_acetate' || m === 'ammoniumacetate' || m === 'aa') {
            return 'Ammonium Acetate (Hill Labs NZ)';
        }
        return (methodology || 'MLSN').toUpperCase();
    };

    NutritionCalendar.exportCSV = function() {
        if (!this.program) {
            alert('No program to export. Generate first.');
            return;
        }

        const p = this.program;
        let csv = 'Month,Season,GP (%),N (kg/ha),P (kg/ha),K (kg/ha),Ca (kg/ha),Mg (kg/ha),S (kg/ha)\n';

        p.program.monthly.forEach(m => {
            csv += [
                m.month_name,
                m.season,
                Math.round(m.gp * 100),
                m.N.toFixed(1),
                m.P.toFixed(1),
                m.K.toFixed(1),
                m.Ca.toFixed(1),
                m.Mg.toFixed(1),
                m.S.toFixed(1),
            ].join(',') + '\n';
        });

        // Totals row
        const t = p.annual_totals;
        csv += `TOTAL,,,"${t.N}","${t.P}","${t.K}","${t.Ca}","${t.Mg}","${t.S}"\n`;

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nutrition-program-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    NutritionCalendar.getProgram = function() {
        return this.program;
    };

    // ========================================================================
    // EXPORT
    // ========================================================================

    window.GilbaNutritionCalendar = NutritionCalendar;

    // Auto-init on DOM ready and on analysis complete
    function tryInit() {
        NutritionCalendar.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    // Re-init when results section becomes visible
    document.addEventListener('gaip:analysis-complete', () => {
        setTimeout(tryInit, 100);
    });

})();
