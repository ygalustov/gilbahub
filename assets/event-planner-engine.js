/**
 * =============================================================================
 * GILBA EVENT PLANNER ENGINE v1.0.0
 * =============================================================================
 *
 * Sequential event simulation with carbohydrate reserve modelling.
 * Pure functions — no DOM access, no globals mutated.
 *
 * Physics ported from PHP class-rig-placement-calculator.php:
 *   calculate_daily_reserve_change() (line 2565)
 *   reserves_to_health() (line 2637)
 *   estimate_recovery_time() (line 2670)
 *
 * References:
 *   Canaway & Bell 1986 — Wear tolerance methodology
 *   Carrow & Petrovic 1992 — Traffic stress (Turfgrass monograph ch.12)
 *   Gelernter et al. 2005 — Minimum standards for stadium turf
 *   Bell & Danneberger 1999 — Shade × nitrogen interaction
 *   Christians et al. 2017 — Fundamentals of Turfgrass Management (5th ed.)
 *
 * @author  Gilba Solutions
 * @version 1.0.0
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.0';

    // =========================================================================
    // EVENT TYPE DEFINITIONS
    // =========================================================================

    var EVENT_TYPES = {
        // Sport — factors from scenario engine (Gelernter et al. 2005)
        soccer:            { factor: 1.0,  label: 'Football/Soccer',      category: 'sport',     icon: '⚽' },
        rugby_league:      { factor: 1.3,  label: 'Rugby League (NRL)',   category: 'sport',     icon: '🏉' },
        rugby_union:       { factor: 1.4,  label: 'Rugby Union',          category: 'sport',     icon: '🏉' },
        afl:               { factor: 1.2,  label: 'AFL',                  category: 'sport',     icon: '🏈' },
        cricket:           { factor: 0.6,  label: 'Cricket',              category: 'sport',     icon: '🏏' },
        american_football: { factor: 1.3,  label: 'American Football',    category: 'sport',     icon: '🏈' },
        baseball:          { factor: 0.5,  label: 'Baseball',             category: 'sport',     icon: '⚾' },
        jleague:           { factor: 1.0,  label: 'J.League Football',    category: 'sport',     icon: '⚽' },

        // Training
        training_match:    { factor: 0.8,  label: 'Training (match sim)', category: 'training',  icon: '🏃' },
        training_drills:   { factor: 0.6,  label: 'Training (drills)',    category: 'training',  icon: '🏃' },
        training_light:    { factor: 0.3,  label: 'Training (light)',     category: 'training',  icon: '🏃' },

        // Non-sport (operational estimates — low confidence)
        concert_standing:  { factor: 2.5,  label: 'Concert (standing/GA)', category: 'non_sport', icon: '🎵',
                             confidence: 'low' },
        concert_seated:    { factor: 1.8,  label: 'Concert (seated)',      category: 'non_sport', icon: '🎵',
                             confidence: 'low' },
        festival:          { factor: 3.0,  label: 'Multi-day Festival',    category: 'non_sport', icon: '🎪',
                             confidence: 'low' },
        motorsport:        { factor: 3.5,  label: 'Motorsport/Stunt',     category: 'non_sport', icon: '🏎️',
                             confidence: 'low' },
        community_event:   { factor: 0.8,  label: 'Community Event',       category: 'non_sport', icon: '🎉' },
        ceremony:          { factor: 0.4,  label: 'Ceremony/Graduation',   category: 'non_sport', icon: '🎓' },
        corporate:         { factor: 0.5,  label: 'Corporate Function',    category: 'non_sport', icon: '💼' },

        // Logistics
        setup_only:        { factor: 0.2,  label: 'Setup/Bumpout',         category: 'logistics', icon: '🚛',
                             zeroDLI: true },
        covered_rest:      { factor: 0.0,  label: 'Pitch Cover (protection)', category: 'logistics', icon: '🛡️',
                             zeroDLI: true }
    };

    // =========================================================================
    // SPECIES TRAIT DEFAULTS
    // Sourced from rig-placement-calculator.php species profiles
    // =========================================================================

    var SPECIES_TRAITS = {
        perennial_ryegrass: {
            min_dli: 12, optimal_dli: 18, compensation_dli: 8,
            carb_reserve_days: 7, max_decline_rate: 8,
            recovery_rate: 2.5, root_factor: 1.0,
            wearTolerance: 1.0, isC4: false,
            label: 'Perennial Ryegrass'
        },
        kentucky_bluegrass: {
            min_dli: 10, optimal_dli: 16, compensation_dli: 6,
            carb_reserve_days: 10, max_decline_rate: 6,
            recovery_rate: 2.0, root_factor: 1.1,
            wearTolerance: 0.9, isC4: false,
            label: 'Kentucky Bluegrass'
        },
        tall_fescue: {
            min_dli: 11, optimal_dli: 17, compensation_dli: 7,
            carb_reserve_days: 8, max_decline_rate: 7,
            recovery_rate: 2.0, root_factor: 1.2,
            wearTolerance: 1.1, isC4: false,
            label: 'Tall Fescue'
        },
        couch: {
            min_dli: 20, optimal_dli: 25, compensation_dli: 12,
            carb_reserve_days: 5, max_decline_rate: 10,
            recovery_rate: 3.0, root_factor: 0.8,
            wearTolerance: 1.3, isC4: true,
            label: 'Couch / Bermudagrass'
        },
        kikuyu: {
            min_dli: 18, optimal_dli: 22, compensation_dli: 10,
            carb_reserve_days: 6, max_decline_rate: 9,
            recovery_rate: 4.0, root_factor: 0.9,
            wearTolerance: 1.4, isC4: true,
            label: 'Kikuyu'
        },
        zoysia: {
            min_dli: 15, optimal_dli: 20, compensation_dli: 10,
            carb_reserve_days: 12, max_decline_rate: 5,
            recovery_rate: 1.5, root_factor: 1.0,
            wearTolerance: 1.2, isC4: true,
            label: 'Zoysia'
        },
        buffalo: {
            min_dli: 8, optimal_dli: 14, compensation_dli: 5,
            carb_reserve_days: 14, max_decline_rate: 4,
            recovery_rate: 1.0, root_factor: 1.0,
            wearTolerance: 0.7, isC4: true,
            label: 'Buffalo / St. Augustine'
        }
    };

    // =========================================================================
    // INTERVENTION DEFINITIONS
    // =========================================================================

    // =========================================================================
    // INTERVENTION DEFINITIONS
    // Pre-event protocols: Gilba Solutions — "Managing turfgrass for
    //   off-season events" (gilbasolutions.com, 2025)
    // Post-event protocols: research-backed + operational best practice
    // =========================================================================

    var INTERVENTION_TYPES = {
        // --- PRE-EVENT ---
        pgr_pre_event: {
            label: 'PGR (Trinexapac-ethyl) Pre-Event',
            category: 'pre_event', timing: 'pre',
            leadTimeDays: 5,
            reserveDepletionMod: 0.65,  // 35% slower reserve burn under covers
            wearToleranceBoost: 1.15,
            diseaseRiskMod: 0.7,
            duration: 21,
            effect: 'Slows growth/respiration/transpiration under covers. Time so effect ' +
                    'expires at cover removal. Apply >= 5 days before covers (3-day onset).',
            reference: 'Gilba Solutions 2025; Ervin & Koski 2001'
        },
        fungicide_pre_event: {
            label: 'Preventive Fungicide (Pythium)',
            category: 'pre_event', timing: 'pre',
            leadTimeDays: 3,
            diseaseRiskMod: 0.3,
            duration: 21,
            effect: 'Segway (cyazofamid) 14-28d Pythium protection; or Lexicon Intrinsic ' +
                    'broad-spectrum + plant health benefits. Essential before covers in warm weather.',
            reference: 'Gilba Solutions 2025'
        },
        anti_transpirant: {
            label: 'Anti-transpirant Spray',
            category: 'pre_event', timing: 'pre',
            leadTimeDays: 2,
            reserveDepletionMod: 0.85,
            diseaseRiskMod: 0.8,
            duration: 14,
            effect: 'Reduces stomatal water loss and can suppress disease germination under covers.',
            reference: 'Haggag 2002; Gilba Solutions 2025'
        },
        mow_low: {
            label: 'Reduce Mowing Height',
            category: 'pre_event', timing: 'pre',
            leadTimeDays: 3,
            wearToleranceBoost: 1.1,
            reserveDepletionMod: 0.9,
            duration: 0,
            effect: 'Mow as short as possible without scalping. High-cut turf is more prone ' +
                    'to damage and etiolation under covers.',
            reference: 'Gilba Solutions 2025'
        },
        cease_irrigation: {
            label: 'Cease Irrigation',
            category: 'pre_event', timing: 'pre',
            leadTimeDays: 2,
            wearDamageMod: 0.8,
            duration: 0,
            effect: 'Firm/dry surface reduces compaction and physical damage from traffic loads. ' +
                    'NEVER irrigate before an event.',
            reference: 'Gilba Solutions 2025'
        },

        // --- POST-EVENT ---
        led_deploy: {
            label: 'Deploy LED / Grow Light Rigs',
            category: 'post_event', timing: 'post',
            dliBoost: 8,
            duration: -1,
            effect: 'Supplemental DLI accelerates photosynthesis + recovery. ' +
                    'SeeGrow units with CO2 canopy: up to 10mm growth/24h (CommBank Stadium).',
            reference: 'Gilba Solutions 2025; SeeGrow/SGL operational'
        },
        restrict_access: {
            label: 'Restrict Training Access',
            category: 'post_event', timing: 'post',
            wearFactor: 0,
            duration: -1,
            effect: 'Zero training load during recovery window.',
            reference: 'Best practice'
        },
        fertilise_n: {
            label: 'Nitrogen Application (post-event ONLY)',
            category: 'post_event', timing: 'post',
            minDaysAfterEvent: 3,
            recoveryMultiplier: 1.3,
            duration: 10,
            effect: 'Boosts recovery rate ~30% for 7-14 days. NEVER apply before event — ' +
                    'high N makes turf prone to damage and disease.',
            reference: 'Christians et al. 2017; Gilba Solutions 2025'
        },
        aeration: {
            label: 'Solid Tine Aeration',
            category: 'post_event', timing: 'post',
            minDaysAfterEvent: 3,
            recoveryMultiplier: 1.25,
            duration: 14,
            minDaysBeforeNextEvent: 21,
            effect: 'Relieves compaction from traffic/staging. ' +
                    'Improves gas exchange and root growth. Needs 21 days before next event.',
            reference: 'Carrow 2003'
        },
        lay_and_play: {
            label: 'Lay and Play (Full Replacement)',
            category: 'post_event', timing: 'post',
            healthReset: 90,
            leadTimeDays: 5,
            effect: 'Full field replacement in 3-5 days, play commences immediately. ' +
                    'Use when health < 30% and recovery window insufficient.',
            reference: 'Gilba Solutions 2025; HG Turf Group / Evergreen Turf'
        }
    };

    // =========================================================================
    // CORE PHYSICS (ported from PHP)
    // =========================================================================

    /**
     * Daily carbohydrate reserve change.
     * Direct port of class-rig-placement-calculator.php line 2565.
     */
    function calculateDailyReserveChange(
        currentReserves, actualDLI, minDLI, optimalDLI, compensationDLI,
        reserveCapacityDays, maxDeclineRate, recoveryRate, rootFactor,
        cumulativeStressDays
    ) {
        var effectiveCapacity = reserveCapacityDays * rootFactor;

        if (actualDLI >= optimalDLI) {
            var rp = (100 - currentReserves) / 100;
            return Math.min(100, currentReserves + recoveryRate * rp * 1.5);

        } else if (actualDLI >= minDLI) {
            var ratio = (actualDLI - minDLI) / (optimalDLI - minDLI);
            var rp2 = (100 - currentReserves) / 100;
            return Math.min(100, currentReserves + recoveryRate * ratio * rp2);

        } else if (actualDLI >= compensationDLI) {
            var defSev = (minDLI - actualDLI) / (minDLI - compensationDLI);
            var baseDecline = maxDeclineRate * 0.3 * defSev;
            var stressMult = 1 + (cumulativeStressDays / effectiveCapacity) * 0.5;
            return Math.max(0, currentReserves - baseDecline * stressMult);

        } else {
            var severity = actualDLI > 0
                ? (compensationDLI - actualDLI) / compensationDLI
                : 1.0;
            var bd = maxDeclineRate * (0.5 + 0.5 * severity);
            var depMult = 1 + ((100 - currentReserves) / 100) * 0.5;
            var sm = 1 + (cumulativeStressDays / effectiveCapacity);
            return Math.max(0, currentReserves - bd * depMult * sm);
        }
    }

    /**
     * Convert carbohydrate reserves to visible health score.
     * Port of reserves_to_health() (line 2637).
     * Visible symptoms lag behind actual reserve depletion.
     */
    function reservesToHealth(reserves, cumulativeStressDays) {
        // After extended stress, visible health tracks reserves closely
        var lagBuffer = Math.max(0, 5 - cumulativeStressDays * 0.3);

        if (reserves >= 80) {
            return Math.max(85, reserves);
        } else if (reserves >= 50) {
            return reserves + lagBuffer;
        } else {
            return Math.max(0, reserves - Math.max(0, 5 - lagBuffer));
        }
    }

    /**
     * Growth potential from temperature (Gaussian model).
     * Port of scenario engine getGrowthPotential().
     */
    function getGrowthPotential(tempMean, isC4) {
        if (isC4) {
            return Math.max(0, Math.min(100,
                100 * Math.exp(-0.5 * Math.pow((tempMean - 31) / 7.5, 2))));
        } else {
            return Math.max(0, Math.min(100,
                100 * Math.exp(-0.5 * Math.pow((tempMean - 20) / 6.5, 2))));
        }
    }

    // =========================================================================
    // EVENT DAMAGE CALCULATION
    // =========================================================================

    /**
     * Calculate acute damage from a single event.
     *
     * Calibration: 1.0 wearFactor × 1.5h standard duration = 5% reserve loss
     * on healthy actively-growing turf with average wear tolerance.
     */
    var CALIBRATION_FACTOR = 5;

    function calculateEventDamage(event, species, gp) {
        var type = EVENT_TYPES[event.type] || EVENT_TYPES.soccer;
        var baseWear = event.customLoadFactor || type.factor;
        var duration = event.duration || 1.5;

        // Duration scaling (diminishing — first 90 min does most damage)
        var durationFactor = 1 + 0.3 * Math.log(Math.max(1, duration)) / Math.log(2);

        // Crowd loading for non-sport events
        var crowd = event.crowd || 0;
        var crowdFactor = type.category === 'non_sport'
            ? 1 + Math.min(0.5, crowd / 80000)
            : 1.0;

        // Growth potential modifier
        // Actively growing turf absorbs wear better (higher shear strength)
        var gpModifier = gp > 60 ? 0.8 : gp > 30 ? 1.0 : 1.3;

        // Species wear tolerance
        var wearTol = species.wearTolerance || 1.0;

        var rawDamage = baseWear * durationFactor * crowdFactor * gpModifier;
        var reserveLoss = rawDamage * CALIBRATION_FACTOR / wearTol;

        return {
            reserveLoss: Math.min(40, Math.max(0, reserveLoss)),
            wearFactor: baseWear,
            gpModifier: gpModifier,
            crowdFactor: crowdFactor,
            durationFactor: durationFactor,
            stressDayEquivalent: Math.ceil(reserveLoss / 3),
            confidence: type.confidence || 'medium'
        };
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    function parseDate(s) {
        if (s instanceof Date) return new Date(s.getTime());
        var parts = String(s).split(/[-/T]/);
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    function addDays(d, n) {
        var r = parseDate(d);
        r.setDate(r.getDate() + n);
        return r;
    }

    function daysBetween(a, b) {
        var da = parseDate(a), db = parseDate(b);
        return Math.round((db - da) / 86400000);
    }

    function formatDate(d) {
        var dt = parseDate(d);
        var y = dt.getFullYear();
        var m = String(dt.getMonth() + 1).padStart(2, '0');
        var day = String(dt.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function formatDateShort(d) {
        var dt = parseDate(d);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return dt.getDate() + ' ' + months[dt.getMonth()];
    }

    // =========================================================================
    // BUILD EVENT MAP (expand setup/bumpout days)
    // =========================================================================

    function buildEventMap(events) {
        var map = {};
        events.forEach(function(evt) {
            var eventDate = parseDate(evt.date);
            var setupDays = evt.setupDays || 0;
            var bumpoutDays = evt.bumpoutDays || 0;

            // Setup phase (before event)
            for (var s = setupDays; s > 0; s--) {
                var sd = formatDate(addDays(eventDate, -s));
                if (!map[sd]) {
                    map[sd] = {
                        name: evt.name + ' (setup)',
                        type: 'setup_only',
                        phase: 'setup',
                        parentEvent: evt,
                        duration: 0,
                        crowd: 0
                    };
                }
            }

            // Event day
            var ed = formatDate(eventDate);
            map[ed] = {
                name: evt.name,
                type: evt.type,
                phase: 'event',
                parentEvent: evt,
                duration: evt.duration || 1.5,
                crowd: evt.crowd || 0,
                customLoadFactor: evt.customLoadFactor || null,
                category: (EVENT_TYPES[evt.type] || {}).category || 'sport'
            };

            // Bumpout phase (after event)
            for (var b = 1; b <= bumpoutDays; b++) {
                var bd = formatDate(addDays(eventDate, b));
                if (!map[bd]) {
                    map[bd] = {
                        name: evt.name + ' (bumpout)',
                        type: 'setup_only',
                        phase: 'bumpout',
                        parentEvent: evt,
                        duration: 0,
                        crowd: 0
                    };
                }
            }
        });
        return map;
    }

    // =========================================================================
    // BUILD CLIMATE ARRAY
    // =========================================================================

    /**
     * Build daily climate data for simulation window.
     * Uses real forecast for ≤8 days, climatological normals beyond.
     */
    function buildDailyClimate(startDate, totalDays, climateData, lat) {
        var daily = [];
        var absLat = Math.abs(lat || -33);
        var isNorthern = (lat || -33) >= 0;

        for (var d = 0; d < totalDays; d++) {
            var date = addDays(startDate, d);
            var dateStr = formatDate(date);

            // Try real forecast data first
            var found = null;
            if (climateData && climateData.daily) {
                for (var i = 0; i < (climateData.daily.time || []).length; i++) {
                    if (climateData.daily.time[i] === dateStr) {
                        found = {
                            tempMean: ((climateData.daily.temperature_2m_max || [])[i] +
                                       (climateData.daily.temperature_2m_min || [])[i]) / 2,
                            tempMin: (climateData.daily.temperature_2m_min || [])[i],
                            tempMax: (climateData.daily.temperature_2m_max || [])[i],
                            rain: (climateData.daily.precipitation_sum || [])[i] || 0,
                            source: 'forecast'
                        };
                        break;
                    }
                }
            }

            if (!found) {
                // Climatological normal estimate
                var doy = dayOfYear(date);
                found = estimateClimateFromNormals(doy, absLat, isNorthern);
                found.source = 'climatology';
            }

            // Estimate DLI from temperature/latitude if not provided
            if (!found.dli) {
                found.dli = estimateDLI(date, absLat, isNorthern);
            }

            found.date = dateStr;
            daily.push(found);
        }
        return daily;
    }

    function dayOfYear(d) {
        var dt = parseDate(d);
        var start = new Date(dt.getFullYear(), 0, 0);
        return Math.floor((dt - start) / 86400000);
    }

    function estimateClimateFromNormals(doy, absLat, isNorthern) {
        // Simple sinusoidal model for temperature
        // Peak at doy ~200 (NH) or ~17 (SH mid-Jan)
        var peakDoy = isNorthern ? 200 : 17;
        var meanAnnual = absLat < 25 ? 25 : absLat < 35 ? 20 : absLat < 45 ? 15 : 10;
        var amplitude = absLat < 25 ? 5 : absLat < 35 ? 8 : absLat < 45 ? 12 : 15;
        var phase = 2 * Math.PI * (doy - peakDoy) / 365;
        var temp = meanAnnual + amplitude * Math.cos(phase);

        return {
            tempMean: Math.round(temp * 10) / 10,
            tempMin: Math.round((temp - 5) * 10) / 10,
            tempMax: Math.round((temp + 5) * 10) / 10,
            rain: 0
        };
    }

    function estimateDLI(date, absLat, isNorthern) {
        var doy = dayOfYear(date);
        var peakDoy = isNorthern ? 172 : 355; // Solstice
        var phase = 2 * Math.PI * (doy - peakDoy) / 365;

        // Base DLI varies with latitude
        var baseDLI = absLat < 25 ? 45 : absLat < 35 ? 38 : absLat < 45 ? 30 : 22;
        var amplitude = absLat < 25 ? 8 : absLat < 35 ? 12 : absLat < 45 ? 16 : 18;

        return Math.max(5, Math.round((baseDLI + amplitude * Math.cos(phase)) * 10) / 10);
    }

    // =========================================================================
    // MAIN SIMULATION
    // =========================================================================

    /**
     * Run sequential event simulation.
     *
     * @param {Object} config
     * @param {Array}  config.events        — Sorted by date
     * @param {string} config.speciesKey    — Key into SPECIES_TRAITS
     * @param {number} config.startHealth   — 0-100
     * @param {number} config.startReserves — 0-100 (defaults to startHealth)
     * @param {number} config.dli           — Hub DLI_total (shade-adjusted)
     * @param {number} config.shadeFactor   — 0-1
     * @param {number} config.lat           — Latitude
     * @param {Object} config.climateData   — Raw weather data (optional)
     * @param {Array}  config.interventions — { date, type } (optional)
     * @returns {Object}
     */
    function simulate(config) {
        var events = (config.events || []).slice().sort(function(a, b) {
            return parseDate(a.date) - parseDate(b.date);
        });

        if (events.length === 0) {
            return { error: 'No events provided', trajectory: [], eventResults: [], pinchPoints: [] };
        }

        var species = SPECIES_TRAITS[config.speciesKey] || SPECIES_TRAITS.couch;
        var startReserves = config.startReserves || config.startHealth || 85;
        var reserves = startReserves;
        var health = config.startHealth || 85;
        var dli = config.dli || 25;
        var shadeFactor = config.shadeFactor || 1.0;
        var lat = config.lat || -33;

        // Time window: 7 days before first event to 28 days after last event
        var firstDate = addDays(events[0].date, -(events[0].setupDays || 0) - 7);
        var lastEvt = events[events.length - 1];
        var lastDate = addDays(lastEvt.date, (lastEvt.bumpoutDays || 0) + 28);
        var totalDays = daysBetween(firstDate, lastDate);

        // Build maps
        var eventMap = buildEventMap(events);
        var interventionMap = {};
        (config.interventions || []).forEach(function(iv) {
            interventionMap[formatDate(iv.date)] = iv;
        });

        // Build climate
        var dailyClimate = buildDailyClimate(firstDate, totalDays, config.climateData, lat);

        // Simulation state
        var cumulativeStressDays = 0;
        var trajectory = [];
        var eventResults = [];
        var pinchPoints = [];
        var activeInterventions = []; // { type, expiresDay }

        for (var d = 0; d < totalDays; d++) {
            var dateStr = dailyClimate[d] ? dailyClimate[d].date : formatDate(addDays(firstDate, d));
            var climate = dailyClimate[d] || { tempMean: 20, dli: dli };
            var gp = getGrowthPotential(climate.tempMean, species.isC4);

            // Check active interventions
            var recoveryMult = 1.0;
            var dliBoost = 0;
            activeInterventions = activeInterventions.filter(function(ai) {
                if (ai.expiresDay !== -1 && d >= ai.expiresDay) return false;
                var def = INTERVENTION_TYPES[ai.type];
                if (def && def.recoveryMultiplier) recoveryMult *= def.recoveryMultiplier;
                if (def && def.dliBoost) dliBoost += def.dliBoost;
                return true;
            });

            // Effective DLI
            var todayEvent = eventMap[dateStr] || null;
            var isCovered = todayEvent && (todayEvent.phase === 'setup' || todayEvent.phase === 'bumpout');
            var effectiveDLI = isCovered ? 0 : (climate.dli * shadeFactor + dliBoost);

            // New interventions today
            var iv = interventionMap[dateStr];
            if (iv) {
                var ivDef = INTERVENTION_TYPES[iv.type];
                if (ivDef) {
                    var expires = ivDef.duration === -1 ? -1 : d + (ivDef.duration || 7);
                    activeInterventions.push({ type: iv.type, expiresDay: expires });
                    if (ivDef.reserveGain) {
                        reserves = Math.min(100, reserves + ivDef.reserveGain);
                    }
                }
            }

            // Event day: apply damage
            if (todayEvent && todayEvent.phase === 'event') {
                var entryHealth = health;
                var entryReserves = reserves;
                var damage = calculateEventDamage(todayEvent, species, gp);
                reserves = Math.max(0, reserves - damage.reserveLoss);
                cumulativeStressDays += damage.stressDayEquivalent;
                health = reservesToHealth(reserves, cumulativeStressDays);

                eventResults.push({
                    name: todayEvent.name,
                    date: dateStr,
                    type: todayEvent.type,
                    healthAtEntry: Math.round(entryHealth * 10) / 10,
                    reservesAtEntry: Math.round(entryReserves * 10) / 10,
                    healthAfter: Math.round(health * 10) / 10,
                    reservesAfter: Math.round(reserves * 10) / 10,
                    damage: damage,
                    gp: Math.round(gp),
                    dli: Math.round(effectiveDLI * 10) / 10,
                    confidence: damage.confidence
                });

                if (entryHealth < 60) {
                    pinchPoints.push({
                        date: dateStr,
                        event: todayEvent.name,
                        health: Math.round(entryHealth),
                        severity: entryHealth < 40 ? 'critical' : 'concern',
                        message: 'Turf enters ' + todayEvent.name + ' at ' +
                                 Math.round(entryHealth) + '% health'
                    });
                }
            } else {
                // Recovery day (or depletion under cover)
                var adjustedRecoveryRate = species.recovery_rate * recoveryMult;
                var tempSpecies = Object.assign({}, species, { recovery_rate: adjustedRecoveryRate });

                reserves = calculateDailyReserveChange(
                    reserves, effectiveDLI,
                    species.min_dli, species.optimal_dli, species.compensation_dli,
                    species.carb_reserve_days, species.max_decline_rate,
                    tempSpecies.recovery_rate, species.root_factor,
                    cumulativeStressDays
                );

                if (effectiveDLI >= species.min_dli) {
                    cumulativeStressDays = Math.max(0, cumulativeStressDays - 0.5);
                }

                health = reservesToHealth(reserves, cumulativeStressDays);
            }

            trajectory.push({
                day: d,
                date: dateStr,
                health: Math.round(health * 10) / 10,
                reserves: Math.round(reserves * 10) / 10,
                gp: Math.round(gp),
                dli: Math.round(effectiveDLI * 10) / 10,
                event: todayEvent ? todayEvent.name : null,
                phase: todayEvent ? todayEvent.phase : 'recovery',
                intervention: iv ? iv.type : null
            });
        }

        // Identify inter-event recovery gaps
        var recoveryGaps = [];
        for (var i = 0; i < eventResults.length - 1; i++) {
            var curr = eventResults[i];
            var next = eventResults[i + 1];
            var gap = daysBetween(curr.date, next.date);
            if (curr.healthAfter < 70 && gap < 30) {
                // Estimate natural recovery
                var projected = projectNaturalRecovery(
                    curr.reservesAfter, gap, species, dailyClimate,
                    daysBetween(formatDate(firstDate), curr.date), shadeFactor
                );
                recoveryGaps.push({
                    afterEvent: curr.name,
                    beforeEvent: next.name,
                    gapDays: gap,
                    healthAfterDamage: curr.healthAfter,
                    projectedHealthAtNext: Math.round(projected),
                    sufficient: projected >= 65,
                    recommendations: projected < 65
                        ? generateRecommendations(gap, curr.healthAfter, projected, species, curr.type)
                        : generateRecommendations(gap, curr.healthAfter, projected, species, curr.type)
                            .filter(function(r) { return r.category === 'pre_event'; })
                });
            }
        }

        return {
            trajectory: trajectory,
            eventResults: eventResults,
            pinchPoints: pinchPoints,
            recoveryGaps: recoveryGaps,
            summary: buildSummary(trajectory, eventResults, pinchPoints, recoveryGaps),
            config: {
                species: species.label,
                speciesKey: config.speciesKey,
                startHealth: config.startHealth,
                dli: dli,
                shadeFactor: shadeFactor,
                eventCount: events.length
            }
        };
    }

    // =========================================================================
    // PROJECTION & RECOMMENDATIONS
    // =========================================================================

    function projectNaturalRecovery(startReserves, days, species, dailyClimate, climateOffset, shadeFactor) {
        var reserves = startReserves;
        var stress = 0;
        for (var d = 0; d < days; d++) {
            var ci = climateOffset + d;
            var climate = dailyClimate[ci] || { dli: 25 };
            var effectiveDLI = climate.dli * (shadeFactor || 1.0);
            reserves = calculateDailyReserveChange(
                reserves, effectiveDLI,
                species.min_dli, species.optimal_dli, species.compensation_dli,
                species.carb_reserve_days, species.max_decline_rate,
                species.recovery_rate, species.root_factor, stress
            );
            if (effectiveDLI >= species.min_dli) stress = Math.max(0, stress - 0.5);
        }
        return reservesToHealth(reserves, stress);
    }

    function generateRecommendations(gapDays, currentHealth, projectedHealth, species, eventType) {
        var recs = [];
        var deficit = 65 - projectedHealth;
        var type = EVENT_TYPES[eventType] || {};
        var hasCovers = type.category === 'non_sport' || type.zeroDLI;

        // =============================================================
        // PRE-EVENT RECOMMENDATIONS
        // Source: Gilba Solutions — "Managing turfgrass for off-season events"
        // =============================================================

        // PGR before covers (concerts, festivals — anything with setup period)
        if (hasCovers) {
            recs.push({
                type: 'pgr_pre_event',
                timing: 'Day -5 before covers',
                label: 'Apply trinexapac-ethyl (Amigo 120 / Primo 250EC). ' +
                       'Slows respiration under covers, reducing reserve depletion ~35%.',
                priority: 'high',
                category: 'pre_event'
            });
        }

        // Preventive fungicide before covers (warm weather + covers = Pythium)
        if (hasCovers) {
            recs.push({
                type: 'fungicide_pre_event',
                timing: 'Day -3 before covers',
                label: 'Preventive fungicide (Segway for Pythium; Lexicon Intrinsic for broad-spectrum). ' +
                       'Covered turf in warm conditions is highly susceptible to disease.',
                priority: 'high',
                category: 'pre_event'
            });
        }

        // Anti-transpirant
        if (hasCovers) {
            recs.push({
                type: 'anti_transpirant',
                timing: 'Day -2 before covers',
                label: 'Apply anti-transpirant to reduce stomatal water loss under covers.',
                priority: 'medium',
                category: 'pre_event'
            });
        }

        // Mow low before event
        recs.push({
            type: 'mow_low',
            timing: 'Day -3 before event',
            label: 'Reduce mowing height as low as possible without scalping. ' +
                   'High-cut turf suffers more under traffic and covers.',
            priority: 'medium',
            category: 'pre_event'
        });

        // Cease irrigation
        recs.push({
            type: 'cease_irrigation',
            timing: 'Day -2 before event',
            label: 'Cease irrigation. Firm dry surface reduces compaction and physical damage. ' +
                   'Do NOT irrigate before an event.',
            priority: 'high',
            category: 'pre_event'
        });

        // WARNING: Never apply N before event
        recs.push({
            type: 'warning_no_n',
            timing: 'Pre-event',
            label: 'DO NOT apply high-nitrogen fertiliser before the event. ' +
                   'High N makes turf more prone to damage and disease under traffic/covers.',
            priority: 'critical',
            category: 'pre_event'
        });

        // =============================================================
        // POST-EVENT RECOMMENDATIONS
        // =============================================================

        // LED rigs for severe damage
        if (deficit > 10) {
            recs.push({
                type: 'led_deploy',
                timing: 'Day +1 after covers removed',
                label: 'Deploy LED grow light rigs on damaged zones (+8 mol/day). ' +
                       'SeeGrow with CO2 canopy achieves 10mm growth/24h.',
                priority: 'high',
                category: 'post_event'
            });
        }

        // Restrict training
        recs.push({
            type: 'restrict_access',
            timing: 'Day +1 to +' + Math.min(gapDays - 3, 14),
            label: 'Restrict all training access during recovery.',
            priority: 'high',
            category: 'post_event'
        });

        // N application post-event (never pre-event)
        if (gapDays >= 5) {
            recs.push({
                type: 'fertilise_n',
                timing: 'Day +3 after event (NEVER before)',
                label: 'Foliar N application (25 kg/ha) to boost recovery rate ~30%.',
                priority: 'medium',
                category: 'post_event'
            });
        }

        // Aeration if gap allows 21+ day recovery before next event
        if (currentHealth < 55 && gapDays >= 25) {
            recs.push({
                type: 'aeration',
                timing: 'Day +3 to +5 if compaction evident',
                label: 'Solid-tine aeration to relieve compaction. Needs 21 days before next event.',
                priority: 'medium',
                category: 'post_event'
            });
        }

        // Lay and Play if turf is destroyed
        if (projectedHealth < 30 && gapDays >= 7) {
            recs.push({
                type: 'lay_and_play',
                timing: 'Day +1 (plan 3-5 day install)',
                label: 'Full field replacement (Lay and Play). 3-5 day install, ' +
                       'play commences immediately. Consider when health < 30%.',
                priority: 'high',
                category: 'post_event'
            });
        }

        // Emergency overseed for C3 if damaged but not destroyed
        if (deficit > 20 && projectedHealth >= 30 && species.isC4 === false) {
            recs.push({
                type: 'overseed',
                timing: 'Day +3 if bare areas > 20%',
                label: 'Emergency overseed on bare patches (PRG for fast establishment).',
                priority: 'low',
                category: 'post_event'
            });
        }

        return recs;
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================

    function buildSummary(trajectory, eventResults, pinchPoints, recoveryGaps) {
        var minHealth = 100, minDate = '', daysBelow60 = 0, daysBelow40 = 0;

        trajectory.forEach(function(t) {
            if (t.health < minHealth) {
                minHealth = t.health;
                minDate = t.date;
            }
            if (t.health < 60) daysBelow60++;
            if (t.health < 40) daysBelow40++;
        });

        var risk = 'LOW';
        if (daysBelow40 > 0 || pinchPoints.some(function(p) { return p.severity === 'critical'; })) {
            risk = 'HIGH';
        } else if (daysBelow60 > 5 || pinchPoints.length > 0) {
            risk = 'MODERATE';
        }

        // Overall confidence
        var hasNonSport = eventResults.some(function(e) {
            return (EVENT_TYPES[e.type] || {}).category === 'non_sport';
        });
        var windowDays = trajectory.length;

        var confidence = 'medium';
        if (hasNonSport) confidence = 'low';
        else if (windowDays > 60) confidence = 'low';
        else if (windowDays > 30) confidence = 'medium';
        else confidence = 'high';

        return {
            eventCount: eventResults.length,
            windowDays: windowDays,
            minHealth: minHealth,
            minHealthDate: minDate,
            daysBelow60: daysBelow60,
            daysBelow40: daysBelow40,
            pinchPointCount: pinchPoints.length,
            criticalCount: pinchPoints.filter(function(p) { return p.severity === 'critical'; }).length,
            insufficientGaps: recoveryGaps.filter(function(g) { return !g.sufficient; }).length,
            risk: risk,
            confidence: confidence
        };
    }

    // =========================================================================
    // RESOLVE SPECIES FROM HUB STATE
    // =========================================================================

    function resolveSpeciesKey(hubState) {
        var gs = (hubState && hubState.turf && hubState.turf.grassSpecies) || '';
        gs = gs.toLowerCase().replace(/\s+/g, '_');

        if (gs.indexOf('ryegrass') > -1 || gs.indexOf('rye') > -1) return 'perennial_ryegrass';
        if (gs.indexOf('kentucky') > -1 || gs.indexOf('kbg') > -1) return 'kentucky_bluegrass';
        if (gs.indexOf('tall_fescue') > -1 || gs.indexOf('fescue') > -1) return 'tall_fescue';
        if (gs.indexOf('couch') > -1 || gs.indexOf('bermuda') > -1 || gs.indexOf('santa_anna') > -1 || gs.indexOf('tiftuf') > -1 || gs.indexOf('tahoma') > -1) return 'couch';
        if (gs.indexOf('kikuyu') > -1) return 'kikuyu';
        if (gs.indexOf('zoysia') > -1) return 'zoysia';
        if (gs.indexOf('buffalo') > -1 || gs.indexOf('st._augustine') > -1) return 'buffalo';

        return 'couch'; // Default for Australian stadiums
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    global.GSSH_EventPlannerEngine = {
        VERSION: VERSION,
        EVENT_TYPES: EVENT_TYPES,
        SPECIES_TRAITS: SPECIES_TRAITS,
        INTERVENTION_TYPES: INTERVENTION_TYPES,
        simulate: simulate,
        resolveSpeciesKey: resolveSpeciesKey,
        getGrowthPotential: getGrowthPotential,
        formatDate: formatDate,
        formatDateShort: formatDateShort,
        daysBetween: daysBetween
    };

    console.log('[EventPlanner] Engine v' + VERSION + ' loaded');

})(typeof window !== 'undefined' ? window : this);
