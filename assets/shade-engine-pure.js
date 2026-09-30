/**
 * GILBA SHADE ENGINE - PURE EXTRACTED v3.0.0
 * 
 * Pure-function shade/DLI engine. No DOM reads, no global mutation.
 * Every calculation is a pure function: f(state, weather) → result
 * 
 * Extracted from shade-engine.js v2.2.0.
 * All global fallbacks REMOVED. State injection is the ONLY input path.
 * 
 * Required state fields:
 *   state.turf.species        - grass species string
 *   state.turf.dli            - measured DLI (mol/m²/day), OR
 *   state.shade.morningSky    - sky view fractions for calculation mode
 *   state.site.region         - climate region
 *   state.location.lat        - latitude (determines hemisphere)
 *   state.monthIndex          - 0-11 month override (REQUIRED, no Date() fallback)
 * 
 * Optional state fields:
 *   state.ambientDLI.current  - weather-derived open-field DLI
 *   state.overseedState       - { c3Fraction, overseedSpecies }
 *   state.turfContext          - { dliMinimum, dliTarget, dliOptimal }
 *   state.varietyShadeModifier - { thresholdModifier, confidence, source }
 *   state.turf.pgrActive      - boolean
 *   state.turf.hoc            - current height of cut (mm)
 *   state.turf.plannedNRate   - planned N rate (kg/ha/month)
 *   state.traffic.level       - none/light/moderate/heavy
 * 
 * References:
 *   Bell & Danneberger (1999) - N adjustment under shade
 *   Beard (1973) - Turfgrass science fundamentals
 *   Dudeck & Peacock (1992) - Mowing height in shade
 *   Ervin & Koski (1998) - PGR × shade interaction
 *   Bunnell et al. (2005) - PGR on shaded turf
 *   Wherley, Trappe - DLI thresholds for turfgrass species
 * 
 * @provides gaip_shade_engine_pure(state, weather) → shadeResult
 */

