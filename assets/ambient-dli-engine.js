/**
 * =============================================================================
 * GILBA AMBIENT DLI ENGINE v1.0.0
 * =============================================================================
 * 
 * Automatically calculates Daily Light Integral (DLI) from Open-Meteo solar
 * radiation data and cloud cover, eliminating the need for manual DLI input.
 * 
 * SCIENTIFIC BASIS:
 * DLI (Daily Light Integral) = Total photosynthetically active radiation (PAR)
 * received over 24 hours, measured in mol/m²/day.
 * 
 * Conversion: DLI = MJ/m² × 0.45 (PAR fraction) × 4.57 (µmol/J) = MJ/m² × 2.057
 * 
 * REFERENCES:
 * - McCree, K.J. (1972). Test of current definitions of PAR. Agricultural Meteorology.
 * - Faust & Logan (2018). Daily Light Integral: A Research Review. HortScience.
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * =============================================================================
 */

(function(global) {
    'use strict';

    const AMBIENT_DLI_CONFIG = {
        version: '1.1.1',
        debug: false,
        
        // PAR conversion factors
        PAR_FRACTION: 0.45,
        UMOL_PER_WATT: 4.57,
        MOL_PER_MJ: 2.057,
        
        // Validation
        MIN_VALID_DLI: 0.5,
        MAX_VALID_DLI: 70,
        
        // Species-specific optimal DLI ranges (mol/m²/day)
        // NOTE: Uses 5-tier scale (critical/minimum/adequate/optimal/abundant)
        // vs shade-engine.js which uses 3-tier (min/target/optimal). Values differ.
        // Canonical 3-tier source: shade-engine.js:96
        SPECIES_DLI_RANGES: {
            ryegrass:       { critical: 10, minimum: 12, adequate: 18, optimal: 22, abundant: 30 },
            bentgrass:      { critical: 8,  minimum: 10, adequate: 14, optimal: 18, abundant: 25 },
            bluegrass:      { critical: 10, minimum: 12, adequate: 16, optimal: 20, abundant: 28 },
            fescue:         { critical: 8,  minimum: 10, adequate: 15, optimal: 18, abundant: 25 },
            couch:        { critical: 20, minimum: 24, adequate: 30, optimal: 35, abundant: 45 },
            couch:          { critical: 20, minimum: 24, adequate: 30, optimal: 35, abundant: 45 },
            kikuyu:         { critical: 18, minimum: 22, adequate: 28, optimal: 32, abundant: 40 },
            zoysia:         { critical: 15, minimum: 18, adequate: 24, optimal: 28, abundant: 35 },
            seashore_paspalum: { critical: 18, minimum: 22, adequate: 28, optimal: 32, abundant: 40 },
            c3_default:     { critical: 10, minimum: 12, adequate: 16, optimal: 20, abundant: 28 },
            c4_default:     { critical: 20, minimum: 24, adequate: 30, optimal: 35, abundant: 45 },
            default:        { critical: 12, minimum: 15, adequate: 20, optimal: 25, abundant: 35 }
        },
        
        REGIONAL_PEAK_DLI: {
            'australia_tropical':    55,
            'australia_subtropical': 50,
            'australia_temperate':   45,
            'australia_cool':        40,
            'uk':                    40,
            'uk_scotland':           35,
            'europe_central':        45,
            'europe_mediterranean':  55,
            'scandinavia':           35,
            'japan_south':           50,
            'japan_central':         45,
            'japan_north':           40,
            'default':               45
        }
    };

    function log(category, message, data) {
        if (AMBIENT_DLI_CONFIG.debug) {
        }
    }

    function calculateDLIFromHourly(shortwaveHourly) {
        if (!shortwaveHourly || shortwaveHourly.length === 0) return null;
        
        let totalWattHours = 0;
        for (let i = 0; i < shortwaveHourly.length; i++) {
            totalWattHours += shortwaveHourly[i] || 0;
        }
        
        const totalMJ = totalWattHours * 3600 / 1000000;
        const dli = totalMJ * AMBIENT_DLI_CONFIG.MOL_PER_MJ;
        
        return Math.round(dli * 10) / 10;
    }

    function calculateDLIFromDaily(shortwaveSum) {
        if (shortwaveSum === null || shortwaveSum === undefined || isNaN(shortwaveSum)) {
            return null;
        }
        return Math.round(shortwaveSum * AMBIENT_DLI_CONFIG.MOL_PER_MJ * 10) / 10;
    }

    function estimateDLIFromCloudCover(cloudCover, latitude, dayOfYear, region) {
        const peakDLI = AMBIENT_DLI_CONFIG.REGIONAL_PEAK_DLI[region] || 
                        AMBIENT_DLI_CONFIG.REGIONAL_PEAK_DLI['default'];
        
        const summerSolstice = latitude >= 0 ? 172 : 355;
        const daysDiff = Math.abs(dayOfYear - summerSolstice);
        const seasonalFactor = Math.cos((daysDiff / 182.5) * Math.PI) * 0.4 + 0.6;
        
        const clearSkyDLI = peakDLI * seasonalFactor;
        const cloudFraction = (cloudCover || 0) / 100;
        const transmittance = 0.25 + 0.75 * (1 - cloudFraction);
        
        return Math.round(clearSkyDLI * transmittance * 10) / 10;
    }

    function normalizeSpeciesKey(species) {
        if (!species || species === 'default') {
            // Try TurfProfileController before falling back to 'default'
            if (typeof window !== 'undefined' && window.TurfProfileController?.getState) {
                var tpcSpecies = window.TurfProfileController.getState()?.species;
                if (tpcSpecies && tpcSpecies !== 'default') {
                    species = tpcSpecies;
                } else {
                    return 'default';
                }
            } else {
                return 'default';
            }
        }

        // BEST: Use SpeciesController when available
        if (window.SpeciesController && typeof window.SpeciesController.normalize === 'function') {
            const canonical = window.SpeciesController.normalize(species);
            // Map canonical species to DLI range keys
            const dliKeyMap = {
                'perennialRyegrass': 'ryegrass',
                'bentgrass': 'bentgrass',
                'browntopBent': 'bentgrass',
                'kentuckyBluegrass': 'bluegrass',
                'poaAnnua': 'bentgrass',
                'couch': 'couch',
                'kikuyu': 'kikuyu',
                'zoysia': 'zoysia',
                'buffalo': 'buffalo',
                'tallFescue': 'fescue',
                'fineFescue': 'fescue',
                'seashore_paspalum': 'paspalum'
            };
            return dliKeyMap[canonical] || canonical;
        }
        
        // FALLBACK: Original logic
        const s = String(species).toLowerCase().replace(/[^a-z]/g, '');
        
        if (AMBIENT_DLI_CONFIG.SPECIES_DLI_RANGES[s]) return s;
        
        const aliases = {
            'perennialryegrass': 'ryegrass', 'annualryegrass': 'ryegrass',
            'creepingbentgrass': 'bentgrass', 'colonialbentgrass': 'bentgrass',
            'kentuckybluegrass': 'bluegrass', 'poaannua': 'bentgrass',
            'bermudagrass': 'couch', 'cynodon': 'couch', 'couchgrass': 'couch',
            'zoysiagrass': 'zoysia', 'c3': 'c3_default', 'c4': 'c4_default'
        };
        
        return aliases[s] || 'default';
    }

    function classifyDLIStatus(dli, species) {
        if (dli === null || dli === undefined) {
            return { status: 'unknown', level: null, thresholds: null };
        }
        
        const speciesKey = normalizeSpeciesKey(species);
        const thresholds = AMBIENT_DLI_CONFIG.SPECIES_DLI_RANGES[speciesKey] || 
                          AMBIENT_DLI_CONFIG.SPECIES_DLI_RANGES['default'];
        
        let status, level;
        
        if (dli < thresholds.critical) { status = 'critical'; level = 1; }
        else if (dli < thresholds.minimum) { status = 'deficient'; level = 2; }
        else if (dli < thresholds.adequate) { status = 'marginal'; level = 3; }
        else if (dli < thresholds.optimal) { status = 'adequate'; level = 4; }
        else if (dli < thresholds.abundant) { status = 'optimal'; level = 5; }
        else { status = 'abundant'; level = 6; }
        
        const deficit = dli < thresholds.optimal ? thresholds.optimal - dli : 0;
        const deficitPct = dli < thresholds.optimal ? ((thresholds.optimal - dli) / thresholds.optimal * 100) : 0;
        
        return {
            status, level,
            deficit: Math.round(deficit * 10) / 10,
            deficitPct: Math.round(deficitPct),
            thresholds,
            species: speciesKey
        };
    }

    function detectRegion(lat, lon, countryCode) {
        if (countryCode === 'AU' || (lat < -10 && lat > -45 && lon > 110 && lon < 160)) {
            if (lat > -20) return 'australia_tropical';
            if (lat > -30) return 'australia_subtropical';
            if (lat > -38) return 'australia_temperate';
            return 'australia_cool';
        }
        if (countryCode === 'GB' || countryCode === 'UK' || (lat > 49 && lat < 61 && lon > -11 && lon < 2)) {
            return lat > 55 ? 'uk_scotland' : 'uk';
        }
        if (lat > 35 && lat < 72 && lon > -10 && lon < 40) {
            if (lat > 55) return 'scandinavia';
            if (lat < 45) return 'europe_mediterranean';
            return 'europe_central';
        }
        if (countryCode === 'JP' || (lat > 24 && lat < 46 && lon > 123 && lon < 146)) {
            if (lat < 30) return 'japan_south';
            if (lat > 40) return 'japan_north';
            return 'japan_central';
        }
        return 'default';
    }

    function calculateAmbientDLI(climateData, state) {
        log('main', 'Calculating ambient DLI');
        
        const result = {
            source: null,
            current: null,        // PATCH v1.1.1: representative full-day DLI (not partial)
            currentRaw: null,     // PATCH v1.1.1: raw first-day value (may be partial for api_hourly)
            daily: [],
            average: null,
            status: null,
            classification: null,
            quality: null,
            warnings: []
        };
        
        const lat = state?.climate?.lat || state?.site?.lat || climateData?.lat || null;
        const lon = state?.climate?.lon || state?.site?.lon || climateData?.lon || null;
        const region = detectRegion(lat, lon, state?.site?.country);
        
        // v1.1.0: Check for overseed-dominant scenario
        // When C3 overseed is dominant (>50%), use the effective species for classification
        let species = 'default';
        let isOverseedDominant = false;
        const overseedState = (typeof window !== 'undefined') ? window.GAIP_OVERSEED_STATE : null;
        
        if (overseedState && overseedState.c3Fraction > 0.5 && overseedState.overseedSpecies) {
            // Overseed is dominant - use the C3 overseed species
            species = overseedState.overseedSpecies;
            isOverseedDominant = true;
            log('main', `Overseed dominant (${Math.round(overseedState.c3Fraction * 100)}% C3) - using ${species}`);
        } else if (state?.turf?.effectiveSpecies) {
            // Use effective species if available (set by other modules)
            species = state.turf.effectiveSpecies;
        } else {
            // state.turf.species may be an object {c3Fraction, c4Fraction}, not a species name
            // Check grassSpecies first, then coolOverseed, then warmBase for actual species name
            species = state?.turf?.grassSpecies ||
                              state?.turf?.coolOverseed ||
                              state?.turf?.warmBase ||
                              (typeof state?.turf?.species === 'string' ? state.turf.species : null) ||
                              (typeof window !== 'undefined' && window.TurfProfileController?.getState ? window.TurfProfileController.getState()?.species : null) ||
                              'default';
        }
        
        let dailyDLIs = [];
        
        // 1. Check for daily shortwave radiation sums
        if (climateData?.daily?.shortwave_radiation_sum) {
            result.source = 'api_daily';
            const sums = climateData.daily.shortwave_radiation_sum;
            
            for (let i = 0; i < sums.length; i++) {
                const dli = calculateDLIFromDaily(sums[i]);
                if (dli !== null) {
                    dailyDLIs.push({
                        date: climateData.daily.time?.[i] || `Day ${i + 1}`,
                        dli: dli,
                        source: 'api_daily'
                    });
                }
            }
        }
        
        // 2. Check for hourly shortwave data
        if (dailyDLIs.length === 0 && climateData?.hourly?.shortwave_radiation) {
            result.source = 'api_hourly';
            const hourly = climateData.hourly.shortwave_radiation;
            
            for (let dayStart = 0; dayStart < hourly.length; dayStart += 24) {
                const dayHours = hourly.slice(dayStart, dayStart + 24);
                if (dayHours.length >= 12) {
                    const dli = calculateDLIFromHourly(dayHours);
                    if (dli !== null) {
                        dailyDLIs.push({
                            date: climateData.hourly.time?.[dayStart]?.split('T')[0] || `Day ${Math.floor(dayStart / 24) + 1}`,
                            dli: dli,
                            source: 'api_hourly'
                        });
                    }
                }
            }
        }
        
        // 3. Fallback: estimate from cloud cover
        if (dailyDLIs.length === 0 && lat !== null) {
            const cloudCover = climateData?.hourly?.cloud_cover || climateData?.hourly?.cloudcover;
            const avgCloud = cloudCover ? (cloudCover.reduce((a, b) => a + b, 0) / cloudCover.length) : 50;
            
            const now = new Date();
            const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
            
            const estimatedDLI = estimateDLIFromCloudCover(avgCloud, lat, dayOfYear, region);
            
            result.source = 'estimated';
            result.warnings.push('DLI estimated from cloud cover');
            
            dailyDLIs.push({
                date: 'estimated',
                dli: estimatedDLI,
                source: 'estimated',
                cloudCover: avgCloud
            });
        }
        
        // Process results
        if (dailyDLIs.length > 0) {
            result.daily = dailyDLIs;
            
            const validDLIs = dailyDLIs.filter(d => d.dli !== null).map(d => d.dli);
            if (validDLIs.length > 0) {
                result.average = Math.round((validDLIs.reduce((a, b) => a + b, 0) / validDLIs.length) * 10) / 10;
            }
            
            result.current = dailyDLIs[0]?.dli || result.average;
            
            // PATCH v1.1.1: When source is api_hourly, Open-Meteo returns data starting
            // from the current hour, not midnight. The first 24h chunk is therefore partial
            // and underestimates true daily DLI (e.g. 6.9 at 6am vs 30.3 full-day average).
            // For shade/stress classification we need a representative full-day value.
            result.currentRaw = result.current;
            
            if (result.source === 'api_hourly' && dailyDLIs.length >= 2) {
                // Second entry is the first complete midnight-to-midnight day
                var completeDayDLI = dailyDLIs[1]?.dli;
                if (completeDayDLI !== null && completeDayDLI > 0) {
                    result.current = completeDayDLI;
                } else {
                    // Fallback: average of all days beyond the partial first day
                    var completeDLIs = dailyDLIs.slice(1).filter(function(d) { return d.dli !== null; }).map(function(d) { return d.dli; });
                    if (completeDLIs.length > 0) {
                        result.current = Math.round((completeDLIs.reduce(function(a, b) { return a + b; }, 0) / completeDLIs.length) * 10) / 10;
                    }
                    // else: keep the partial value — better than nothing
                }
            }
            
            result.classification = classifyDLIStatus(result.current, species);
            result.status = result.classification.status;
            
            result.quality = {
                score: result.source === 'estimated' ? 60 : 90,
                level: result.source === 'estimated' ? 'medium' : 'high'
            };
        } else {
            result.status = 'unavailable';
            result.warnings.push('No solar radiation data available');
        }
        
        result.metadata = { 
            region, 
            latitude: lat, 
            species,
            isOverseedDominant,
            effectiveSpecies: isOverseedDominant ? species : null,
            timestamp: new Date().toISOString() 
        };
        
        log('main', 'Ambient DLI result', result);
        return result;
    }

    function injectAmbientDLI(state, ambientDLI) {
        if (!state || !ambientDLI || ambientDLI.current === null) return state;
        
        state.ambientDLI = ambientDLI;
        
        if (!state.turf?.dli || state.turf.dli === 0) {
            state.turf = state.turf || {};
            state.turf.ambientDLI = ambientDLI.current;
            state.turf.ambientDLISource = ambientDLI.source;
        }
        
        return state;
    }

    function getOpenFieldDLI(state) {
        if (state?.ambientDLI?.current) return state.ambientDLI.current;
        if (state?.turf?.ambientDLI) return state.turf.ambientDLI;
        return null;
    }

    // Public API
    const AmbientDLIEngine = {
        version: AMBIENT_DLI_CONFIG.version,
        calculate: calculateAmbientDLI,
        calculateFromHourly: calculateDLIFromHourly,
        calculateFromDaily: calculateDLIFromDaily,
        estimateFromCloud: estimateDLIFromCloudCover,
        classifyStatus: classifyDLIStatus,
        normalizeSpecies: normalizeSpeciesKey,
        detectRegion: detectRegion,
        inject: injectAmbientDLI,
        getOpenFieldDLI: getOpenFieldDLI,
        config: {
            speciesRanges: AMBIENT_DLI_CONFIG.SPECIES_DLI_RANGES,
            regionalPeaks: AMBIENT_DLI_CONFIG.REGIONAL_PEAK_DLI
        },
        setDebug: function(enabled) { AMBIENT_DLI_CONFIG.debug = enabled; }
    };

    global.AmbientDLIEngine = AmbientDLIEngine;
    global.gaip_ambient_dli = calculateAmbientDLI;
    

})(typeof window !== 'undefined' ? window : global);