(function(global) {
    'use strict';

    /* ============================================================
       CONSTANTS & LOOKUP TABLES
    ============================================================ */

    // Monthly DLI multipliers for Australian latitudes (Southern Hemisphere)
    // Index 0 = January (peak summer), Index 6 = July (winter minimum)
    const MONTH_DLI_MULT = [
        1.00, 0.94, 0.86, 0.72,  // Jan-Apr
        0.58, 0.52, 0.52, 0.58,  // May-Aug
        0.72, 0.86, 0.94, 1.00   // Sep-Dec
    ];

    /* ============================================================
       MOWING HEIGHT CONSTANTS
       Reference: Beard (1973), Dudeck & Peacock (1992), Bell et al. (2000)
       Heights in mm - SPORTS TURF appropriate ranges
       
       Note: These values are calibrated for professional sports surfaces.
       Higher cut heights would compromise ball roll and playability.
    ============================================================ */

    const SPECIES_MOWING = {
        // C3 grasses - sports turf HOC ranges
        'PRG': { min: 18, standard: 25, max: 35, shadeMax: 40 },
        'ryegrass': { min: 18, standard: 25, max: 35, shadeMax: 40 },
        'bentgrass': { min: 3, standard: 4, max: 8, shadeMax: 10 },
        'poa': { min: 3, standard: 4, max: 8, shadeMax: 10 },
        'fescue': { min: 20, standard: 30, max: 40, shadeMax: 45 },
        'TFescue': { min: 25, standard: 35, max: 45, shadeMax: 50 },
        
        // C4 grasses - sports turf HOC ranges
        'couch': { min: 10, standard: 15, max: 22, shadeMax: 28 },
        'bermuda': { min: 10, standard: 15, max: 22, shadeMax: 28 },
        'kikuyu': { min: 18, standard: 25, max: 35, shadeMax: 45 },
        'zoysia': { min: 12, standard: 18, max: 25, shadeMax: 32 },
        'buffalo': { min: 20, standard: 30, max: 40, shadeMax: 50 },
        'paspalum': { min: 12, standard: 20, max: 28, shadeMax: 35 },
        
        'default': { min: 18, standard: 25, max: 35, shadeMax: 40 }
    };

    /* ============================================================
       N ADJUSTMENT CONSTANTS
       Reference: Bell & Danneberger (1999), Beard (1973), Stier & Gardner (2008)
       Reduction factors based on DLI deficit percentage
    ============================================================ */

    const N_REDUCTION_FACTORS = {
        // deficitPct ranges → N reduction multiplier
        // Lower photosynthesis = less N utilisation capacity
        thresholds: [
            { maxDeficit: 15, factor: 1.00, label: 'Full rate' },
            { maxDeficit: 25, factor: 0.85, label: '15% reduction' },
            { maxDeficit: 40, factor: 0.70, label: '30% reduction' },
            { maxDeficit: 55, factor: 0.55, label: '45% reduction' },
            { maxDeficit: 100, factor: 0.50, label: '50% reduction' }
        ]
    };

    // Regional peak full-sun DLI (mol/m²/day) - clear sky, summer solstice
    const REGION_PEAK_DLI = {
        'tropical': 52,
        'subtropical': 48,
        'warm-temperate': 42,
        'cool-temperate': 36,
        /**
         * GH-783: the `'default': 40` that stood here was a substitution wearing the clothes of a lookup table -
         * `REGION_PEAK_DLI[region] || REGION_PEAK_DLI['default']` reads as a table miss handled, and it is a
         * figure chosen for a site whose region nobody knows. The readers ask for the region's own peak now, and
         * answer nothing when the table has none.
         */
    };

    // CANONICAL DLI THRESHOLDS — other modules should reference these values
    // Source: Compiled research data - Wherley, Trappe, Bunnell, stadium turf studies
    // Structure: { min: survival floor, target: acceptable quality, optimal: high performance/recovery }
    // NOTE: Copies exist in dli-recovery-bridge.js, turf-profile-controller.js,
    // ambient-dli-engine.js (5-tier scale). Keep in sync or consolidate.
    const SPECIES_DLI = {
        // C3 grasses - lower light requirements
        'poa': { min: 7, target: 14, optimal: 20 },  // 6-8 survival, 12-16 quality, 18-22 performance
        'browntopBent': { min: 9, target: 16, optimal: 22 },  // 8-10 survival, 14-18 quality, 20-25 performance
        'colonialBentgrass': { min: 9, target: 16, optimal: 22 },  // Same as browntop
        'PRG': { min: 9, target: 16, optimal: 24 },  // 8-10 survival, 15-18 quality, 22-26 performance
        'ryegrass': { min: 9, target: 16, optimal: 24 },
        'bentgrass': { min: 11, target: 20, optimal: 27 },  // 10-12 survival, 18-22 quality, 25-30 performance (creeping)
        'creepingBentgrass': { min: 11, target: 20, optimal: 27 },
        'fescue': { min: 10, target: 16, optimal: 22 },  // Estimate - similar to PRG
        'TFescue': { min: 10, target: 16, optimal: 22 },
        
        // C4 grasses - higher light requirements (all exceed C3)
        'buffalo': { min: 13, target: 22, optimal: 28 },  // 12-15 survival, 20-24 quality, 26-30 performance
        'staugustine': { min: 13, target: 22, optimal: 28 },  // Same as buffalo
        'zoysia': { min: 16, target: 24, optimal: 31 },  // 14-18 survival, 22-26 quality, 28-34 performance
        'couch': { min: 16, target: 26, optimal: 35 },  // 15-18 survival, 24-28 quality, 30-40 performance
        'bermuda': { min: 16, target: 26, optimal: 35 },
        'kikuyu': { min: 17, target: 26, optimal: 36 },  // 16-18 survival, 25-28 quality, 32-40 performance
        'paspalum': { min: 15, target: 24, optimal: 32 },  // Estimate - between buffalo and bermuda
        
        // Default (conservative C3/C4 blend)
        'default': { min: 12, target: 20, optimal: 26 }
    };
    
    // Critical DLI thresholds (applies to all species)
    // <5: Physiological stress onset
    // <8: Chronic decline inevitable  
    // <12: No recovery under wear
    const CRITICAL_DLI = {
        stressOnset: 5,
        chronicDecline: 8,
        noRecoveryUnderWear: 12
    };

    // Monthly soil temperature profiles by region (°C)
    const SOIL_TEMP_PROFILES = {
        'tropical':       [29, 29, 28, 26, 24, 23, 23, 24, 26, 27, 28, 29],
        'subtropical':    [27, 27, 26, 23, 20, 17, 17, 18, 20, 22, 24, 26],
        'warm-temperate': [26, 26, 24, 20, 16, 13, 12, 14, 17, 20, 23, 25],
        'cool-temperate': [23, 22, 19, 16, 12, 10, 9, 10, 13, 16, 19, 21]
    };

    // Clear sky hourly PAR shape (normalised, hour 0-23)
    const CLEAR_SKY_SHAPE = [
        0, 0, 0, 0, 0,           // 00:00-04:00
        0.04, 0.12, 0.26, 0.42,  // 05:00-08:00
        0.58, 0.74, 0.86, 0.94,  // 09:00-12:00
        1.00, 0.92, 0.84, 0.70,  // 13:00-16:00
        0.54, 0.38, 0.22, 0.10,  // 17:00-20:00
        0.03, 0, 0               // 21:00-23:00
    ];

    /* ============================================================
       UTILITY FUNCTIONS
    ============================================================ */

    // Pure inlined clamp - no global dependency
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function getCurrentMonth(override) {
        if (typeof override === 'number' && override >= 0 && override <= 11) return override;
        throw new Error('shade-engine-pure: state.monthIndex is required (0-11)');
    }

    /**
     * GH-783 (queue item 3vshch) - A REGION NOBODY GAVE IS ABSENT, NOT 'warm-temperate'.
     *
     * The literal stood here as a default and decides real numbers: the region picks the open-field peak DLI
     * below, and from that come the light deficit, the stress verdict and the species advice a person reads. A
     * site whose region never reached the engine was computed as a warm-temperate one and told so with no sign
     * that anything had been assumed. The owner's rule of 17.09.2026: an absent field stays absent, and a
     * default means the data did not arrive - which is what has to be shown rather than covered.
     */
    function getRegion(state) {
        if (state.site && state.site.region) return state.site.region;
        if (state.location && state.location.region) return state.location.region;

        return null;
    }

    /**
     * GH-783 - AND A HEMISPHERE NOBODY GAVE IS ABSENT TOO, not 'south'.
     *
     * `// Default Australian` is what the literal said, and it is the same class as the region above: the
     * hemisphere decides the sun's declination, the months of the renovation window and which half of the year
     * is the growing one. A site with no latitude was answered as a southern one, and nothing on the page said
     * that the answer had been chosen here. Absent stays absent, and the readers below say so.
     */
    function getHemisphere(state) {
        if (state.site && state.site.hemisphere) return state.site.hemisphere;
        if (state.location && state.location.lat !== undefined && state.location.lat !== null) {
            return state.location.lat < 0 ? 'south' : 'north';
        }

        return null;
    }

    function getSpeciesKey(state) {
        var species = '';
        
        // Check for overseed-dominant scenario - use effective species
        if (state.turf) {
            var c3Fraction = (state.turf.species && state.turf.species.c3Fraction) || state.turf.c3Fraction || 0;
            var overseedDominant = c3Fraction > 0.5;
            
            if (overseedDominant && state.turf.effectiveSpecies) {
                species = state.turf.effectiveSpecies.toLowerCase();
            } else if (state.turf.species) {
                species = state.turf.species.toLowerCase();
            }
        }
        
        // Normalise common variants
        if (species.indexOf('rye') >= 0) return 'ryegrass';
        if (species.indexOf('browntop') >= 0 || species.indexOf('colonial') >= 0 || species.indexOf('capillaris') >= 0) return 'browntopBent';
        if (species.indexOf('bent') >= 0) return 'bentgrass';  // Creeping bentgrass fallback
        if (species.indexOf('couch') >= 0 || species.indexOf('bermuda') >= 0) return 'couch';
        if (species.indexOf('kikuyu') >= 0) return 'kikuyu';
        if (species.indexOf('zoysia') >= 0) return 'zoysia';
        if (species.indexOf('buffalo') >= 0 || species.indexOf('augustine') >= 0 || species.indexOf('stenotaphrum') >= 0) return 'buffalo';
        if (species.indexOf('fescue') >= 0) return 'fescue';
        if (species.indexOf('poa') >= 0) return 'poa';
        if (species.indexOf('paspalum') >= 0) return 'paspalum';
        return 'default';
    }

    function isC3Species(speciesKey) {
        return ['ryegrass', 'PRG', 'bentgrass', 'creepingBentgrass', 'browntopBent', 'colonialBentgrass', 'poa', 'fescue', 'TFescue'].indexOf(speciesKey) >= 0;
    }

    function isC4Species(speciesKey) {
        return ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo', 'paspalum'].indexOf(speciesKey) >= 0;
    }

    /* ============================================================
       SOLAR GEOMETRY & DLI CALCULATIONS
    ============================================================ */

    /**
     * Calculate aspect gain modifier based on facade orientation
     * @param {string} aspect - N, S, E, W, NE, NW, SE, SW
     * @param {string} hemisphere - 'north' or 'south'
     * @returns {number} 0.5-1.0 multiplier
     */
    function aspectGain(aspect, hemisphere) {
        var gains = {};
        
        if (hemisphere === 'south') {
            // Southern hemisphere: north-facing = best
            gains = { N: 1.00, NE: 0.92, NW: 0.92, E: 0.85, W: 0.85, SE: 0.70, SW: 0.70, S: 0.60 };
        } else {
            // Northern hemisphere: south-facing = best
            gains = { S: 1.00, SE: 0.92, SW: 0.92, E: 0.85, W: 0.85, NE: 0.70, NW: 0.70, N: 0.60 };
        }
        
        return gains[aspect] || 1.00;
    }

    /**
     * Calculate distance-from-obstruction modifier
     * @param {number} distance - metres from shade source
     * @returns {number} 0.30-1.00 multiplier
     */
    function distanceModifier(distance) {
        var d = Math.max(0, distance || 0);
        // 5% reduction per metre, floor at 30%
        return clamp(1 - 0.05 * d, 0.30, 1.00);
    }

    /**
     * Calculate canopy density modifier
     * @param {number} density - 0-5 scale (0=open, 5=dense)
     * @returns {number} 0.25-1.00 multiplier
     */
    function canopyModifier(density) {
        var d = clamp(density || 0, 0, 5);
        // 12% reduction per unit, floor at 25%
        return clamp(1 - (d * 0.12), 0.25, 1.00);
    }

    /**
     * Calculate geometry/obstruction modifier
     * @param {number} geom - 0-5 scale (0=minimal, 5=severe)
     * @returns {number} 0.50-1.00 multiplier
     */
    function geometryModifier(geom) {
        var g = clamp(geom || 0, 0, 5);
        // 10% reduction per unit, floor at 50%
        return clamp(1 - (g * 0.10), 0.50, 1.00);
    }

    /**
     * Get dynamic minimum light floor based on context
     * @param {string} context - 'trees', 'building', 'stand', 'mixed'
     * @returns {number} minimum transmission factor
     */
    function dynamicMinimum(context) {
        var mins = {
            'trees': 0.10,
            'mixed': 0.15,
            'stand': 0.20,
            'building': 0.18
        };
        return mins[context] || 0.10;
    }

    /**
     * Build hourly light curve based on time-of-day sky fractions
     * @param {number} morningSky - 0-1 morning open sky fraction
     * @param {number} middaySky - 0-1 midday open sky fraction
     * @param {number} afternoonSky - 0-1 afternoon open sky fraction
     * @param {number} monthIdx - 0-11 month index
     * @param {string} aspect - facade aspect
     * @param {string} hemisphere - north/south
     * @returns {Array} 24-element hourly PAR fraction array
     */
    function computeHourlyOpenFraction(morningSky, middaySky, afternoonSky, monthIdx, aspect, hemisphere) {
        var monthScale = MONTH_DLI_MULT[monthIdx] || 0.75;
        var aspectScale = aspectGain(aspect, hemisphere);
        var hourly = [];
        
        for (var h = 0; h < 24; h++) {
            var sky;
            if (h >= 6 && h < 11) sky = morningSky;
            else if (h >= 11 && h < 14) sky = middaySky;
            else if (h >= 14 && h < 18) sky = afternoonSky;
            else sky = 0;
            
            hourly.push(CLEAR_SKY_SHAPE[h] * monthScale * aspectScale * sky);
        }
        
        return hourly;
    }

    /**
     * Calculate DLI from hourly curve
     * @param {Array} hourly - 24-element PAR fraction array
     * @param {string} region - climate region
     * @returns {number} DLI in mol/m²/day
     */
    /**
     * GH-783 (queue item 3vshch, the reviewer's return) - THE SAME INPUT HAS TWO ENTRANCES, AND BOTH ARE CLOSED.
     *
     * The direct-DLI branch stopped substituting a peak of 40, and this one kept doing it through a `'default'`
     * key in the table itself - so a region the table does not know was still worth 40 here. One input, two
     * doors, one closed: the very shape this repository closed for the grass species in GH-782. A region with no
     * peak answers nothing, and the caller shows an outcome instead of a figure about a site that does not exist.
     */
    function DLIfromHourly(hourly, region) {
        var peak = (region && REGION_PEAK_DLI[region] !== undefined) ? REGION_PEAK_DLI[region] : null;
        if (peak === null) return null;
        var sum = hourly.reduce(function(a, b) { return a + b; }, 0);
        // Scale: sum of hourly fractions × peak DLI / 12 (normalisation factor)
        return +(sum * (peak / 12)).toFixed(1);
    }

    /**
     * Apply full shading system with all modifiers
     * @param {Array} hourlyOpen - baseline hourly curve
     * @param {object} shadeInputs - canopy, geom, distance, aspect, context
     * @param {string} hemisphere - north/south
     * @returns {object} { shaded: Array, globalMod: number }
     */
    function applyShadingSystem(hourlyOpen, shadeInputs, hemisphere) {
        var c = canopyModifier(shadeInputs.canopy);
        var g = geometryModifier(shadeInputs.geometry);
        var d = distanceModifier(shadeInputs.distance);
        var a = aspectGain(shadeInputs.aspect || 'N', hemisphere);
        
        var raw = c * g * d * a;
        var floor = dynamicMinimum(shadeInputs.context || 'mixed');
        var globalMod = clamp(raw, floor, 1.00);
        
        var shaded = hourlyOpen.map(function(v) { return v * globalMod; });
        
        return { shaded: shaded, globalMod: globalMod };
    }

    /* ============================================================
       SPECIES DECISION ENGINE
    ============================================================ */

    /**
     * Get soil temperature for month and region
     */
    /**
     * GH-783 - AND A THIRD ENTRANCE OF THE SAME REGION, which nobody had named at all.
     *
     * Two substitutions in three lines: a region the profiles do not know was computed as warm-temperate, and a
     * month with no figure in its profile was worth 18 degrees. The region arrives from the site's config as a
     * free string and is checked against no list of keys, so the first of the two was reachable by a typo. The
     * comment on the direct-DLI branch already calls this shape a defect; it is the same one, one function along.
     */
    function getSoilTemp(region, monthIdx) {
        var profile = (region && SOIL_TEMP_PROFILES[region]) || null;
        if (!profile) return null;
        var t = profile[monthIdx];

        return (t === undefined || t === null) ? null : t;
    }

    /**
     * Determine optimal species strategy based on DLI and temperature
     * @param {string} baseType - existing species type
     * @param {number} dliShaded - actual DLI received
     * @param {number} monthIdx - 0-11
     * @param {string} traffic - none/light/moderate/heavy
     * @param {string} region - climate region
     * @returns {object} { mode, reason, targetDLI, confidence }
     */
    function speciesDecision(baseType, dliShaded, monthIdx, traffic, region) {
        /**
         * GH-783: a soil temperature nobody can give is not a cold one. `getSoilTemp` answers `null` for a region
         * the profiles do not know, and every comparison below would read that as freezing - `null < 14` is true -
         * so the species advice would be the advice for a cold month. Absence is answered as absence instead.
         */
        var _T = getSoilTemp(region, monthIdx);
        if (_T === null || _T === undefined) {
            return { strategy: null, reason: 'no soil-temperature profile for this region', mode: null };
        }
        var T = getSoilTemp(region, monthIdx);
        var D = dliShaded;
        var heavy = (traffic === 'heavy');
        
        var c4CanFunction = T >= 16;
        var c3RequiredCold = T < 14;
        var c4LightOk = D >= 10;
        var c3LightOk = D >= 12;
        
        // Cold months: C3 dominant regardless
        if (c3RequiredCold) {
            return {
                mode: 'C3-dominant',
                reason: 'C4 non-functional below 14°C soil temp',
                targetDLI: 15,
                confidence: 0.9
            };
        }
        
        // Deep shade with viable C4 temps
        if (c4CanFunction && D < 8) {
            return {
                mode: 'C4-base + C3 overseed',
                reason: 'C4 viable but deep shade limits recovery',
                targetDLI: 14,
                confidence: 0.7
            };
        }
        
        // Heavy traffic in marginal light
        if (heavy && D < 12) {
            return {
                mode: 'C4-base + C3 overseed',
                reason: 'Heavy traffic exceeds C4 capacity at this DLI',
                targetDLI: 14,
                confidence: 0.75
            };
        }
        
        // Full summer: C4 only
        if (c4CanFunction && D >= 12 && T >= 20) {
            return {
                mode: 'C4-only',
                reason: 'Summer temperatures support full C4 performance',
                targetDLI: 10,
                confidence: 0.85
            };
        }
        
        // Shoulder season default
        return {
            mode: 'C4-base + C3 overseed',
            reason: 'Shoulder-season benefit from ryegrass overlay',
            targetDLI: 12,
            confidence: 0.8
        };
    }

    /* ============================================================
       STRESS & RISK CALCULATIONS
    ============================================================ */

    /**
     * Calculate fungal disease risk score
     * @param {number} dliShaded - actual DLI
     * @param {number} dewNights - nights with extended dew per week
     * @param {string} region - climate region
     * @param {number} monthIdx - 0-11
     * @returns {number} 0-100 risk score
     */
    function fungalRiskScore(dliShaded, dewNights, region, monthIdx) {
        var base = 0;
        
        // Light deficit contribution
        if (dliShaded < 8) base += 30;
        else if (dliShaded < 12) base += 15;
        else if (dliShaded < 16) base += 5;
        
        // Dew contribution (5 points per night)
        base += (dewNights || 0) * 5;
        
        // Seasonal risk boost (winter in cool climates)
        if (region === 'cool-temperate' && (monthIdx === 5 || monthIdx === 6 || monthIdx === 7)) {
            base += 15;
        }
        
        // Humidity corridor (subtropical autumn)
        if (region === 'subtropical' && (monthIdx >= 2 && monthIdx <= 4)) {
            base += 10;
        }
        
        return clamp(base, 0, 100);
    }

    /**
     * Classify fungal risk band
     */
    function fungalBand(score) {
        if (score < 20) return { label: 'Low', severity: 'good', colour: '#22c55e' };
        if (score < 45) return { label: 'Moderate', severity: 'watch', colour: '#eab308' };
        if (score < 70) return { label: 'High', severity: 'concern', colour: '#f97316' };
        return { label: 'Severe', severity: 'critical', colour: '#ef4444' };
    }

    /**
     * Calculate overall stress forecast index
     * @param {number} deficitPct - light deficit percentage
     * @param {number} weeklyET - evapotranspiration mm/week
     * @param {number} fungalScore - fungal risk 0-100
     * @param {string} traffic - traffic level
     * @returns {number} 0-100 stress index
     */
    function stressForecastIndex(deficitPct, weeklyET, fungalScore, traffic) {
        var t = 0;
        
        // Light deficit contribution
        if (deficitPct > 40) t += 25;
        else if (deficitPct > 20) t += 12;
        else if (deficitPct > 10) t += 5;
        
        // ET load contribution
        if (weeklyET > 40) t += 18;
        else if (weeklyET > 30) t += 10;
        else if (weeklyET > 20) t += 5;
        
        // Traffic contribution
        var trafficScores = { none: 0, light: 5, moderate: 12, heavy: 22 };
        t += trafficScores[traffic] || 8;
        
        // Fungal pressure contribution
        if (fungalScore > 50) t += 15;
        else if (fungalScore > 30) t += 8;
        
        return clamp(t, 0, 100);
    }

    /**
     * Classify stress band
     */
    function stressBand(score) {
        if (score < 25) return { label: 'Low', severity: 'good', colour: '#22c55e' };
        if (score < 50) return { label: 'Moderate', severity: 'watch', colour: '#eab308' };
        if (score < 75) return { label: 'High', severity: 'concern', colour: '#f97316' };
        return { label: 'Extreme', severity: 'critical', colour: '#ef4444' };
    }

    /* ============================================================
       RECOVERY WINDOW ASSESSMENT
    ============================================================ */

    /**
     * Assess renovation/recovery window viability
     * @param {string} region - climate region
     * @param {number} monthIdx - 0-11
     * @param {string} speciesMode - C3/C4/mixed
     * @param {number} deficitPct - light deficit
     * @returns {object} { flag, detail, windowStart, windowEnd }
     */
    /**
     * GH-783 - THE SEASONS HERE ARE THE SOUTHERN ONES, AND THAT IS A DECISION, not an omission.
     *
     * September to November is spring in this function, March to May autumn, and the hemisphere is not asked at
     * all - so a northern site is told that its September is a spring window. The owner settled it on 30.09.2026:
     * leave it as the old hub has it, FOR NOW, and revisit it later. Measured before writing this, because "as
     * the old hub has it" had to be a fact rather than a memory: `/hub` loads both this file and
     * `shade-engine.js`, and in both copies this function takes no hemisphere and marks Sep-Nov as spring. So
     * what is kept is what runs today, and nothing third exists.
     *
     * WHAT IT COSTS, measured on the stand: of thirteen sites one prints a window of the wrong hemisphere
     * (`+52.24` latitude, "September" in September) and a second has the wrong branch with no window to print.
     * The engine already knows the hemisphere two lines away - `seasonalTrajectory` shifts the declination by it
     * and `optimalRenovation` answers Mar-May for the north - so this function disagreeing with its neighbours is
     * the thing a later requirement will settle.
     */
    function recoveryWindowAssessment(region, monthIdx, speciesMode, deficitPct) {
        // Severe deficit = poor recovery regardless
        if (deficitPct > 60) {
            return {
                flag: 'Poor',
                severity: 'critical',
                detail: 'Insufficient DLI for stable renovation without LED or structural adjustment.',
                windowStart: null,
                windowEnd: null
            };
        }
        
        // Spring window (Sep-Nov in Southern Hemisphere)
        if (monthIdx >= 8 && monthIdx <= 10) {
            return {
                flag: 'Optimal',
                severity: 'good',
                detail: 'Spring window allows strong recovery. C4 warming, C3 still active.',
                windowStart: 'September',
                windowEnd: 'November'
            };
        }
        
        // Autumn window (Mar-May)
        if (monthIdx >= 2 && monthIdx <= 4) {
            var autumnDetail = speciesMode.indexOf('C4') >= 0
                ? 'Autumn window suitable for C4 overseed establishment before winter.'
                : 'Autumn window suitable for C3 renovation before winter dormancy.';
            return {
                flag: 'Good',
                severity: 'watch',
                detail: autumnDetail,
                windowStart: 'March',
                windowEnd: 'May'
            };
        }
        
        // Summer (Dec-Feb)
        if (monthIdx === 0 || monthIdx === 1 || monthIdx === 11) {
            return {
                flag: 'Conditional',
                severity: 'watch',
                detail: 'Summer recovery possible for C4 species with adequate irrigation. C3 heat stress likely.',
                windowStart: null,
                windowEnd: null
            };
        }
        
        // Winter (Jun-Aug)
        return {
            flag: 'Poor',
            severity: 'concern',
            detail: 'Winter recovery limited. C4 dormant, C3 slow growth. Consider LED supplementation.',
            windowStart: null,
            windowEnd: null
        };
    }

    /* ============================================================
       LED SUPPLEMENTATION MODEL
    ============================================================ */

    /**
     * Calculate LED supplementation requirements
     * @param {number} dliShaded - current DLI
     * @param {string} speciesKey - turf species
     * @param {string} region - climate region
     * @param {boolean} allowLED - whether LED is available
     * @param {number} monthIdx - 0-11
     * @param {string} traffic - traffic level
     * @returns {object} LED requirements
     */
    function ledSupplementationModel(dliShaded, speciesKey, region, allowLED, monthIdx, traffic) {
        var thresholds = SPECIES_DLI[speciesKey] || SPECIES_DLI['default'];
        var targetDLI = thresholds.target;
        
        // Adjust target for high traffic
        if (traffic === 'heavy') {
            targetDLI = Math.max(targetDLI, thresholds.optimal * 0.85);
        }
        
        var deficit = targetDLI - dliShaded;
        
        if (deficit <= 0 || !allowLED) {
            return {
                required: false,
                deficitMol: 0,
                hours: 0,
                kWh: 0,
                costPerDay: 0,
                warning: deficit <= 0 ? 'DLI sufficient' : 'LED not available at this site'
            };
        }
        
        // LED efficacy assumptions (industry standard SeeGrow/similar)
        var ledPPFD = 400; // µmol/m²/s typical output
        var ledEfficiency = 2.5; // µmol/J
        var electricityCost = 0.30; // $/kWh (AUD)
        
        // Hours needed: deficit (mol) / (PPFD × 3600 / 1e6)
        var molPerHour = (ledPPFD * 3600) / 1000000;
        var hoursNeeded = deficit / molPerHour;
        hoursNeeded = Math.min(hoursNeeded, 16); // Cap at 16 hours
        
        // Energy: watts = PPFD / efficiency × area (assume 1m²)
        var wattsPerM2 = ledPPFD / ledEfficiency;
        var kWhPerDay = (wattsPerM2 * hoursNeeded) / 1000;
        var costPerDay = kWhPerDay * electricityCost;
        
        var warning = '';
        if (hoursNeeded > 12) {
            warning = 'Extended LED operation required. Consider structural shade remediation.';
        } else if (hoursNeeded > 8) {
            warning = 'Significant LED hours needed. Monitor electricity costs.';
        }
        
        return {
            required: true,
            deficitMol: +deficit.toFixed(1),
            hours: +hoursNeeded.toFixed(1),
            kWh: +kWhPerDay.toFixed(2),
            costPerDay: +costPerDay.toFixed(2),
            warning: warning
        };
    }

    /* ============================================================
       SHADE × NITROGEN ADJUSTMENT
       Reference: Bell & Danneberger (1999), Beard (1973), Stier & Gardner (2008)
       
       Scientific basis: Lower photosynthesis = reduced carbohydrate production
       = reduced N utilisation capacity. Excess N in shade creates soft,
       etiolated growth with thin cell walls - increased disease susceptibility.
    ============================================================ */

    /**
     * Calculate N rate adjustment based on shade deficit
     * @param {number} deficitPct - light deficit percentage
     * @param {number} baseNRate - planned N rate (kg/ha or lb/1000ft²)
     * @param {string} speciesKey - turf species
     * @returns {object} { factor, adjustedRate, label, reason, reference }
     */
    function nitrogenAdjustment(deficitPct, baseNRate, speciesKey) {
        var factor = 1.0;
        var label = 'Full rate';
        var reason = '';
        
        // Find appropriate reduction factor
        for (var i = 0; i < N_REDUCTION_FACTORS.thresholds.length; i++) {
            var t = N_REDUCTION_FACTORS.thresholds[i];
            if (deficitPct <= t.maxDeficit) {
                factor = t.factor;
                label = t.label;
                break;
            }
        }
        
        // Build reason text
        if (factor < 1.0) {
            reason = 'Reduced photosynthetic capacity limits N utilisation. ' +
                     'Excess N creates weak, disease-prone growth.';
        } else {
            reason = 'Adequate light supports normal N metabolism.';
        }
        
        var adjustedRate = baseNRate * factor;
        
        return {
            factor: factor,
            baseRate: baseNRate,
            adjustedRate: +adjustedRate.toFixed(2),
            reductionPct: Math.round((1 - factor) * 100),
            label: label,
            reason: reason,
            severity: factor < 0.7 ? 'concern' : (factor < 1.0 ? 'watch' : 'good'),
            reference: 'Bell & Danneberger (1999), Beard (1973)'
        };
    }

    /* ============================================================
       SHADE × MOWING HEIGHT GUIDANCE
       Reference: Beard (1973), Dudeck & Peacock (1992), Bell et al. (2000)
       
       Scientific basis: Higher HOC increases leaf area for light capture.
       Greater photosynthetic surface compensates for reduced light intensity.
       Also reduces respiration load relative to photosynthesis.
    ============================================================ */

    /**
     * Calculate mowing height adjustment for shade
     * @param {number} deficitPct - light deficit percentage
     * @param {string} speciesKey - turf species
     * @param {number} currentHOC - current height of cut (mm)
     * @param {string} surfaceType - 'greens', 'tees', 'fairways', 'sports', etc.
     * @returns {object} { recommendedHOC, increasePct, reason, reference }
     */
    function mowingHeightGuidance(deficitPct, speciesKey, currentHOC, surfaceType) {
        var mowingData = SPECIES_MOWING[speciesKey] || SPECIES_MOWING['default'];
        
        // Surface-type maximum heights (absolute limits regardless of shade)
        var surfaceMaxHOC = {
            'greens': 6,        // Putting greens: max 6mm even in shade
            'tees': 15,         // Tees: max 15mm
            'fairways': 20,     // Fairways: max 20mm
            'surrounds': 12,    // Surrounds/approaches: max 12mm
            'sports': 35,       // Sports fields: max 35mm
            'lawns': 50         // Lawns: max 50mm
        };
        
        // Get surface limit (default to species shadeMax if unknown surface)
        var surfaceLimit = surfaceMaxHOC[surfaceType] || mowingData.shadeMax;
        
        // Use the lower of species shadeMax and surface limit
        var effectiveMax = Math.min(mowingData.shadeMax, surfaceLimit);
        
        // Calculate increase factor based on deficit
        var increaseFactor = 1.0;
        var label = 'Standard height';
        
        if (deficitPct > 50) {
            increaseFactor = 1.50;  // 50% increase for severe shade
            label = 'Maximum shade height';
        } else if (deficitPct > 35) {
            increaseFactor = 1.35;  // 35% increase for heavy shade
            label = 'Heavy shade height';
        } else if (deficitPct > 20) {
            increaseFactor = 1.20;  // 20% increase for moderate shade
            label = 'Moderate shade height';
        } else if (deficitPct > 10) {
            increaseFactor = 1.10;  // 10% increase for light shade
            label = 'Light shade adjustment';
        }
        
        // Calculate recommended HOC (capped by effective max)
        var baseHOC = currentHOC || mowingData.standard;
        var recommendedHOC = Math.min(baseHOC * increaseFactor, effectiveMax);
        
        // Build recommendation
        var reason = '';
        if (increaseFactor > 1.0) {
            reason = 'Increase leaf area to maximise light capture. ' +
                     'Higher HOC improves carbohydrate reserves under limited light.';
        } else {
            reason = 'Current height appropriate for light conditions.';
        }
        
        return {
            currentHOC: baseHOC,
            recommendedHOC: Math.round(recommendedHOC),
            increasePct: Math.round((increaseFactor - 1) * 100),
            speciesMin: mowingData.min,
            speciesMax: mowingData.max,
            shadeMax: effectiveMax,  // Now reflects surface type limit
            surfaceLimit: surfaceLimit,
            label: label,
            reason: reason,
            severity: increaseFactor > 1.35 ? 'concern' : (increaseFactor > 1.0 ? 'watch' : 'good'),
            reference: 'Dudeck & Peacock (1992), Bell et al. (2000)'
        };
    }

    /* ============================================================
       SHADE × PGR WARNING
       Reference: Ervin & Koski (1998), Qian & Engelke (1999), Bunnell et al. (2005)
       
       Scientific basis: PGRs suppress gibberellin synthesis → reduced vertical
       growth. In shade, turf already struggles to produce adequate leaf area.
       Suppressing limited growth compounds stress.
    ============================================================ */

    /**
     * Generate PGR warning based on shade conditions
     * @param {number} deficitPct - light deficit percentage
     * @param {number} dliShaded - actual DLI received
     * @param {boolean} pgrActive - whether PGR program is active
     * @returns {object} { warning, recommendation, severity, reference }
     */
    function pgrWarning(deficitPct, dliShaded, pgrActive) {
        var warning = '';
        var recommendation = '';
        var severity = 'good';
        var suspend = false;
        
        if (dliShaded < 10) {
            // Critical shade - absolutely no PGR
            warning = 'PGR contraindicated in severe shade.';
            recommendation = 'Suspend all PGR applications. Turf needs maximum growth capacity to survive.';
            severity = 'critical';
            suspend = true;
        } else if (dliShaded < 15) {
            // Heavy shade - strong warning
            warning = 'PGR not recommended in heavy shade conditions.';
            recommendation = 'Suspend PGR applications until light improves. Consider reduced rates only if essential.';
            severity = 'concern';
            suspend = true;
        } else if (deficitPct > 30) {
            // Moderate shade stress - caution
            warning = 'Exercise caution with PGR applications.';
            recommendation = 'Reduce PGR rates by 25-50% in shaded areas. Monitor for stress symptoms.';
            severity = 'watch';
            suspend = false;
        } else {
            // Adequate light - normal PGR program OK
            warning = '';
            recommendation = 'Standard PGR program appropriate for current light levels.';
            severity = 'good';
            suspend = false;
        }
        
        return {
            warning: warning,
            recommendation: recommendation,
            severity: severity,
            suspend: suspend,
            currentlyActive: pgrActive,
            conflictDetected: pgrActive && suspend,
            reference: 'Ervin & Koski (1998), Bunnell et al. (2005)'
        };
    }

    /* ============================================================
       SEASONAL SUN TRAJECTORY
       Pure solar geometry - predicts shade variation through year
       
       Calculates relative light availability by month to identify:
       - Peak shade stress periods
       - Optimal renovation windows
       - LED deployment timing
    ============================================================ */

    /**
     * Calculate seasonal light trajectory
     * @param {number} latitude - site latitude
     * @param {number} obstructionAngle - angle to top of obstruction (degrees)
     * @param {string} aspect - obstruction direction (N/S/E/W)
     * @param {string} hemisphere - 'north' or 'south'
     * @returns {object} { monthlyDLI[], peakMonth, troughMonth, peakDLI, troughDLI }
     */
    function seasonalTrajectory(latitude, obstructionAngle, aspect, hemisphere) {
        var absLat = Math.abs(latitude);
        
        // Solar declination range (±23.45°)
        var maxDeclination = 23.45;
        
        // Calculate noon sun altitude for each month
        var monthlyAltitude = [];
        var monthlyRelativeDLI = [];
        
        // Declination by month (approximate, Southern Hemisphere reference)
        // Jan = summer solstice, Jul = winter solstice for SH
        var declinationByMonth = hemisphere === 'south'
            ? [23.45, 20.0, 11.5, 0, -11.5, -20.0, -23.45, -20.0, -11.5, 0, 11.5, 20.0]
            : [-23.45, -20.0, -11.5, 0, 11.5, 20.0, 23.45, 20.0, 11.5, 0, -11.5, -20.0];
        
        for (var m = 0; m < 12; m++) {
            // Noon sun altitude = 90 - |latitude - declination|
            var altitude = 90 - Math.abs(absLat - declinationByMonth[m]);
            monthlyAltitude.push(altitude);
            
            // Calculate shade impact based on sun altitude vs obstruction angle
            var clearanceFactor;
            if (altitude > obstructionAngle + 20) {
                clearanceFactor = 1.0;  // Sun well above obstruction
            } else if (altitude > obstructionAngle) {
                clearanceFactor = 0.7 + 0.3 * ((altitude - obstructionAngle) / 20);
            } else if (altitude > obstructionAngle - 20) {
                clearanceFactor = 0.3 + 0.4 * ((altitude - (obstructionAngle - 20)) / 20);
            } else {
                clearanceFactor = 0.2;  // Sun below obstruction for most of day
            }
            
            // Apply aspect modifier (simplified)
            var aspectMod = 1.0;
            if (hemisphere === 'south' && aspect === 'S') aspectMod = 0.7;
            if (hemisphere === 'north' && aspect === 'N') aspectMod = 0.7;
            
            // Combine with base monthly DLI multiplier
            var relativeDLI = MONTH_DLI_MULT[m] * clearanceFactor * aspectMod;
            monthlyRelativeDLI.push(+relativeDLI.toFixed(2));
        }
        
        // Find peak and trough
        var peakDLI = Math.max.apply(null, monthlyRelativeDLI);
        var troughDLI = Math.min.apply(null, monthlyRelativeDLI);
        var peakMonth = monthlyRelativeDLI.indexOf(peakDLI);
        var troughMonth = monthlyRelativeDLI.indexOf(troughDLI);
        
        var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        
        // Calculate stress periods (DLI < 60% of peak)
        var stressPeriods = [];
        var threshold = peakDLI * 0.6;
        for (var i = 0; i < 12; i++) {
            if (monthlyRelativeDLI[i] < threshold) {
                stressPeriods.push(monthNames[i]);
            }
        }
        
        return {
            monthlyRelativeDLI: monthlyRelativeDLI,
            monthlyAltitude: monthlyAltitude,
            peakMonth: peakMonth,
            peakMonthName: monthNames[peakMonth],
            peakDLI: peakDLI,
            troughMonth: troughMonth,
            troughMonthName: monthNames[troughMonth],
            troughDLI: troughDLI,
            seasonalRange: +(peakDLI - troughDLI).toFixed(2),
            stressPeriods: stressPeriods,
            optimalRenovation: hemisphere === 'south' 
                ? ['Sep', 'Oct', 'Nov'] 
                : ['Mar', 'Apr', 'May'],
            note: 'Relative DLI values - multiply by open-field DLI for actual estimates'
        };
    }

    /* ============================================================
       MAIN ENGINE FUNCTION
    ============================================================ */

    /**
     * Main shade engine entry point
     * @param {object} state - hub state object
     * @param {object} weather - weather/climate data
     * @returns {object|null} comprehensive shade analysis
     */
    function gaip_shade_engine(state, weather) {
        // Validate inputs
        if (!state || !state.turf) return null;
        
        var region = getRegion(state);
        var hemisphere = getHemisphere(state);
        /**
         * GH-783 (queue item 3vshch) - WITHOUT A REGION OR A HEMISPHERE THIS ENGINE COMPUTES NOTHING.
         *
         * The two used to be substituted ('warm-temperate', 'south') and every number below rested on the guess:
         * the region picks the open-field peak DLI, and from it come the light deficit, the stress verdict and the
         * species advice; the hemisphere picks the sun's declination and the months of the renovation window.
         * Now they are absent when nobody gave them - and absence must not be read as a value either. Every check
         * below asks `=== 'south'`, for which `null` reads as NORTH, so a bare removal would have answered a site
         * with no latitude as a northern one, which is worse than the default it replaced.
         *
         * So the engine says it did not compute, in the shape the cascade already recognises as "produced
         * nothing" - the same device as the soil engine without a methodology (GH-782).
         *
         * ON THE STAND THIS CHANGES NOTHING TODAY, and that is measured rather than hoped: the caller of this
         * engine substitutes a latitude of -35 for every site (the owner's open fork 7), so a hemisphere always
         * arrives. What the guard removes is the silence in the case where it does not.
         */
        if (!region || !hemisphere) {
            return {
                status: 'Not available',
                statusSeverity: 'unknown',
                reason: !hemisphere ? 'no-hemisphere' : 'no-region',
                hemisphere: hemisphere,
                region: region,
            };
        }
        var monthIdx = getCurrentMonth(state.monthIndex);
        var speciesKey = getSpeciesKey(state);
        
        // Get shade inputs from state
        var shade = state.shade || state.turf.shade || {};
        var dliInput = state.turf.dli || shade.dli || 0;
        
        // ================================================================
        // AMBIENT DLI INTEGRATION v1.0
        // Use weather-derived DLI as "open-field" baseline when available
        // ================================================================
        var ambientDLI = null;
        var ambientDLISource = null;
        
        // Try to get ambient DLI from state (ONLY path in pure mode)
        if (state.ambientDLI && state.ambientDLI.current > 0) {
            ambientDLI = state.ambientDLI.current;
            ambientDLISource = 'state_injected';
        } else if (state.turf.ambientDLI > 0) {
            ambientDLI = state.turf.ambientDLI;
            ambientDLISource = 'turf_ambient';
        }
        
        // If DLI provided directly, use it
        var dliOpen, dliShaded, globalMod;
        
        if (dliInput > 0 && !shade.calculate) {
            // Direct DLI input mode
            // Use ambient DLI for open-field baseline if available
            if (ambientDLI && ambientDLI > 0) {
                dliOpen = ambientDLI;
            } else {
                /**
                 * GH-783: the region's own peak, or nothing computed from it. `|| 40` turned a region nobody
                 * gave - and a region name this table does not know - into a number, and every figure downstream
                 * was then a figure about a site that does not exist.
                 */
                var peakDLI = (region && REGION_PEAK_DLI[region] !== undefined)
                    ? REGION_PEAK_DLI[region] : null;
                var monthMult = MONTH_DLI_MULT[monthIdx];
                dliOpen = (peakDLI === null) ? null : peakDLI * monthMult;
            }
            dliShaded = dliInput;
            globalMod = dliOpen > 0 ? (dliShaded / dliOpen) : 1;
        } else if (shade.morningSky !== undefined || shade.skyView !== undefined) {
            // Calculate from sky view fractions
            var morningSky = shade.morningSky !== undefined ? shade.morningSky : (shade.skyView || 0.5);
            var middaySky = shade.middaySky !== undefined ? shade.middaySky : (shade.skyView || 0.5);
            var afternoonSky = shade.afternoonSky !== undefined ? shade.afternoonSky : (shade.skyView || 0.5);
            
            // Use ambient DLI for open-field baseline if available
            if (ambientDLI && ambientDLI > 0) {
                dliOpen = ambientDLI;
            } else {
                var hourlyOpen = computeHourlyOpenFraction(1, 1, 1, monthIdx, shade.aspect || 'N', hemisphere);
                dliOpen = DLIfromHourly(hourlyOpen, region);
                /**
                 * GH-783: and a peak the table has no figure for stops the pass here rather than becoming a
                 * deficit computed from nothing. The other branch of this same `if` was already repaired; this is
                 * its second entrance.
                 */
                if (dliOpen === null) {
                    return {
                        status: 'Not available',
                        statusSeverity: 'unknown',
                        reason: 'no-peak-dli-for-region',
                        region: region,
                        hemisphere: hemisphere,
                    };
                }
            }
            
            var hourlyPartial = computeHourlyOpenFraction(morningSky, middaySky, afternoonSky, monthIdx, shade.aspect || 'N', hemisphere);
            
            var shadingResult = applyShadingSystem(hourlyPartial, {
                canopy: shade.canopyDensity || shade.canopy || 0,
                geometry: shade.geometryScore || shade.geom || 0,
                distance: shade.distanceFromObstruction || shade.distance || 10,
                aspect: shade.aspect || 'N',
                context: shade.context || 'mixed'
            }, hemisphere);
            
            // Apply shade factors to ambient/estimated DLI
            dliShaded = dliOpen * shadingResult.globalMod;
            globalMod = shadingResult.globalMod;
        } else if (ambientDLI && ambientDLI > 0) {
            // No shade data but we have ambient DLI - show full sun conditions
            dliOpen = ambientDLI;
            dliShaded = ambientDLI;
            globalMod = 1.0;
        } else {
            // No shade data - return null or minimal result
            return {
                status: 'NO_DATA',
                message: 'No DLI or shade parameters provided',
                dliOpen: null,
                dliShaded: null
            };
        }
        
        // Calculate deficit
        var deficitMol = dliOpen - dliShaded;
        var deficitPct = dliOpen > 0 ? ((deficitMol / dliOpen) * 100) : 0;
        
        // Get thresholds - check overseed state first, then turf profile context
        var thresholds;
        var thresholdSource = 'species_default';
        
        // v3.0.0 pure: overseed state from state input only
        var overseedState = state.overseedState || null;
        var isOverseedDominant = overseedState && overseedState.c3Fraction > 0.5 && overseedState.overseedSpecies;
        
        if (isOverseedDominant) {
            // Use C3 species thresholds for the overseed species
            var overseedKey = getSpeciesKey({ turf: { species: overseedState.overseedSpecies } });
            thresholds = SPECIES_DLI[overseedKey] || SPECIES_DLI['ryegrass'] || SPECIES_DLI['default'];
            thresholdSource = 'overseed_species';
        } else if (state.turfContext && state.turfContext.dliMinimum && state.turfContext.dliOptimal) {
            // v3.0.0 pure: Accept turf context from state only
            thresholds = {
                min: state.turfContext.dliMinimum,
                target: state.turfContext.dliTarget || Math.round((state.turfContext.dliMinimum + state.turfContext.dliOptimal) / 2),
                optimal: state.turfContext.dliOptimal
            };
            thresholdSource = 'turf_profile';
        }
        
        // Fall back to species lookup if no turf profile context
        if (!thresholds) {
            thresholds = SPECIES_DLI[speciesKey] || SPECIES_DLI['default'];
        }
        
        // ================================================================
        // VARIETY TRAITS INTEGRATION
        // Apply variety-specific shade tolerance modifiers
        // v2.2.0: Accept pre-resolved modifier from orchestrator state
        // ================================================================
        var varietyModifier = 1.0;
        var varietyConfidence = 'none';
        var varietySource = null;
        
        if (state.varietyShadeModifier && state.varietyShadeModifier.confidence !== 'none') {
            // Pre-resolved by orchestrator (ONLY path in pure mode)
            varietyModifier = state.varietyShadeModifier.thresholdModifier;
            varietyConfidence = state.varietyShadeModifier.confidence;
            varietySource = state.varietyShadeModifier.source;
            
            thresholds = {
                min: thresholds.min * varietyModifier,
                target: thresholds.target * varietyModifier,
                optimal: thresholds.optimal * varietyModifier
            };
        }
        // ================================================================
        // END VARIETY TRAITS INTEGRATION
        // ================================================================
        
        // Determine status
        var status, statusSeverity;
        if (dliShaded >= thresholds.optimal) {
            status = 'OPTIMAL';
            statusSeverity = 'good';
        } else if (dliShaded >= thresholds.target) {
            status = 'ADEQUATE';
            statusSeverity = 'good';
        } else if (dliShaded >= thresholds.min) {
            status = 'MARGINAL';
            statusSeverity = 'watch';
        } else if (dliShaded >= thresholds.min * 0.7) {
            status = 'DEFICIENT';
            statusSeverity = 'concern';
        } else {
            status = 'CRITICAL';
            statusSeverity = 'critical';
        }
        
        // Traffic level
        var traffic = 'moderate';
        if (state.traffic && state.traffic.level) traffic = state.traffic.level;
        else if (state.turf && state.turf.trafficLevel) traffic = state.turf.trafficLevel;
        
        // Weather-derived inputs
        var weeklyET = 25; // default
        var dewNights = 2; // default
        if (weather) {
            if (weather.et && weather.et.total) weeklyET = weather.et.total;
            else if (weather.weeklyET) weeklyET = weather.weeklyET;
            if (weather.dewNights !== undefined) dewNights = weather.dewNights;
        }
        
        // Calculate risk scores
        var fungal = fungalRiskScore(dliShaded, dewNights, region, monthIdx);
        var fungalClass = fungalBand(fungal);
        
        var stress = stressForecastIndex(deficitPct, weeklyET, fungal, traffic);
        var stressClass = stressBand(stress);
        
        // Species decision
        var speciesRec = speciesDecision(speciesKey, dliShaded, monthIdx, traffic, region);
        
        // Recovery window
        var recovery = recoveryWindowAssessment(region, monthIdx, speciesRec.mode, deficitPct);
        
        // LED supplementation
        var allowLED = shade.ledAvailable !== false && state.site && state.site.ledAvailable !== false;
        var led = ledSupplementationModel(dliShaded, speciesKey, region, allowLED, monthIdx, traffic);
        
        // C3/C4 mix calculations
        var c3frac = 0, c4frac = 0;
        if (state.turf.percentC3Cover !== undefined) {
            c3frac = state.turf.percentC3Cover / 100;
            c4frac = 1 - c3frac;
        } else if (state.turf.coolOverseed) {
            c3frac = 0.6;
            c4frac = 0.4;
        } else if (isC3Species(speciesKey)) {
            c3frac = 1;
            c4frac = 0;
        } else if (isC4Species(speciesKey)) {
            c3frac = 0;
            c4frac = 1;
        } else {
            c3frac = 0.3;
            c4frac = 0.7;
        }
        
        // Blended DLI targets
        var blendedMinDLI = (thresholds.min * (isC4Species(speciesKey) ? 1 : 0.8)) * c4frac + 
                           (SPECIES_DLI['ryegrass'].min) * c3frac;
        var blendedTargetDLI = thresholds.target * c4frac + SPECIES_DLI['ryegrass'].target * c3frac;
        
        // ========================================
        // v2.0 SHADE MANAGEMENT CALCULATIONS
        // ========================================
        
        // N adjustment based on shade deficit
        var baseNRate = state.turf && state.turf.plannedNRate ? state.turf.plannedNRate : 25; // default 25 kg/ha/month
        var nAdjustment = nitrogenAdjustment(deficitPct, baseNRate, speciesKey);
        
        // Get surface type from state (greens, tees, fairways, sports, etc.)
        var surfaceType = null;
        if (state.soil && state.soil.surfaceType) {
            surfaceType = state.soil.surfaceType;
        } else if (state.turf && state.turf.surfaceType) {
            surfaceType = state.turf.surfaceType;
        } else if (state.turf && state.turf.subCategory) {
            surfaceType = state.turf.subCategory;
        }

        // Mowing height guidance (now surface-type aware)
        var currentHOC = state.turf && state.turf.hoc ? state.turf.hoc : null;
        var mowingGuidance = mowingHeightGuidance(deficitPct, speciesKey, currentHOC, surfaceType);
        
        // PGR warning
        var pgrActive = state.turf && state.turf.pgrActive ? state.turf.pgrActive : false;
        var pgrGuidance = pgrWarning(deficitPct, dliShaded, pgrActive);
        
        // Seasonal trajectory (if obstruction data available)
        var lat = state.location && state.location.lat ? state.location.lat : -35;
        var obstructionAngle = shade.obstructionAngle || shade.facade || 30;
        var aspect = shade.aspect || 'N';
        var trajectory = seasonalTrajectory(lat, obstructionAngle, aspect, hemisphere);
        
        // Build result
        return {
            status: status,
            statusSeverity: statusSeverity,
            
            // DLI metrics
            dliOpen: +dliOpen.toFixed(1),
            dliShaded: +dliShaded.toFixed(1),
            dliDeficit: +deficitMol.toFixed(1),
            deficitPct: +deficitPct.toFixed(1),
            transmissionPct: +(globalMod * 100).toFixed(0),
            
            // Ambient DLI source (if weather-derived)
            ambientDLI: ambientDLI,
            ambientDLISource: ambientDLISource,
            
            // Thresholds
            dliMin: thresholds.min,
            dliTarget: thresholds.target,
            dliOptimal: thresholds.optimal,
            thresholdSource: thresholdSource,  // 'turf_profile' or 'species_default'
            blendedMinDLI: +blendedMinDLI.toFixed(1),
            blendedTargetDLI: +blendedTargetDLI.toFixed(1),
            
            // Variety modifiers (if applied)
            varietyModifier: varietyModifier !== 1.0 ? {
                modifier: varietyModifier,
                confidence: varietyConfidence,
                source: varietySource,
                variety: state.turf.variety || state.turf.cultivar
            } : null,
            
            // Species context
            species: speciesKey,
            c3Fraction: c3frac,
            c4Fraction: c4frac,
            speciesDecision: speciesRec,
            
            // Risk scores
            fungalRisk: fungal,
            fungalClass: fungalClass,
            stressIndex: stress,
            stressClass: stressClass,
            
            // Recovery
            recoveryWindow: recovery,
            
            // LED
            led: led,
            
            // ========================================
            // v2.0 SHADE MANAGEMENT OUTPUTS
            // ========================================
            
            // Nitrogen adjustment (Bell & Danneberger 1999)
            nAdjustment: nAdjustment,
            
            // Mowing height guidance (Dudeck & Peacock 1992)
            mowingGuidance: mowingGuidance,
            
            // PGR warning (Ervin & Koski 1998)
            pgrGuidance: pgrGuidance,
            
            // Seasonal trajectory (solar geometry)
            seasonalTrajectory: trajectory,
            
            // Context
            region: region,
            hemisphere: hemisphere,
            month: monthIdx,
            monthName: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][monthIdx],
            
            // Drivers (for progressive disclosure)
            primaryDriver: deficitPct > 30 ? 'Light deficit' : 
                          (fungal > 50 ? 'Fungal pressure' : 
                          (stress > 50 ? 'Combined stress' : 'Adequate light')),
            
            // Confidence
            confidence: speciesRec.confidence * (dliInput > 0 ? 0.95 : 0.85)
        };
    }

    /* ============================================================
       EXPORTS (Pure module)
    ============================================================ */

    // Export for hub integration (backward-compat name)
    global.gaip_shade_engine_pure = gaip_shade_engine;
    // Also keep original name for drop-in use
    global.gaip_shade_engine = gaip_shade_engine;
    
    // Export sub-functions for testing/direct use
    global.GAIP_Shade = {
        engine: gaip_shade_engine,
        
        // Core shading functions
        aspectGain: aspectGain,
        distanceModifier: distanceModifier,
        canopyModifier: canopyModifier,
        geometryModifier: geometryModifier,
        computeHourlyOpenFraction: computeHourlyOpenFraction,
        DLIfromHourly: DLIfromHourly,
        applyShadingSystem: applyShadingSystem,
        
        // Risk assessment
        fungalRiskScore: fungalRiskScore,
        stressForecastIndex: stressForecastIndex,
        speciesDecision: speciesDecision,
        recoveryWindowAssessment: recoveryWindowAssessment,
        ledSupplementationModel: ledSupplementationModel,
        
        // v2.0 Shade management functions
        nitrogenAdjustment: nitrogenAdjustment,
        mowingHeightGuidance: mowingHeightGuidance,
        pgrWarning: pgrWarning,
        seasonalTrajectory: seasonalTrajectory,
        
        // Constants (exposed for test verification)
        SPECIES_DLI: SPECIES_DLI,
        SPECIES_MOWING: SPECIES_MOWING,
        N_REDUCTION_FACTORS: N_REDUCTION_FACTORS,
        MONTH_DLI_MULT: MONTH_DLI_MULT,
        REGION_PEAK_DLI: REGION_PEAK_DLI,
        CRITICAL_DLI: CRITICAL_DLI,
        
        // Version
        version: '3.0.0'
    };
    

})(typeof window !== 'undefined' ? window : this);
