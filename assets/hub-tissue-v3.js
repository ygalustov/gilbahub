"use strict";
// b35fix309: GAIP_HUB_VERSION injected from PHP GILBA_HUB_VERSION via
// wp_add_inline_script on 'gilba-hub-v2-core'. Do not reintroduce a hardcoded
// literal here — it will silently drift from the plugin version.

// =============================================================================
// SPECIES pH TOLERANCE CONFIGURATION
// =============================================================================
// Research-based optimal and tolerance ranges for turfgrass species
// Sources: Christians et al. (2016) Fundamentals of Turfgrass Management;
//          Carrow et al. (2001) Turfgrass Soil Fertility and Chemical Problems;
//          Turgeon (2011) Turfgrass Management
// =============================================================================
var SPECIES_PH_TOLERANCE = {
    // Cool-season (C3) species
    "Creeping Bentgrass": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.0],
        acidTolerant: true,
        alkalineTolerant: false
    },
    "Creeping Bentgrass (Greens)": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.0],
        acidTolerant: true,
        alkalineTolerant: false,
    },
    "Creeping Bentgrass (Fairway)": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.0],
        acidTolerant: true,
        alkalineTolerant: false,
    },
    "Colonial Bentgrass": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.0],
        acidTolerant: true,
        alkalineTolerant: false
    },
    "Browntop Bent": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.0],
        acidTolerant: true,
        alkalineTolerant: false
    },
    "Poa annua": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.5],
        acidTolerant: true,
        alkalineTolerant: false
    },
    "Perennial Ryegrass": {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 7.5],
        acidTolerant: false,
        alkalineTolerant: false
    },
    "Kentucky Bluegrass": {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 8.0],
        acidTolerant: false,
        alkalineTolerant: true
    },
    "Tall Fescue": {
        optimal: [5.5, 6.5],
        tolerance: [4.5, 8.0],
        acidTolerant: true,
        alkalineTolerant: true
    },
    "Fine Fescue": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.5],
        acidTolerant: true,
        alkalineTolerant: false
    },
    "Chewings Fescue": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.0],
        acidTolerant: true,
        alkalineTolerant: false
    },
    "Chewings Fescue (Greens)": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.0],
        acidTolerant: true,
        alkalineTolerant: false,
    },
    "Slender Creeping Red Fescue": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.5],
        acidTolerant: true,
        alkalineTolerant: false,
    },
    "Strong Creeping Red Fescue": {
        optimal: [5.5, 6.5],
        tolerance: [5.0, 7.5],
        acidTolerant: true,
        alkalineTolerant: false,
    },

    // Warm-season (C4) species
    Couch: {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 8.5],
        acidTolerant: false,
        alkalineTolerant: true
    },
    Bermuda: {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 8.5],
        acidTolerant: false,
        alkalineTolerant: true
    },
    Bermudagrass: {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 8.5],
        acidTolerant: false,
        alkalineTolerant: true
    },
    Zoysia: {
        optimal: [6.0, 6.5],
        tolerance: [5.5, 7.5],
        acidTolerant: false,
        alkalineTolerant: false
    },
    Kikuyu: {
        optimal: [5.5, 7.0],
        tolerance: [5.0, 8.0],
        acidTolerant: true,
        alkalineTolerant: true
    },
    "Seashore Paspalum": {
        optimal: [6.0, 7.0],
        tolerance: [4.0, 9.5],
        acidTolerant: true,
        alkalineTolerant: true
    },
    Paspalum: {
        optimal: [6.0, 7.0],
        tolerance: [4.0, 9.5],
        acidTolerant: true,
        alkalineTolerant: true
    },
    Buffalo: {
        optimal: [6.0, 7.5],
        tolerance: [5.0, 8.5],
        acidTolerant: false,
        alkalineTolerant: true
    },
    Buffalograss: {
        optimal: [6.0, 7.5],
        tolerance: [5.0, 8.5],
        acidTolerant: false,
        alkalineTolerant: true
    },
    "St. Augustine": {
        optimal: [6.0, 7.5],
        tolerance: [5.0, 8.5],
        acidTolerant: false,
        alkalineTolerant: true
    },

    // Defaults for unrecognised species
    C3: {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 7.5],
        acidTolerant: false,
        alkalineTolerant: false
    },
    C4: {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 8.0],
        acidTolerant: false,
        alkalineTolerant: true
    },
    default: {
        optimal: [6.0, 7.0],
        tolerance: [5.5, 7.5],
        acidTolerant: false,
        alkalineTolerant: false
    },
};

/**
 * Normalise species string for pH tolerance lookup
 * @param {string} species - Raw species string from UI
 * @returns {string} Normalised species key or default
 */
function normaliseSpeciesForPH(species) {
    if (!species) return "default";

    var s = String(species).toLowerCase().trim();

    // Direct matches (case-insensitive)
    for (var key in SPECIES_PH_TOLERANCE) {
        if (key.toLowerCase() === s) return key;
    }

    // Partial matches
    if (s.includes("bent")) {
        if (s.includes("browntop")) return "Browntop Bent"; // must precede "green" — "Browntop Bent (Greens)" contains both
        if (s.includes("green")) return "Creeping Bentgrass (Greens)";
        if (s.includes("fairway")) return "Creeping Bentgrass (Fairway)";
        if (s.includes("colonial")) return "Colonial Bentgrass";
        return "Creeping Bentgrass";
    }
    if (s.includes("poa")) return "Poa annua";
    if (s.includes("rye")) return "Perennial Ryegrass";
    if (s.includes("kentucky") || s.includes("kbg") || s.includes("bluegrass")) return "Kentucky Bluegrass";
    if (s.includes("tall") && s.includes("fescue")) return "Tall Fescue";
    if (s.includes("chewing") && s.includes("fescue"))
        return s.includes("green") ? "Chewings Fescue (Greens)" : "Chewings Fescue";
    if (s.includes("slender") && s.includes("fescue")) return "Slender Creeping Red Fescue";
    if ((s.includes("strong") || s.includes("creeping red")) && s.includes("fescue")) return "Strong Creeping Red Fescue";
    if (s.includes("fine") && s.includes("fescue")) return "Fine Fescue";
    if (s.includes("chewing")) return s.includes("green") ? "Chewings Fescue (Greens)" : "Chewings Fescue";
    if (s.includes("fescue")) return "Fine Fescue";

    if (s.includes("couch") || s.includes("bermuda") || s.includes("cynodon")) return "Couch";
    if (s.includes("zoysia")) return "Zoysia";
    if (s.includes("kikuyu")) return "Kikuyu";
    if (s.includes("paspalum") || s.includes("seashore")) return "Seashore Paspalum";
    if (s.includes("buffalo") || s.includes("st. augustine") || s.includes("stenotaphrum")) return "Buffalo";

    // C3/C4 fallback
    if (s.includes("c3") || s.includes("cool")) return "C3";
    if (s.includes("c4") || s.includes("warm")) return "C4";

    return "default";
}

/**
 * Assess species-specific pH tolerance
 * @param {number} pH - Soil pH value
 * @param {string} species - Grass species
 * @returns {Object|null} Species pH assessment or null if no species
 */
function assessSpeciesPHTolerance(pH, species) {
    if (!pH || pH === 0 || !species) return null;

    var speciesKey = normaliseSpeciesForPH(species);
    var tolerance = SPECIES_PH_TOLERANCE[speciesKey] || SPECIES_PH_TOLERANCE["default"];

    var optMin = tolerance.optimal[0];
    var optMax = tolerance.optimal[1];
    var tolMin = tolerance.tolerance[0];
    var tolMax = tolerance.tolerance[1];

    var status, severity, message, recommendation;

    // Check if pH is within optimal range
    if (pH >= optMin && pH <= optMax) {
        status = "optimal";
        severity = "none";
        message =
            speciesKey +
            " optimal pH range is " +
            optMin.toFixed(1) +
            "–" +
            optMax.toFixed(1) +
            ". Current pH (" +
            pH.toFixed(1) +
            ") is ideal.";
        recommendation = null;
    }
    // Check if within tolerance but not optimal
    else if (pH >= tolMin && pH <= tolMax) {
        status = "tolerable";
        severity = "low";

        if (pH < optMin) {
            message =
                speciesKey +
                " prefers pH " +
                optMin.toFixed(1) +
                "–" +
                optMax.toFixed(1) +
                ". Current pH (" +
                pH.toFixed(1) +
                ") is below optimal but within tolerance (" +
                tolMin.toFixed(1) +
                "–" +
                tolMax.toFixed(1) +
                ").";
            recommendation = tolerance.acidTolerant ?
                "Species tolerates acidic conditions. Monitor only — no urgent correction needed." :
                "Consider gradual lime application to raise pH toward " + optMin.toFixed(1) + ".";
        } else {
            message =
                speciesKey +
                " prefers pH " +
                optMin.toFixed(1) +
                "–" +
                optMax.toFixed(1) +
                ". Current pH (" +
                pH.toFixed(1) +
                ") is above optimal but within tolerance (" +
                tolMin.toFixed(1) +
                "–" +
                tolMax.toFixed(1) +
                ").";
            recommendation = tolerance.alkalineTolerant ?
                "Species tolerates alkaline conditions. Focus on trace element management rather than aggressive acidification." :
                "Monitor for chlorosis. Consider acidification if Fe deficiency symptoms appear.";
        }
    }
    // Outside tolerance range
    else {
        status = "stress";

        if (pH < tolMin) {
            severity = "high";
            message =
                "⚠️ SPECIES ALERT: " +
                speciesKey +
                " tolerance range is pH " +
                tolMin.toFixed(1) +
                "–" +
                tolMax.toFixed(1) +
                ". Current pH (" +
                pH.toFixed(1) +
                ") is below minimum tolerance.";
            recommendation = "URGENT: Apply lime to raise pH. Al/Mn toxicity risk at this pH level for " + speciesKey + ".";
        } else {
            severity = tolerance.alkalineTolerant ? "moderate" : "high";
            message =
                "⚠️ SPECIES ALERT: " +
                speciesKey +
                " tolerance range is pH " +
                tolMin.toFixed(1) +
                "–" +
                tolMax.toFixed(1) +
                ". Current pH (" +
                pH.toFixed(1) +
                ") exceeds maximum tolerance.";

            if (tolerance.alkalineTolerant) {
                recommendation =
                    "Species has moderate alkaline tolerance. Prioritise chelated trace elements (Fe-EDDHA) over aggressive acidification.";
            } else {
                recommendation =
                    "URGENT: Acidification strongly recommended. " +
                    speciesKey +
                    " is not alkaline-tolerant — expect significant stress at this pH.";
            }
        }
    }

    return {
        species: speciesKey,
        inputSpecies: species,
        pH: pH,
        status: status,
        severity: severity,
        optimalRange: tolerance.optimal,
        toleranceRange: tolerance.tolerance,
        acidTolerant: tolerance.acidTolerant,
        alkalineTolerant: tolerance.alkalineTolerant,
        message: message,
        recommendation: recommendation,
    };
}

// =============================================================================
// CASCADE ORCHESTRATOR INTEGRATION
// =============================================================================
// SSOT MODE: All engine calls route through GilbaCascadeOrchestrator
// Legacy engine execution path has been removed - cascade is the only path
// Ensure hub-cascade-adapter.js is loaded BEFORE this file
var GAIP_USE_CASCADE = true; // Always enabled in SSOT mode

/**
 * Transform DOM state to cascade orchestrator format
 * Converts gaip_build_state() output to the format expected by GilbaCascadeOrchestrator.runCascade()
 *
 * @param {Object} domState - State from gaip_build_state()
 * @param {Object} weather - Weather data from gaip_fetch_weather()
 * @returns {Object} Cascade-formatted state { inputs, computed, derived }
 */
function gaip_transformToCascadeFormat(domState, weather) {
    return {
        inputs: {
            // Climate inputs
            climate: {
                lat: domState.climate?.lat || -35,
                lon: domState.climate?.lon || 150,
                forecast: weather?.forecast || null,
                historical: weather?.historical || null,
                manual: domState.climate?.manual || null,
            },
            // Turf profile
            turf: {
                warmBase: domState.turf?.warmBase || "",
                coolOverseed: domState.turf?.coolOverseed || "",
                percentC3Cover: domState.turf?.percentC3Cover || 0,
                hoc: domState.turf?.hoc || 25,
                nProgramKgHaYr: domState.turf?.nProgramKgHaYr || 0,
                construction: domState.turf?.construction ||
                    // GSSH DOM has no .gaip-construction field — read from GAIP_CANONICAL_STATE
                    (window.GAIP_CANONICAL_STATE &&
                        window.GAIP_CANONICAL_STATE.turf &&
                        window.GAIP_CANONICAL_STATE.turf.construction ?
                        window.GAIP_CANONICAL_STATE.turf.construction :
                        "") ||
                    "",
                drainage: domState.turf?.drainage || "",
                grassSpecies: domState.turf?.grassSpecies ||
                    // GSSH pages have no .gaip-grass-species DOM field.
                    // GAIP_CANONICAL_STATE is populated by the orchestrator before hub-tissue runs.
                    (window.GAIP_CANONICAL_STATE &&
                        window.GAIP_CANONICAL_STATE.turf &&
                        window.GAIP_CANONICAL_STATE.turf.speciesKey ?
                        window.GAIP_CANONICAL_STATE.turf.speciesKey :
                        "") ||
                    // Fallback: GAIP_CANONICAL_STATE may be empty on run #1 (triggerAutoRun
                    // fires before selectVenue). Read turf from GilbaStadiumData via URL param.
                    (function() {
                        try {
                            var _venueId =
                                new URLSearchParams(window.location.search).get("venue") ||
                                new URLSearchParams(window.location.search).get("gssh_venue");
                            if (
                                _venueId &&
                                window.GilbaStadiumData &&
                                window.GilbaStadiumData.stadiums &&
                                window.GilbaStadiumData.stadiums[_venueId] &&
                                window.GilbaStadiumData.stadiums[_venueId].turf &&
                                window.GilbaStadiumData.stadiums[_venueId].turf.species
                            ) {
                                return window.GilbaStadiumData.stadiums[_venueId].turf.species;
                            }
                        } catch (e) {}
                        return "";
                    })() ||
                    "",
                cleggHammer: domState.turf?.cleggHammer || 0,
                cleggMax: domState.turf?.cleggMax || 0,
                cleggMin: domState.turf?.cleggMin || 0,
                dli: domState.turf?.dli || 0,
                ledPPFD: domState.turf?.ledPPFD || 0,
                ledHours: domState.turf?.ledHours || 0,
                ambientDLI: domState.turf?.ambientDLI || 0,
                trafficLevel: domState.turf?.trafficLevel || "moderate",
                pgrActive: domState.turf?.pgrActive || false,
            },
            // Soil inputs
            soil: {
                bulkDensity: domState.soil?.bulkDensity || 1.4,
                surfaceType: domState.soil?.surfaceType || "",
                pH_water: domState.soil?.pH_water || 0,
                pH_cacl2: domState.soil?.pH_cacl2 || 0,
                CEC: domState.soil?.CEC || 0,
                LOI: domState.soil?.LOI || 0,
                ppm: domState.soil?.ppm || {},
                meq: domState.soil?.meq || {},
            },
            // Water inputs
            water: {
                ecw: domState.water?.ecw || 0,
                EC: domState.water?.EC || domState.water?.ecw || 0,
                pH: domState.water?.pH || 7,
                ions: domState.water?.ions || {},
                SAR: domState.water?.SAR || 0,
                adjSAR: domState.water?.adjSAR || 0,
            },
            // Schedule/traffic inputs
            schedule: {
                matchesPerWeek: domState.traffic?.matchesPerWeek || 0,
                sessionsPerWeek: domState.traffic?.sessionsPerWeek || 0,
                restDays: domState.traffic?.restDays || 0,
                matchCode: domState.traffic?.matchCode || "soccer",
                trainingCode: domState.traffic?.trainingCode || "standard",
            },
            // Site inputs
            site: {
                svf: domState.shade?.svf || 1,
                facadeAngle: domState.shade?.facadeAngle || 0,
                treeOcclusion: domState.shade?.treeOcclusion || 0,
            },
            // PGR inputs
            pgr: domState.pgr || {},
            // DMI inputs
            dmi: domState.dmi || {},
            // Site history
            siteHistory: domState.siteHistory || {},
            // Irrigation settings
            irrigation: domState.irrigation || {},
            // Fertility settings
            fertility: domState.fertility || {},
            // Tissue data
            tissue: domState.tissue || null,
            // Variety data
            variety: domState.variety || null,
        },
        computed: {},
        derived: {},
    };
}

/**
 * Extract cascade results to legacy variable format
 * Maps cascade state.computed values to the variable names expected by gaip_render_results()
 *
 * @param {Object} cascadeResult - Result from GilbaCascadeOrchestrator.runCascade()
 * @param {Object} domState - Original DOM state (for fallbacks)
 * @param {Object} weather - Weather data (for fallbacks)
 * @returns {Object} Legacy format { l, d, ne, ae, oe, se, le, me, de, fe }
 */
function gaip_extractCascadeResults(cascadeResult, domState, weather) {
    var computed = cascadeResult.state?.computed || {};

    return {
        // l = MLSN results
        l: computed.mlsn || {
            status: "Not computed",
            recommendations: []
        },
        // d = Water quality results
        d: computed.water || computed.waterBlend || {
            status: "Not computed"
        },
        // ne = Firmness results
        ne: computed.firmness || {
            FI: 0,
            status: "Not computed"
        },
        // ae = Nitrogen status
        ae: computed.nitrogen || {
            opt: 200,
            applied: 0,
            baseOptimum: 200,
            status: "Unknown",
            growthData: {
                weighted: 50,
                c3potential: 50,
                c4potential: 50,
                temperature: 20,
                status: "No data",
            },
        },
        // oe = Traffic results
        oe: computed.traffic || {
            TrafficRisk: 0,
            recoveryProb: 0,
            recoveryWindow: 0,
        },
        // se = Shade results
        se: computed.shade || {
            status: "Not computed"
        },
        // le = Wear & recovery results
        le: computed.wear || computed.wearRecovery || null,
        // me = Turf manager results
        me: computed.turfManager || {
            warnings: []
        },
        // de = Tissue results
        de: computed.tissue || null,
        // fe = Salinity penalty
        fe: computed.salinityPenalty || null,
        // Climate metrics (stored on window)
        climateMetrics: computed.climate || null,
        // pe = Phytotoxicity results (direct plant damage from water ions)
        pe: computed.phytotoxicity || null,
    };
}

// =============================================================================
// END CASCADE ORCHESTRATOR INTEGRATION
// =============================================================================

function safeNum(e, t) {
    return ((e = parseFloat(e)), isFinite(e) ? e : t);
}

function collectGridValues(e, t) {
    var r = document.querySelector(e),
        n = {};
    if (!r) return n;
    for (var i = r.querySelectorAll("input[" + t + "]"), a = 0; a < i.length; a++) {
        n[i[a].getAttribute(t)] = safeNum(i[a].value, 0);
    }
    return n;
}

function calculateEndDate(e, t) {
    e || (e = new Date().toISOString().split("T")[0]);
    var r = new Date(e);
    return (
        r.setDate(r.getDate() + t),
        r.getFullYear() + "-" + String(r.getMonth() + 1).padStart(2, "0") + "-" + String(r.getDate()).padStart(2, "0")
    );
}
var AUSTRALIAN_OVERSEED_CALENDAR = {
    12: {
        month: "December",
        season: "summer",
        expectedC3: 0,
        expectedC4: 100,
        overseedStatus: "dead",
        dominant: "C4",
        priority: "Maintain C4 base health",
        notes: "Ryegrass has been dead for 4+ weeks. 100% couch expected.",
    },
    1: {
        month: "January",
        season: "summer",
        expectedC3: 0,
        expectedC4: 100,
        overseedStatus: "dead",
        dominant: "C4",
        priority: "Maintain C4 base health",
        notes: "Peak summer. 100% couch dominance.",
    },
    2: {
        month: "February",
        season: "autumn",
        expectedC3: 5,
        expectedC4: 95,
        overseedStatus: "establishing",
        dominant: "C4",
        priority: "CRITICAL: Protect new seedlings",
        notes: "OVERSEED PERIOD. Seedlings extremely vulnerable to heat/traffic.",
    },
    3: {
        month: "March",
        season: "autumn",
        expectedC3: 20,
        expectedC4: 80,
        overseedStatus: "establishing",
        dominant: "C4",
        priority: "Protect establishing overseed",
        notes: "Overseed establishing. Still vulnerable to heat.",
    },
    4: {
        month: "April",
        season: "autumn",
        expectedC3: 50,
        expectedC4: 50,
        overseedStatus: "established",
        dominant: "transitioning",
        priority: "Transition to winter cover",
        notes: "Overseed now established. C4 slowing as temps drop.",
    },
    5: {
        month: "May",
        season: "winter",
        expectedC3: 85,
        expectedC4: 15,
        overseedStatus: "dominant",
        dominant: "C3",
        priority: "Maintain ryegrass cover",
        notes: "Full winter cover. Couch mostly dormant.",
    },
    6: {
        month: "June",
        season: "winter",
        expectedC3: 95,
        expectedC4: 5,
        overseedStatus: "dominant",
        dominant: "C3",
        priority: "Maintain ryegrass cover",
        notes: "Peak winter. Couch dormant.",
    },
    7: {
        month: "July",
        season: "winter",
        expectedC3: 95,
        expectedC4: 5,
        overseedStatus: "dominant",
        dominant: "C3",
        priority: "Maintain ryegrass cover",
        notes: "Peak winter. Couch dormant.",
    },
    8: {
        month: "August",
        season: "winter",
        expectedC3: 90,
        expectedC4: 10,
        overseedStatus: "dominant",
        dominant: "C3",
        priority: "Maintain ryegrass, couch awakening",
        notes: "Late winter. Couch beginning to wake.",
    },
    9: {
        month: "September",
        season: "spring",
        expectedC3: 75,
        expectedC4: 25,
        overseedStatus: "fading",
        dominant: "C3",
        priority: "Manage ryegrass-to-couch transition",
        notes: "Spring. Couch returning, ryegrass still strong.",
    },
    10: {
        month: "October",
        season: "spring",
        expectedC3: 50,
        expectedC4: 50,
        overseedStatus: "fading",
        dominant: "transitioning",
        priority: "Smooth transition to couch",
        notes: "Active transition. Both grasses competing.",
    },
    11: {
        month: "November",
        season: "spring",
        expectedC3: 20,
        expectedC4: 80,
        overseedStatus: "dying",
        dominant: "C4",
        priority: "Couch dominance, ryegrass die-off",
        notes: "Ryegrass dying off naturally. Couch taking over.",
    },
};

function enforceHemisphereTurfRules(e) {
    // Northern hemisphere C4 grasses (couch, bermuda, kikuyu, zoysia) are warm-season
    // year-round. Do NOT force percentC3Cover=100 for northern hemisphere.
    // Overseed on northern-hemisphere C4 greens is uncommon and must be explicitly set.
    // Previously this function wrongly set C3 cover to 100% for any northern-hemisphere
    // location, causing ryegrass to appear as the dominant species in Vietnam, SE Asia etc.
    return e;
}

function convertDateToISO(e) {
    if (!e) return new Date().toISOString().split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(e)) return e;
    var t = e.split("/");
    if (3 === t.length) {
        var r = t[0].padStart(2, "0"),
            n = t[1].padStart(2, "0");
        return t[2] + "-" + n + "-" + r;
    }
    return e;
}

function validateClimateMetrics(e) {
    if (!e) return null;
    var t = [],
        r = {
            temperature: {},
            stress: {},
            growth: {},
            moisture: {},
            _validated: !0,
            _timestamp: new Date().toISOString(),
        };
    if (e.temperature) {
        if (
            ((r.temperature.mean = "number" == typeof e.temperature.mean ? e.temperature.mean : null),
                (r.temperature.max = "number" == typeof e.temperature.max ? e.temperature.max : null),
                (r.temperature.min = "number" == typeof e.temperature.min ? e.temperature.min : null),
                (r.temperature.soil = "number" == typeof e.temperature.soil ? e.temperature.soil : null),
                (r.temperature.soilEstimated = !!e.temperature.soilEstimated),
                null !== r.temperature.max && null !== r.temperature.min && r.temperature.max < r.temperature.min)
        ) {
            t.push("Temperature max < min (swapped)");
            var n = r.temperature.max;
            ((r.temperature.max = r.temperature.min), (r.temperature.min = n));
        }
        null !== r.temperature.mean &&
            (r.temperature.mean < -50 || r.temperature.mean > 60) &&
            t.push("Temperature mean out of range: " + r.temperature.mean);
    } else t.push("Missing temperature data");
    return (
        e.growth &&
        ((r.growth.c3 = "number" == typeof e.growth.c3 ? Math.max(0, Math.min(100, e.growth.c3)) : null),
            (r.growth.c4 = "number" == typeof e.growth.c4 ? Math.max(0, Math.min(100, e.growth.c4)) : null),
            (r.growth.weighted =
                "number" == typeof e.growth.weighted ? Math.max(0, Math.min(100, e.growth.weighted)) : null)),
        e.moisture &&
        ((r.moisture.humidity = e.moisture.humidity || {}),
            (r.moisture.rainfall = "number" == typeof e.moisture.rainfall ? e.moisture.rainfall : 0),
            (r.moisture.et0 = "number" == typeof e.moisture.et0 ? e.moisture.et0 : null),
            (r.moisture.leafWetness = "number" == typeof e.moisture.leafWetness ? e.moisture.leafWetness : 0),
            // b35fix356: preserve per-day humidity pattern populated by the
            // P-builder (~line 6478) so disease-forecast.buildDailyClimate's
            // moistureDaily[i].humidity 'per-day' rung can resolve. Pre-fix
            // the validator silently dropped any key not in its hardcoded
            // copy list; dailyPattern would have been lost in transit even
            // if upstream had populated it. Strict array-shape guard prevents
            // accidental scalar pollution.
            (r.moisture.dailyPattern = Array.isArray(e.moisture.dailyPattern) ? e.moisture.dailyPattern : null)),
        (r.stress = e.stress || {}),
        t.length > 0 && console.warn("⚠️ Climate validation issues:", t),
        (r._issues = t),
        r
    );
}

function generateClimateStatusSummary(e, t, r) {
    if (!e || !e.temperature)
        return {
            icon: "❓",
            text: "No climate data",
            class: "unknown",
        };
    var n = e.temperature.mean,
        i = e.temperature.max,
        // b35fix345: null-passthrough on UI tile humidity. Pre-fix `|| 50`
        // fabricated 50% on every no-data render — UI display only, but the
        // tile read as if 50% were real data. Null lets downstream rendering
        // suppress humidity-dependent labels instead of misleading.
        a = e.moisture?.humidity?.mean ?? null,
        o = e.moisture?.rainfall || 0,
        s = ["couch", "bermuda", "kikuyu", "zoysia", "buffalo", "paspalum"].includes((t || "").toLowerCase()),
        l = r?.turf?.speciesFractions?.c3Fraction || r?.turf?.c3Fraction || 0,
        d = s && l >= 0.2,
        c = s && l >= 0.5,
        p = "",
        g = "",
        u = "normal";
    var gpVal = s ? e.growth?.c4 || null : e.growth?.c3 || null;
    null != gpVal ?
        (gpVal >= 90 ?
            ((p = "Optimal"), (g = "✓"), (u = "good")) :
            gpVal >= 70 ?
            ((p = "Good"), (g = "🌤️"), (u = "normal")) :
            gpVal >= 50 ?
            ((p = "Suboptimal"), (g = "⚠️"), (u = "watch")) :
            gpVal >= 30 ?
            ((p = "Poor"), (g = "⚠️"), (u = "concern")) :
            ((p = "Critical"), (g = "🔴"), (u = "critical")),
            // v9.9.4 fix: Use mean temp (n) not period max (i) for current status banner
            n >= 38 && ((p = "Extreme heat"), (g = "🔥"), (u = "critical")),
            n >= 32 && gpVal < 70 && ((p = "Heat stress"), (g = "🔥"), (u = "critical")),
            n <= 2 && ((p = "Frost risk"), (g = "❄️"), (u = "critical")),
            n <= 5 && gpVal < 50 && ((p = "Cold stress"), (g = "❄️"), (u = "concern"))) :
        c || !s ?
        n >= 32 ?
        ((p = "Heat stress"), (g = "🔥"), (u = "critical")) :
        n >= 28 ?
        ((p = "Hot"), (g = "☀️"), (u = "concern")) :
        n >= 18 && n <= 24 ?
        ((p = "Optimal"), (g = "✓"), (u = "good")) :
        n >= 15 && n < 18 ?
        ((p = "Good"), (g = "🌤️"), (u = "normal")) :
        n > 24 && n < 28 ?
        ((p = "Warm"), (g = "🌤️"), (u = "normal")) :
        n < 5 ?
        ((p = "Cold"), (g = "❄️"), (u = "watch")) :
        n < 10 ?
        ((p = "Cool"), (g = "🌥️"), (u = "normal")) :
        ((p = "Mild"), (g = "🌤️"), (u = "normal")) :
        n >= 38 ?
        ((p = "Extreme heat"), (g = "🔥"), (u = "critical")) :
        n >= 33 ?
        ((p = "Hot"), (g = "☀️"), (u = "watch")) :
        n >= 25 && n <= 35 ?
        ((p = "Optimal"), (g = "✓"), (u = "good")) :
        n < 15 ?
        ((p = "Cool"), (g = "❄️"), (u = "watch")) :
        n < 10 ?
        ((p = "Cold"), (g = "🥶"), (u = "concern")) :
        ((p = "Mild"), (g = "🌤️"), (u = "normal"));
    var m = "",
        f = p;
    (m = o > 20 ? "Wet" : o > 5 ? "Moist" : a < 40 ? "Dry" : a > 80 ? "Humid" : "") && (f += " & " + m);
    var y = e.growth?.c3,
        h = e.growth?.c4;
    if (d && null != y && null != h) f += " (C3: " + Math.round(y) + "% / C4: " + Math.round(h) + "%)";
    else {
        var v = s ? h : y;
        null != v && (f += " (GP: " + Math.round(v) + "%)");
    }
    return {
        icon: g,
        text: f,
        class: u,
        details: {
            temp: n,
            tmax: i,
            humidity: a,
            rainfall: o,
            growthPotential: d ?
                {
                    c3: y,
                    c4: h,
                } :
                s ?
                h :
                y,
            hasOverseed: d,
            overseedDominant: c,
        },
    };
}

function getClimateMetricsWithFallback(e, t) {
    if (window.climateMetrics && window.climateMetrics._validated) return window.climateMetrics;
    if (window.climateMetrics && window.climateMetrics.temperature) return validateClimateMetrics(window.climateMetrics);
    if (e && e.forecast && e.forecast.hourly) return null;
    if (t && t.climate && t.climate.manual) {
        var r = t.climate.manual.temperature || {},
            n = t.climate.manual.moisture || {},
            i = r.max || 25,
            a = r.min || 15,
            o = (i + a) / 2;
        return validateClimateMetrics({
            temperature: {
                mean: o,
                max: i,
                min: a,
                soil: r.soil || null,
            },
            growth: {
                c3: calcC3GrowthPotential(o),
                c4: calcC4GrowthPotential(o),
                weighted: (calcC3GrowthPotential(o) + calcC4GrowthPotential(o)) / 2,
            },
            moisture: {
                // b35fix345: null when manual humidity unset (was `|| 65`).
                // Pre-fix planted 65 indistinguishably from real data on the
                // climateMetrics shim used by gaip_get_climate_metrics. Now
                // emits null + dataSource tag matching the b35fix342/344 pattern.
                humidity: {
                    mean: n.humidity != null ? n.humidity : null,
                    dataSource: n.humidity != null ? 'manual' : 'no-data',
                },
                rainfall: n.rainfall || 0,
            },
            stress: {},
        });
    }
    return (
        console.warn("⚠️ Using default climate metrics - no data available"),
        validateClimateMetrics({
            temperature: {
                mean: 20,
                max: 25,
                min: 15,
            },
            growth: {
                c3: 70,
                c4: 50,
                weighted: 60,
            },
            // b35fix345: humidity is null on the default-fallback path, not
            // a fabricated 65. Temperature/growth defaults are kept because
            // every C3/C4 GP-consuming engine handles those gracefully and
            // some UI rendering depends on a temp value being present; humidity
            // is the field whose literal default propagated to disease engines
            // as fabricated MEANRH. With null, those engines correctly degrade.
            moisture: {
                humidity: {
                    mean: null,
                    dataSource: 'no-data',
                },
                rainfall: 0,
            },
            stress: {},
            _default: !0,
        })
    );
}

function gaip_build_state(e) {
    var t = !!e.querySelector(".gaip-use-live-weather")?.checked,
        r = convertDateToISO(e.querySelector(".gaip-start-date")?.value || ""),
        n = convertDateToISO(e.querySelector(".gaip-end-date")?.value || "");

    var i,
        a,
        o = {
            climate: {
                location: e.querySelector(".gaip-location")?.value || "",
                useLiveWeather: t,
                lat: safeNum(e.querySelector(".gaip-lat")?.value, 0),
                lon: safeNum(e.querySelector(".gaip-lon")?.value, 0),
                period: {
                    start: r || new Date().toISOString().split("T")[0],
                    end: n || calculateEndDate(r || new Date().toISOString().split("T")[0], 7),
                },
                forecastDays: 7,
                historical: {
                    enabled: !1,
                    lookbackDays: 90,
                },
                manual: {
                    eto: safeNum(e.querySelector(".gaip-manual-eto")?.value, 0),
                    tmin: safeNum(e.querySelector(".gaip-manual-tmin")?.value, 0),
                    tmax: safeNum(e.querySelector(".gaip-manual-tmax")?.value, 0),
                    rain: safeNum(e.querySelector(".gaip-manual-rain")?.value, 0),
                    temperature: {
                        min: safeNum(e.querySelector(".gaip-manual-tmin")?.value, 0) || null,
                        max: safeNum(e.querySelector(".gaip-manual-tmax")?.value, 0) || null,
                        mean: null,
                        soil: safeNum(e.querySelector(".gaip-manual-soil-temp")?.value, 0) || null,
                    },
                    moisture: {
                        // b35fix345: null when blank, not literal 65. The DOM
                        // input value is "" → safeNum returns 0 → `|| 65` fired.
                        // Now: blank input → null (no humidity entered); typed
                        // 0 stays 0 (legitimate); typed value passes through.
                        humidity: (function () {
                            var raw = e.querySelector(".gaip-manual-humidity")?.value;
                            return raw === "" || raw == null ? null : safeNum(raw, null);
                        })(),
                        rainfall: safeNum(e.querySelector(".gaip-manual-rain")?.value, 0) || null,
                        rainyDays: safeNum(e.querySelector(".gaip-manual-rainy-days")?.value, 0) || null,
                        dewpoint: null,
                        soilMoisture: safeNum(e.querySelector(".gaip-manual-soil-moisture")?.value, 0) || null,
                    },
                    solar: {
                        radiation: safeNum(e.querySelector(".gaip-manual-radiation")?.value, 0) || null,
                        cloudCover: safeNum(e.querySelector(".gaip-manual-cloud-cover")?.value, 0) || null,
                        sunshineHours: safeNum(e.querySelector(".gaip-manual-sunshine")?.value, 0) || null,
                    },
                    wind: {
                        speed: safeNum(e.querySelector(".gaip-manual-wind")?.value, 0) || 2,
                    },
                },
                dates: {
                    start: r,
                    end: n,
                },
            },
            soil: {
                testDate: e.querySelector(".gaip-soil-date")?.value || null,
                depthCm: safeNum(e.querySelector(".gaip-depth")?.value, 10),
                bulkDensity: safeNum(e.querySelector(".gaip-bd")?.value, 1.4),
                ppm: collectGridValues(".gaip-soil-grid", "data-mlsn"),
                methodology: e.querySelector(".gaip-soil-methodology")?.value || "mlsn",
                surfaceType: e.querySelector(".gaip-subcategory-option.selected")?.dataset?.surface ||
                    window.gaipTurfProfile?.state?.subCategory ||
                    "sports",
                pH_water: safeNum(e.querySelector(".gaip-soil-ph")?.value, 0),
                pH_cacl2: safeNum(e.querySelector(".gaip-soil-ph-cacl2")?.value, 0),
                Na_ppm: 0,
                CEC: safeNum(e.querySelector(".gaip-cec")?.value, 0),
                EC1_5: safeNum(e.querySelector(".gaip-soil-ec")?.value, 0),
                soilTexture: e.querySelector(".gaip-soil-texture")?.value || "loam",
                ECe: safeNum(e.querySelector(".gaip-soil-ec")?.value, 0) *
                    ({
                        sand: 5,
                        loamy_sand: 5.5,
                        sandy_loam: 6,
                        loam: 7,
                        clay_loam: 8,
                        clay: 10,
                    } [e.querySelector(".gaip-soil-texture")?.value || "loam"] || 7),
                samplingDepth: e.querySelector(".gaip-sampling-depth")?.value || "",
                LOI: safeNum(e.querySelector(".gaip-loi")?.value, 0),
                OM_pct: safeNum(e.querySelector(".gaip-loi")?.value, 0),
                LOI_0_2: safeNum(e.querySelector(".gaip-loi-0-2")?.value, 0),
                LOI_2_4: safeNum(e.querySelector(".gaip-loi-2-4")?.value, 0),
                LOI_4_6: safeNum(e.querySelector(".gaip-loi-4-6")?.value, 0),
            },
            water: (function() {
                if (
                    window.GAIP_WaterBlenderUI &&
                    window.GAIP_WaterBlenderUI.getState &&
                    window.GAIP_WaterBlenderUI.getState().enabled &&
                    window.GAIP_WaterBlenderUI.getState().blendResult
                ) {
                    var t = window.GAIP_WaterBlenderUI.getState(),
                        r = t.blendResult.blendedMgL;
                    return (
                        console.log("[GAIP] Using blended water:", r), {
                            testDate: e.querySelector(".gaip-water-date")?.value || null,
                            ions: {
                                Ca: r.Ca || 0,
                                Mg: r.Mg || 0,
                                Na: r.Na || 0,
                                K: r.K || 0,
                                Cl: r.Cl || 0,
                                SO4: r.SO4 || 0,
                                HCO3: r.HCO3 || 0,
                                CO3: r.CO3 || 0,
                                B: r.B || 0,
                                Fe: r.Fe || 0,
                                NO3: r.NO3 || 0,
                                PO4: r.PO4 || 0,
                            },
                            ecw: r.EC_dSm || 0,
                            pH: r.pH || 7,
                            isBlended: !0,
                            sourceCount: t.blendResult.sourceCount,
                            recycledWater: !!(e.querySelector(".gaip-recycled-water-flag")?.checked),
                        }
                    );
                }
                return {
                    testDate: e.querySelector(".gaip-water-date")?.value || null,
                    ions: collectGridValues(".gaip-water-grid", "data-ion"),
                    ecw: safeNum(e.querySelector(".gaip-ecw")?.value, 0),
                    pH: safeNum(e.querySelector(".gaip-water-ph")?.value, 7),
                    recycledWater: !!(e.querySelector(".gaip-recycled-water-flag")?.checked),
                };
            })(),
            turf: {
                turfType:
                    // Cotula/bowls: turfType from GAIP_STATE takes precedence over DOM
                    // since TurfProfileController may have fallen back to 'lawns'
                    window.GAIP_STATE?.turf?.cotula === true ?
                    "bowls" :
                    ((a = e.querySelector(".gaip-turf-type-option.selected")),
                        a && a.dataset.type ? a.dataset.type : e.querySelector(".gaip-turf-type")?.value || "sports"),
                subCategory: ((i = e.querySelector(".gaip-subcategory-option.selected")),
                    (i && (i.dataset.surface || i.dataset.sport)) || ""),
                // Cotula: if GAIP_STATE.turf.cotula is set, the DOM species may have been
                // overwritten by TurfProfileController location-change repopulation.
                // Read cotula directly from state rather than DOM in that case.
                grassSpecies: window.GAIP_STATE?.turf?.cotula === true ? "cotula" : e.querySelector(".gaip-species")?.value || "",
                warmBase: window.GAIP_STATE?.turf?.cotula === true ? "" : e.querySelector(".gaip-warm-base")?.value || "",
                coolOverseed: e.querySelector(".gaip-cool-overseed")?.value || "",
                overseedVariety: e.querySelector(".gaip-overseed-variety")?.value || "",
                overseedSummerIntent: e.querySelector(".gaip-overseed-summer-intent")?.value || "transition",
                poaPercent: safeNum(e.querySelector(".gaip-poa-percent")?.value, 0),
                percentC3Cover: safeNum(e.querySelector(".gaip-c3-cover")?.value, 0),
                hoc: safeNum(e.querySelector(".gaip-hoc")?.value, 25),
                heightOfCut: safeNum(e.querySelector(".gaip-hoc")?.value, 25),
                // b35fix312 Fix 2: Nutrition Program panel input takes precedence
                // over the legacy Site Settings input. Two separate fields exist
                // (.gaip-nutrition-annual-n in the Nutrition Program section,
                // .gaip-n-program in the Turf Profile section). If the user
                // types a value into the Nutrition Program panel (the primary
                // UX for this), it wins. Otherwise fall back to the Site
                // Settings value.
                nProgramKgHaYr: (function() {
                    var nutritionVal = e.querySelector(".gaip-nutrition-annual-n")?.value;
                    if (nutritionVal) return safeNum(nutritionVal, 0);
                    return safeNum(e.querySelector(".gaip-n-program")?.value, 0);
                })(),
                construction: e.querySelector(".gaip-construction")?.value || "",
                drainage: e.querySelector(".gaip-drainage")?.value || "",
                cleggHammer: safeNum(e.querySelector(".gaip-clegg-hammer")?.value, 0),
                cleggMax: safeNum(e.querySelector(".gaip-clegg-max")?.value, 0),
                cleggMin: safeNum(e.querySelector(".gaip-clegg-min")?.value, 0),
                dli: safeNum(e.querySelector(".gaip-dli")?.value, 0),
                ledPPFD: safeNum(e.querySelector(".gaip-led-ppfd")?.value, 0),
                ledHours: safeNum(e.querySelector(".gaip-led-hours")?.value, 0),
                variety: e.querySelector(".gaip-variety")?.value || "generic",
            },
            siteHistory: {
                yearsEstablished: safeNum(e.querySelector(".gaip-years-established")?.value, 0) || null,
                thatchMm: safeNum(e.querySelector(".gaip-thatch-depth")?.value, 0) || null,
                winterMinTemp: safeNum(e.querySelector(".gaip-winter-min-temp")?.value, null),
                daysBelow5C: null,
            },
            pgr: (function() {
                // b35fix233: Read from GAIP_LAST_PGR (spray-log-cascade SSOT) and
                // Programmes card inputs. No DOM writeback — inputs are the source,
                // not a cache. Priority: Programmes card inputs > GAIP_LAST_PGR > GAIP_STATE.pgr
                var _cardProduct = e.querySelector(".gaip-pgr-product")?.value || "";
                var _cardDate    = e.querySelector(".gaip-pgr-date")?.value || null;
                var _cardRate    = safeNum(e.querySelector(".gaip-pgr-rate")?.value, 0);
                var _cardGdd     = safeNum(e.querySelector(".gaip-pgr-gdd")?.value, null);
                var _lastPGR     = window.GAIP_LAST_PGR;
                // If Programmes card has a product selected, use it (user is trialling rates)
                // Otherwise fall through to GAIP_LAST_PGR from spray log
                var productType     = _cardProduct || (_lastPGR && _lastPGR.product_key) || "";
                var applicationDate = _cardDate    || (_lastPGR && _lastPGR.application_date) || null;
                var rateLperHa      = _cardRate    || (_lastPGR && _lastPGR.rate) || 0;
                return {
                    productType:     productType,
                    applicationDate: applicationDate,
                    rateLperHa:      rateLperHa,
                    gddThreshold:    _cardGdd,
                    baseTemp:        null,
                };
            })(),
            dmi: (function() {
                // b35fix233: same pattern — Programmes card inputs > GAIP_STATE.dmi from cascade
                var _cardProd = e.querySelector(".gaip-dmi-product")?.value || "";
                var _cardDate = e.querySelector(".gaip-dmi-date")?.value || null;
                var _cardRate = safeNum(e.querySelector(".gaip-dmi-rate")?.value, 0);
                var _stateDmi = (window.GAIP_STATE && window.GAIP_STATE.dmi) || {};
                return {
                    product:         _cardProd || _stateDmi.product || "",
                    applicationDate: _cardDate || _stateDmi.applicationDate || null,
                    rateLperHa:      _cardRate || _stateDmi.rateLperHa || 0,
                };
            })(),
            irrigation: {
                method: e.querySelector(".gaip-irr-method")?.value || "sprinkler",
                efficiency: safeNum(e.querySelector(".gaip-irr-efficiency")?.value, 75) / 100,
                rainfallEffectiveness: safeNum(e.querySelector(".gaip-irr-rain-eff")?.value, 80) / 100,
                costPerKL: safeNum(e.querySelector(".gaip-irr-cost")?.value, 3),
                daysSinceIrrigation: safeNum(e.querySelector(".gaip-days-since-irrigation")?.value, 1),
                soilVWC: safeNum(e.querySelector(".gaip-soil-vwc")?.value, 0) || null,
                rootDepth: safeNum(e.querySelector(".gaip-root-depth")?.value, 100),
            },
            traffic: {
                matchesPerWeek: safeNum(e.querySelector(".gaip-matches-week")?.value, 0),
                sessionsPerWeek: safeNum(e.querySelector(".gaip-sessions-week")?.value, 0),
                restDays: safeNum(e.querySelector(".gaip-rest-days")?.value, 0),
                matchCode: e.querySelector(".gaip-match-sport")?.value || "soccer",
                trainingCode: e.querySelector(".gaip-training-type")?.value || "training_drills",
                soilMoisture: e.querySelector(".gaip-soil-moisture")?.value || "optimal",
                matchSport: e.querySelector(".gaip-match-sport")?.value || "soccer",
                matchDuration: safeNum(e.querySelector(".gaip-match-duration")?.value, 1.5),
                ageGroup: e.querySelector(".gaip-age-group")?.value || "adult",
                teamSize: e.querySelector(".gaip-team-size")?.value || "medium",
                trainingType: e.querySelector(".gaip-training-type")?.value || "training_drills",
                sessionDuration: safeNum(e.querySelector(".gaip-session-duration")?.value, 1.5),
                trainingRotation: safeNum(e.querySelector(".gaip-training-rotation")?.value, 100),
                priorWeeks: [
                    safeNum(e.querySelector(".gaip-prior-week-1")?.value, null),
                    safeNum(e.querySelector(".gaip-prior-week-2")?.value, null),
                    safeNum(e.querySelector(".gaip-prior-week-3")?.value, null),
                    safeNum(e.querySelector(".gaip-prior-week-4")?.value, null),
                ].filter(function(e) {
                    return null !== e && !isNaN(e);
                }),
                rootDepth: safeNum(e.querySelector(".gaip-root-depth")?.value, 100),
                overseedStatus: e.querySelector(".gaip-overseed-status")?.value || "none",
                variety: e.querySelector(".gaip-variety")?.value || "generic",
            },
            hemi: e.querySelector(".gaip-hemi")?.value || "southern",
            fertility: {
                monthlyN: safeNum(e.querySelector(".gaip-monthly-n-rate")?.value, 0),
            },
        },
        s = calculateC3C4Fractions(o.turf);
    if (
        ((o.turf.speciesFractions = {
                c3Fraction: s.c3frac,
                c4Fraction: s.c4frac,
            }),
            o.turf.grassSpecies)
    ) {
        var l = o.turf.grassSpecies.toLowerCase();
        var isC4 =
            l.indexOf("couch") >= 0 ||
            l.indexOf("bermuda") >= 0 ||
            l.indexOf("kikuyu") >= 0 ||
            l.indexOf("zoysia") >= 0 ||
            l.indexOf("paspalum") >= 0 ||
            l.indexOf("buffalo") >= 0 ||
            l.indexOf("st augustine") >= 0 ||
            l.indexOf("centipede") >= 0;
        var isC3 =
            l.indexOf("ryegrass") >= 0 ||
            l.indexOf("fescue") >= 0 ||
            l.indexOf("bluegrass") >= 0 ||
            l.indexOf("bentgrass") >= 0 ||
            l.indexOf("poa") >= 0;

        if (isC4) {
            // C4 species selected directly - set as warmBase
            // v9.9.1: PRESERVE coolOverseed if user explicitly selected from Overseed Species dropdown
            o.turf.warmBase = o.turf.grassSpecies;
            // Re-read the actual dropdown value to preserve user's explicit selection
            var overseedDropdownValue = document.querySelector(".gaip-cool-overseed")?.value || "";
            if (overseedDropdownValue && overseedDropdownValue.trim() !== "") {
                o.turf.coolOverseed = overseedDropdownValue;
            } else {
                o.turf.coolOverseed = "";
            }
        } else if (isC3 || o.turf.grassSpecies.length > 0) {
            // C3 species - set as coolOverseed, CLEAR warmBase (unless explicitly set)
            o.turf.coolOverseed = o.turf.grassSpecies;
            // Only clear warmBase if no explicit overseed scenario configured
            if (!o.turf.warmBase || o.turf.warmBase === o.turf.grassSpecies) {
                o.turf.warmBase = "";
            }
        }
    }
    var d = o.turf.speciesFractions.c3Fraction || 0,
        c = (o.turf.grassSpecies || "").toLowerCase().match(/couch|bermuda|kikuyu|zoysia|paspalum|buffalo/),
        p = c && d >= 0.5,
        g = c && d >= 0.2;
    return (
        (o.turf.overseedDominant = p),
        (o.turf.overseedSignificant = g),
        p ?
        ((o.turf.effectiveSpecies = o.turf.coolOverseed || "Perennial Ryegrass"),
            (o.turf.effectiveVariety = o.turf.overseedVariety || "generic"),
            (o.turf.effectiveIsC4 = !1),
            console.log(
                "✅ Overseed Dominant (" + Math.round(100 * d) + "% C3):",
                "effectiveSpecies =",
                o.turf.effectiveSpecies,
                "effectiveVariety =",
                o.turf.effectiveVariety,
            )) :
        ((o.turf.effectiveSpecies = o.turf.grassSpecies || o.turf.warmBase || "Couch"),
            (o.turf.effectiveVariety = o.turf.variety || "generic"),
            (o.turf.effectiveIsC4 = !!c),
            g &&
            console.log(
                "ℹ️ Overseed Significant (" + Math.round(100 * d) + "% C3) but not dominant - using base species",
            )),
        o.soil.ppm && o.soil.ppm.Na && (o.soil.Na_ppm = safeNum(o.soil.ppm.Na, 0)),
        enforceHemisphereTurfRules(o)
    );
}

function renderBasicClimateInfo(e, t, r) {
    if (e && t) {
        var n = null;
        if (t.daily && Array.isArray(t.daily)) n = t.daily;
        else if (t.forecast && t.forecast.daily && t.forecast.daily.time) {
            n = [];
            for (var i = t.forecast.daily.time, a = 0; a < i.length; a++)
                n.push({
                    date: i[a],
                    temperature_2m_max: t.forecast.daily.temperature_2m_max?.[a] || 25,
                    temperature_2m_min: t.forecast.daily.temperature_2m_min?.[a] || 15,
                    et0_fao_evapotranspiration: t.forecast.daily.et0_fao_evapotranspiration?.[a] || 4,
                    precipitation_sum: t.forecast.daily.precipitation_sum?.[a] || 0,
                });
        } else if (t.forecast && t.forecast.hourly && t.forecast.hourly.time) {
            n = [];
            for (var o = t.forecast.hourly, s = o.time.length, l = Math.ceil(s / 24), d = 0; d < l; d++) {
                var c = 24 * d,
                    p = Math.min(c + 24, s),
                    g = o.temperature_2m.slice(c, p),
                    u = o.et0_fao_evapotranspiration ? o.et0_fao_evapotranspiration.slice(c, p) : [],
                    m = o.precipitation ? o.precipitation.slice(c, p) : [];
                n.push({
                    date: o.time[c].split("T")[0],
                    temperature_2m_max: Math.max.apply(null, g),
                    temperature_2m_min: Math.min.apply(null, g),
                    et0_fao_evapotranspiration: u.reduce(function(e, t) {
                        return e + t;
                    }, 0),
                    precipitation_sum: m.reduce(function(e, t) {
                        return e + t;
                    }, 0),
                });
            }
        } else if (t.manual && window.climateMetrics) {
            var f = window.climateMetrics;
            n = [{
                temperature_2m_max: f.temperature?.max || 25,
                temperature_2m_min: f.temperature?.min || 15,
                et0_fao_evapotranspiration: 4,
                precipitation_sum: 0,
            }, ];
        } else if (window.climateMetrics && window.climateMetrics.temperature) {
            var y = window.climateMetrics;
            n = [{
                temperature_2m_max: y.temperature.max || 25,
                temperature_2m_min: y.temperature.min || 15,
                et0_fao_evapotranspiration: y.et?.daily || 4,
                precipitation_sum: y.precipitation?.total || 0,
            }, ];
        }
        if (n && 0 !== n.length) {
            var h = 0,
                v = 0,
                b = 999,
                x = -999,
                w = 0;
            for (a = 0; a < n.length; a++) {
                ((h += (d = n[a]).et0_fao_evapotranspiration || d.et0 || 0), (v += d.precipitation_sum || d.rain || 0));
                var S = d.temperature_2m_max || d.tempMax || 0,
                    C = d.temperature_2m_min || d.tempMin || 0;
                (S > x && (x = S), C < b && (b = C), (w += (S + C) / 2));
            }
            w /= n.length;
            var M = 0;
            if (
                "c3" ===
                (r.turf.grassSpecies &&
                    (r.turf.grassSpecies.toLowerCase().indexOf("bent") >= 0 ||
                        r.turf.grassSpecies.toLowerCase().indexOf("rye") >= 0 ||
                        r.turf.grassSpecies.toLowerCase().indexOf("fescue") >= 0) ?
                    "c3" :
                    "c4")
            ) {
                var I = (w - 20) / 7.5;
                M = Math.exp(-0.5 * I * I);
            } else {
                I = (w - 31) / 8;
                M = Math.exp(-0.5 * I * I);
            }
            M = 100 * Math.max(0, Math.min(1, M));
            var k = [];
            (x > 35 ?
                k.push({
                    type: "heat",
                    msg: "Extreme heat: " + x.toFixed(1) + "°C max",
                }) :
                x > 32 &&
                k.push({
                    type: "heat",
                    msg: "Heat stress likely: " + x.toFixed(1) + "°C max",
                }),
                b < 0 ?
                k.push({
                    type: "frost",
                    msg: "Frost risk: " + b.toFixed(1) + "°C min",
                }) :
                b < 5 &&
                k.push({
                    type: "cold",
                    msg: "Cold stress: " + b.toFixed(1) + "°C min",
                }));
            var A = v - h,
                E = A >= 0 ? "color:#22c55e" : "color:#f59e0b",
                N =
                '<div style="padding:16px;background:linear-gradient(135deg,var(--gaip-info-bg),var(--gaip-info-bg));border-radius:12px;border:1px solid #bae6fd;">';
            if (
                ((N += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'),
                    (N += '<strong style="font-size:15px;color:#0369a1;">🌡️ Climate Summary (' + n.length + " days)</strong>"),
                    (N +=
                        '<span style="background:#0ea5e9;color:white;padding:4px 10px;border-radius:12px;font-size:12px;">GP: ' +
                        M.toFixed(0) +
                        "%</span>"),
                    (N += "</div>"),
                    (N += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">'),
                    (N +=
                        '<div><div style="font-size:20px;font-weight:700;color:var(--gaip-text);">' +
                        w.toFixed(1) +
                        '°</div><div style="font-size:11px;color:var(--gaip-text);">Avg Temp</div></div>'),
                    (N +=
                        '<div><div style="font-size:20px;font-weight:700;color:var(--gaip-text);">' +
                        h.toFixed(1) +
                        '</div><div style="font-size:11px;color:var(--gaip-text);">ET₀ (mm)</div></div>'),
                    (N +=
                        '<div><div style="font-size:20px;font-weight:700;color:var(--gaip-text);">' +
                        v.toFixed(1) +
                        '</div><div style="font-size:11px;color:var(--gaip-text);">Rain (mm)</div></div>'),
                    (N +=
                        '<div><div style="font-size:20px;font-weight:700;' +
                        E +
                        '">' +
                        (A >= 0 ? "+" : "") +
                        A.toFixed(1) +
                        '</div><div style="font-size:11px;color:var(--gaip-text);">Balance</div></div>'),
                    (N += "</div>"),
                    k.length > 0)
            ) {
                N += '<div style="margin-top:12px;padding:10px;background:var(--gaip-warning-bg);border-radius:8px;">';
                for (var T = 0; T < k.length; T++)
                    N +=
                    '<div style="color:#92400e;font-size:13px;">' +
                    ("frost" === k[T].type ? "❄️" : "heat" === k[T].type ? "🔥" : "🌡️") +
                    " " +
                    k[T].msg +
                    "</div>";
                N += "</div>";
            }
            ((N += "</div>"), (e.innerHTML = N));
        } else e.innerHTML = '<p class="gaip-note">Climate data format not recognized.</p>';
    }
}

function gaip_read_tissue_data(e) {
    for (
        var t = ["N", "P", "K", "Ca", "Mg", "S", "Fe", "Mn", "Zn", "Cu", "B", "Na"], r = {}, n = {}, i = !1, a = 0; a < t.length; a++
    ) {
        var o = t[a],
            s = e.querySelector('[data-val="' + o + '"]'),
            l = e.querySelector('[data-unit="' + o + '"]');
        if (s && s.value) {
            var d = parseFloat(s.value);
            isFinite(d) && d > 0 && ((r[o] = d), (n[o] = l ? l.value : a < 6 ? "%" : "mgkg"), (i = !0));
        }
    }
    return i ?
        {
            tissue: r,
            units: n,
            speciesGroup: e.querySelector('[data-tissue="speciesGroup"]')?.value || "C3",
            growthState: e.querySelector('[data-tissue="growthState"]')?.value || "active",
            sampleType: e.querySelector('[data-tissue="sampleType"]')?.value || "whole-leaf",
        } :
        null;
}
async function gaip_fetch_weather(e) {
    if ("undefined" != typeof gaip_climate_fetch) {
        try {
            var t = await gaip_climate_fetch(e);
            if (t) return (console.log("✅ Using enhanced climate engine data"), t);
        } catch (e) {
            console.warn("Climate engine fetch failed, falling back:", e);
        }
    } else console.log("ℹ️ Climate engine not loaded, using legacy fetch");
    if (!e.climate.useLiveWeather)
        return {
            manual: !0,
            manualEntry: !0,
            forecast: null,
            historical: null,
        };
    var r =
        (window.GAIP_HUB_CONFIG?.openMeteoUrl || "https://api.open-meteo.com/v1/forecast") +
        "?latitude=" +
        e.climate.lat +
        "&longitude=" +
        e.climate.lon +
        "&hourly=temperature_2m,precipitation&timezone=auto";
    try {
        var n = await fetch(r);
        return n.ok ?
            await n.json() :
            {
                manual: !0,
                manualEntry: !0,
            };
    } catch (e) {
        return (
            console.error("Weather fetch error:", e), {
                manual: !0,
                manualEntry: !0,
            }
        );
    }
}

function calculateC3C4Fractions(e) {
    // Cotula is a dicot — return null to signal GP bypass to cotula activity model
    if (e && (e.cotula === true || e.speciesKey === "cotula" || (e.grassSpecies || "").toLowerCase() === "cotula")) {
        return {
            c3frac: 0,
            c4frac: 0,
            isCotula: true
        };
    }
    var t,
        r,
        n = e.grassSpecies || "",
        i = e.warmBase || "",
        a = e.coolBase || e.coolOverseed || "",
        o = safeNum(e.percentC3Cover, 0),
        s =
        n.toLowerCase().indexOf("couch") > -1 ||
        n.toLowerCase().indexOf("bermuda") > -1 ||
        n.toLowerCase().indexOf("kikuyu") > -1 ||
        n.toLowerCase().indexOf("zoysia") > -1 ||
        n.toLowerCase().indexOf("buffalo") > -1 ||
        n.toLowerCase().indexOf("seashore") > -1 ||
        n.toLowerCase().indexOf("paspalum") > -1,
        l =
        n.toLowerCase().indexOf("bent") > -1 ||
        n.toLowerCase().indexOf("fescue") > -1 ||
        n.toLowerCase().indexOf("rye") > -1 ||
        n.toLowerCase().indexOf("poa") > -1 ||
        n.toLowerCase().indexOf("bluegrass") > -1,
        d = (i && i.length > 0) || s,
        c = (a && a.length > 0) || l;
    return (
        s && !l ?
        (r = 1 - (t = o / 100)) :
        l && !s ?
        ((t = 1), (r = 0)) :
        d && !c ?
        (r = 1 - (t = o / 100)) :
        c && !d ?
        ((t = 1), (r = 0)) :
        (r = d && c ? 1 - (t = o / 100) : 1 - (t = o > 0 ? o / 100 : 1)),
        (t = Math.max(0, Math.min(1, t))),
        (r = Math.max(0, Math.min(1, r))),
        console.log("C3/C4 Fractions - grassSpecies:", n, "isC4:", s, "=> c3:", t, "c4:", r), {
            c3frac: t,
            c4frac: r,
        }
    );
}

function assessSoilSodium(e, cec) {
    if (!e || 0 === e) return null;
    var t, r, n;

    // Estimated ESP from Mehlich-3 Na and CEC
    // Na (ppm) / 23 = Na (meq/100g approximate), then ESP = (Na_meq / CEC) × 100
    var espVal = null,
        espNote = "";
    if (cec && cec > 0) {
        var Na_meq = e / 230; // Mehlich-3 Na ppm to approx meq/100g (MW 23, × extraction factor ~10)
        espVal = (Na_meq / cec) * 100;
        espVal = Math.round(espVal * 10) / 10;
        espNote =
            espVal < 6 ?
            " Estimated ESP: " + espVal + "% (non-sodic, <6%)." :
            espVal < 15 ?
            " Estimated ESP: " + espVal + "% (sodic range 6-15%). Structural degradation likely." :
            " Estimated ESP: " + espVal + "% (severely sodic, >15%). Significant structural damage expected.";
    }

    e < 30 ?
        ((t = "Normal"),
            (r =
                "Soil Na: " + e.toFixed(0) + " ppm (Mehlich-3) - Normal levels. No sodium-related issues expected." + espNote),
            (n = "No action required. Continue standard irrigation practices.")) :
        e < 60 ?
        ((t = "Slightly Elevated"),
            (r =
                "Soil Na: " +
                e.toFixed(0) +
                " ppm (Mehlich-3) - Slightly elevated. Monitor for early signs of sodium stress." +
                espNote),
            (n =
                "Monitor turf closely. Check irrigation water quality (SAR). Consider preventative gypsum (0.5 t/ha) if using high-Na water.")) :
        e < 100 ?
        ((t = "Elevated"),
            (r =
                "Soil Na: " +
                e.toFixed(0) +
                " ppm (Mehlich-3) - Elevated sodium levels. Potential for structure/infiltration issues." +
                espNote),
            (n =
                "Apply gypsum 1.0-1.5 t/ha. Increase leaching fraction (LF 0.20-0.25). Test irrigation water SAR. Consider lab test for exchangeable Na and ESP.")) :
        ((t = "High"),
            (r =
                "Soil Na: " +
                e.toFixed(0) +
                " ppm (Mehlich-3) - High sodium. Significant risk of sodicity, poor infiltration, and turf stress." +
                espNote),
            (n =
                "URGENT: Apply gypsum 2.0-3.0 t/ha in split applications. Aggressive leaching program. Test for true ESP (exchangeable Na required). May need drainage improvements. Evaluate irrigation water source."));

    return {
        Na_ppm: e,
        ESP: espVal,
        status: t,
        assessment: r,
        recommendations: n,
        note: cec && espVal !== null ?
            "ESP estimated from Mehlich-3 Na and CEC. For precise sodicity assessment, request exchangeable cation analysis from lab." :
            "Note: Mehlich-3 Na measures plant-available sodium. For true sodicity assessment (ESP), enter CEC value or request exchangeable cation analysis from lab.",
    };
}

function assessPHImpact(e) {
    return e && 0 !== e ?
        (e < 5.5 ?
            ((t = "Very Acidic"),
                (r = "Al/Mn toxicity risk. P tied up with Fe/Al. Reduced Ca/Mg availability."),
                (n = "Apply lime (calculate rate with buffer pH). Target pH 6.0-6.5 for optimal nutrient availability.")) :
            e < 6 ?
            ((t = "Acidic"),
                (r = "Suboptimal for P availability. Good for Fe/Mn. Acceptable for most sports turf."),
                (n = "Monitor closely. Light lime application may benefit P uptake if deficiency symptoms appear.")) :
            e < 7 ?
            ((t = "Optimal"),
                (r = "None - ideal pH range for most nutrients. Excellent overall availability."),
                (n = "Maintain current pH. Excellent nutrient availability for all major and minor nutrients.")) :
            e < 7.5 ?
            ((t = "Slightly Alkaline"),
                (r = "Fe/Mn availability declining. P beginning to tie up with Ca. Monitor trace elements."),
                (n =
                    "Monitor Fe status closely. Use chelated Fe (Fe-EDDHA) if chlorosis appears. Consider acidification for putting greens.")) :
            e < 8 ?
            ((t = "Alkaline"),
                (r =
                    "Fe/Mn/Zn lockup likely. P unavailable (Ca-phosphate precipitation). Trace element deficiency risk high."),
                (n =
                    "Apply chelated trace elements (Fe-EDDHA, Mn-EDTA). Acidify with elemental sulphur or acidifying fertilisers. Target pH 6.5-7.0.")) :
            ((t = "Highly Alkaline"),
                (r =
                    "SEVERE trace element lockup. Fe/Mn/Zn/Cu unavailable. P completely tied up. Major deficiency risk."),
                (n =
                    "URGENT: Aggressive acidification program with elemental sulphur (100-200 kg/ha). Weekly chelated Fe applications. May require rootzone modification if calcareous subsoil.")), {
                pH: e,
                status: t,
                issues: r,
                recommendations: n,
            }) :
        null;
    var t, r, n;
}

function generatePHFertiliserRecommendations(e, t, r, n) {
    if (!e || 0 === e) return null;
    var i = "",
        a = "",
        o = "",
        s = "";
    if (
        ((i =
                e < 5.5 ?
                "<strong>Nitrogen form:</strong> Use calcium nitrate or potassium nitrate to raise pH while supplying N. Avoid ammonium sulphate (further acidifies)." :
                e < 6.5 ?
                "<strong>Nitrogen form:</strong> Use balanced N sources (urea, calcium nitrate). Avoid excessive ammonium sulphate." :
                e < 7.5 ?
                "<strong>Nitrogen form:</strong> Any N form acceptable. Ammonium sulphate can help prevent pH rise." :
                "<strong>Nitrogen form:</strong> Use ammonium sulphate or sulphur-coated urea to acidify. Avoid calcium nitrate (raises pH further)."),
            (a =
                e < 6.5 ?
                "<strong>Iron chelate:</strong> Fe-EDTA (economical, stable at pH <6.5). Apply at 2-4 kg Fe/ha for chlorosis." :
                e < 7.5 ?
                "<strong>Iron chelate:</strong> Fe-EDTA or Fe-DTPA (both effective). Monitor for chlorosis as pH approaches 7.5." :
                e < 8.5 ?
                "<strong>Iron chelate:</strong> Fe-EDDHA REQUIRED (only chelate stable at high pH). Apply at 4-8 kg Fe/ha. Fe-EDTA/DTPA ineffective." :
                "<strong>Iron chelate:</strong> Fe-EDDHA at 8-12 kg Fe/ha. Severe alkalinity - chelate effectiveness limited. Consider rootzone acidification."),
            e > 7 && t > 0)
    ) {
        var l = (e - 6.5) * t * 10 * (r || 1.4) * 10 * 1.5;
        o = `<br><strong>Sulphur Acidification:</strong> To reduce pH from ${e.toFixed(1)} to 6.5:<br>\n        • <strong>Elemental sulphur rate:</strong> ${l.toFixed(0)} kg S/ha (${(l / 10).toFixed(0)} kg/1000m²)<br>\n        • <strong>Application:</strong> Split into 2-3 applications over growing season<br>\n        • <strong>Per application:</strong> ${(l / 3).toFixed(0)} kg/ha (${(l / 30).toFixed(0)} kg/1000m²)<br>\n        • <strong>Timeline:</strong> Expect 0.2-0.3 pH drop per application; monitor after 6-8 weeks<br>\n        • <strong>Alternative:</strong> Ammonium sulphate at ${(5 * l).toFixed(0)} kg/ha (contains ~20% S)<br>\n        • <strong>Note:</strong> Acidification slower in high-carbonate soils; may need repeated applications`;
    } else
        e > 7 &&
        !t &&
        (o =
            "<br><strong>Sulphur Acidification:</strong> pH is elevated. Enter CEC value for precise sulphur rate calculation. General guidance: 50-100 kg S/ha for 0.5 pH reduction.");
    if (e > 7 && n > 30) {
        s = `<br><br><div style="padding: 10px; background: var(--gaip-critical-bg); border-left: 3px solid #ef4444; border-radius: 4px; margin-top: 10px;">\n        <strong>⚠️ ${e > 7.5 && n > 60 ? "CRITICAL" : e > 7 && n > 45 ? "HIGH" : "MODERATE"} pH × SODIUM INTERACTION:</strong><br>\n        High pH (${e.toFixed(1)}) + Elevated Na (${n.toFixed(0)} ppm) = Increased sodicity risk<br>\n        • Alkaline conditions favor sodium displacement of calcium on exchange sites<br>\n        • Expect progressive structure degradation and infiltration decline<br>\n        • <strong>Action required:</strong> Gypsum application (1.5-2.5 t/ha) + acidification program<br>\n        • Acidification to pH 6.5-7.0 will reduce Na activity and improve Ca displacement<br>\n        • Monitor SAR in irrigation water - high-pH soils more sensitive to sodic water\n        </div>`;
    }
    return {
        nForm: i,
        feChelate: a,
        acidification: o,
        sodiumWarning: s,
    };
}

function assessPHWaterInteraction(e, t, r, n) {
    if (!e || 0 === e) return null;
    var i = t > 60 && r > 100;
    return e > 7.5 && i ?
        `<div style="padding: 10px; background: var(--gaip-warning-bg); border-left: 3px solid #f59e0b; border-radius: 4px; margin-top: 10px;">\n        <strong>⚠️ SOIL pH × WATER CHEMISTRY WARNING:</strong><br>\n        Alkaline soil (pH ${e.toFixed(1)}) + Calcium carbonate-depositing water = Progressive alkalinity increase<br>\n        • Water contains Ca ${t.toFixed(0)} mg/L + HCO₃ ${r.toFixed(0)} mg/L → will deposit scale<br>\n        • Each irrigation cycle deposits more calcium carbonate, raising soil pH further<br>\n        • <strong>Long-term risk:</strong> Soil pH will increase to 8.0-8.5+ without intervention<br>\n        • <strong>Recommendations:</strong><br>\n        &nbsp;&nbsp;1. Acidify irrigation water to pH 6.5-7.0 to prevent carbonate precipitation<br>\n        &nbsp;&nbsp;2. Apply elemental sulphur to soil (see acidification calculator above)<br>\n        &nbsp;&nbsp;3. Use acidifying fertilisers (ammonium sulphate) exclusively<br>\n        &nbsp;&nbsp;4. Monitor soil pH quarterly - expect upward drift without treatment\n        </div>` :
        e > 7 && i ?
        `<div style="padding: 10px; background: var(--gaip-warning-bg); border-left: 3px solid #f59e0b; border-radius: 4px; margin-top: 10px;">\n        <strong>SOIL pH × WATER CHEMISTRY CAUTION:</strong><br>\n        Slightly alkaline soil (pH ${e.toFixed(1)}) + depositing water → monitor for pH drift<br>\n        • Water will deposit calcium carbonate over time<br>\n        • Consider water acidification or sulphur applications to prevent pH increase\n        </div>` :
        null;
}

function analyseLOIStratification(e, t, r, n) {
    var i,
        a,
        o,
        s,
        l,
        d,
        c = e || t || r;
    if (!c && !(n && n > 0)) return null;
    if (c) {
        var p = (e ? 1 : 0) + (t ? 1 : 0) + (r ? 1 : 0);
        ((i = (safeNum(e, 0) + safeNum(t, 0) + safeNum(r, 0)) / p), (a = safeNum(e, 0) - safeNum(r, 0)), (o = e > 1.5 * t));
    } else((i = n), (a = 0), (o = !1));
    var g = "",
        u = "",
        m = "";
    return (
        i > 4 ?
        (g =
            "<br><strong>Soil Chemistry Impacts:</strong> Elevated OM increases CEC (nutrient retention) but can tie up applied nutrients in organic complexes. Expect higher microbial activity, increased N mineralization in warm periods (flush growth risk), and potential Mn/Fe availability issues due to organic acids.") :
        i < 2 &&
        (g =
            "<br><strong>Soil Chemistry Impacts:</strong> Low OM reduces CEC and nutrient buffering. Expect rapid nutrient leaching, especially in sand rootzones. Lower microbial activity may reduce disease suppression."),
        (o || a > 1.5) &&
        (u =
            "<br><strong>Water Management Issues:</strong> Organic layers create hydrophobic zones - expect localized dry spots (LDS), uneven wetting patterns, and preferential flow channels. Surface OM acts as a sponge when wet (soft, spongy surface) but becomes water-repellent when dry. Infiltration rates will be variable and unpredictable."),
        i > 5 &&
        (u +=
            " Excessive OM holds 15-20x its weight in water - surface will be chronically soft and wet even with good drainage. Expect poor oxygen diffusion into rootzone."),
        i < 2 ?
        ((s = "Low OM"),
            (l = `Average LOI ${i.toFixed(1)}% - Below USGA optimal (2-4%). Low nutrient/water retention.`),
            (d =
                "Increase organic topdressing (80:20 sand:peat mix). Compost tea applications. Monitor nutrient leaching."),
            (m =
                "<br><br><strong>REMEDIATION PROGRAM (Low OM):</strong><br>\n        • <strong>Topdressing:</strong> 80:20 sand:peat blend at 1.5-2.0 kg/m² per application<br>\n        • <strong>Frequency:</strong> Every 3-4 weeks during growing season (12-15 applications/year)<br>\n        • <strong>Annual volume:</strong> Approximately 20-30 kg/m² to raise OM by 0.5-1.0%/year<br>\n        • <strong>Aeration:</strong> Core (13-16mm hollow tines) at 60-80mm spacing, 75-100mm depth<br>\n        • <strong>Core holes filled with:</strong> Same 80:20 blend to incorporate OM at depth<br>\n        • <strong>Timeline:</strong> 2-3 years to reach USGA optimal range")) :
        i <= 4 ?
        ((s = "Optimal OM"),
            (l = `Average LOI ${i.toFixed(1)}% - Within USGA specs (2-4%). Ideal for putting greens.`),
            (d = "Maintain current topdressing program. Excellent balance of structure and performance."),
            (m =
                "<br><br><strong>MAINTENANCE PROGRAM (Optimal OM):</strong><br>\n        • <strong>Topdressing:</strong> Pure sand at 0.8-1.2 kg/m² per application<br>\n        • <strong>Frequency:</strong> Every 2-3 weeks during season (15-20 applications/year)<br>\n        • <strong>Annual volume:</strong> 12-18 kg/m² to maintain OM equilibrium<br>\n        • <strong>Aeration:</strong> Mix of solid tine (6-10mm, 25mm spacing, monthly) and periodic core (13-16mm hollow, 60mm spacing, quarterly)<br>\n        • <strong>Verticutting:</strong> 0-3mm depth (standard - no soil disturbance), 10mm spacing, bi-weekly to monthly<br>\n        • <strong>Goal:</strong> Balance OM accumulation from clippings with dilution from sand")) :
        i <= 6 ?
        ((s = "Elevated OM"),
            (l = `Average LOI ${i.toFixed(1)}% - Above USGA optimal. Risk of soft, inconsistent surfaces and increased disease pressure.`),
            (d = "Reduce organic topdressing. Increase sand-only applications. Core + sand backfill."),
            (m =
                "<br><br><strong>OM REDUCTION PROGRAM (Elevated):</strong><br>\n        • <strong>Topdressing:</strong> 100% pure sand at 1.2-1.8 kg/m² per application<br>\n        • <strong>Frequency:</strong> Weekly applications (40-50/year) for aggressive dilution<br>\n        • <strong>Annual volume:</strong> 50-75 kg/m² to reduce OM by 0.5-1.0%/year<br>\n        • <strong>Core aeration:</strong> 16-19mm hollow tines, 50mm spacing, 100mm+ depth<br>\n        • <strong>Aeration frequency:</strong> Monthly during season (9-12x/year)<br>\n        • <strong>Core removal:</strong> Remove 100% of cores - DO NOT return to surface<br>\n        • <strong>Backfill:</strong> Fill holes with pure sand only<br>\n        • <strong>Deep-tine:</strong> 12-15mm solid tines to 150-200mm depth, 40mm spacing, quarterly<br>\n        • <strong>Verticutting:</strong> 0-3mm depth (standard), 10mm spacing, weekly for thatch control<br>\n        • <strong>Scarification:</strong> 25-75mm spacing (1-3 inch), working into rootzone, 1-2x/year during renovation<br>\n        • <strong>Timeline:</strong> 2-3 years to return to optimal range")) :
        ((s = "Excessive OM"),
            (l = `Average LOI ${i.toFixed(1)}% - Critically high (>6%). Severe softness, layering, and disease issues expected.`),
            (d =
                "URGENT: Aggressive sand topdressing (monthly). Deep-tine aeration. Consider rootzone renovation if >8%."),
            (m =
                "<br><br><strong>INTENSIVE OM REDUCTION PROGRAM (Excessive):</strong><br>\n        <em>Critical intervention required - surface performance severely compromised</em><br><br>\n        • <strong>Topdressing:</strong> 100% pure sand at 2.0-3.0 kg/m² per application<br>\n        • <strong>Frequency:</strong> Twice weekly if traffic allows (80-100 applications/year)<br>\n        • <strong>Annual volume:</strong> 150-250 kg/m² for rapid OM dilution<br>\n        • <strong>Core aeration:</strong> 19-25mm hollow tines (largest practical), 40mm spacing, 125-150mm depth<br>\n        • <strong>Aeration frequency:</strong> Every 2-3 weeks (15-20x/year)<br>\n        • <strong>Core disposal:</strong> Remove ALL cores from site - CRITICAL<br>\n        • <strong>Backfill:</strong> Pure sand, level immediately<br>\n        • <strong>Verticutting:</strong> 0-3mm depth (standard), 10mm spacing, twice weekly<br>\n        • <strong>Aggressive scarification:</strong> 25-75mm spacing, penetrating into rootzone, monthly during season<br>\n        • <strong>Groomers/brushes:</strong> Daily use to stand turf and work sand into canopy<br>\n        • <strong>Fraze mowing:</strong> Consider if OM >7% - removes 6-12mm of surface organic layer<br>\n        • <strong>DryJect:</strong> Pneumatic sand injection for deep sand placement (100-150mm) without surface disruption - most effective layer-bypass technology<br>\n        • <strong>Timeline:</strong> 3-5 years minimum; if >8%, consider full reconstruction<br>\n        • <strong>Play restriction:</strong> May need to reduce traffic during intensive treatment periods"),
            i > 8 &&
            (m += `<br><br><strong>⚠️ CRITICAL - RENOVATION THRESHOLD EXCEEDED:</strong><br>\n            At ${i.toFixed(1)}% OM, maintenance-based reduction may be impractical. Evaluate:<br>\n            • Full rootzone reconstruction (strip and rebuild to USGA spec)<br>\n            • Koro/fraze removal of top 25-50mm followed by pure sand topdressing program<br>\n            • Cost-benefit: 3-5 years of intensive maintenance vs. 1 season renovation`)),
        o && a > 1.5 ?
        ((l += ` <strong>⚠ SEVERE STRATIFICATION:</strong> Surface OM (${e.toFixed(1)}%) >> Deep (${r.toFixed(1)}%). Layering causes hydrophobicity, disease, uneven moisture.`),
            (d += " CRITICAL: Aggressive scarification, sand injection, or fraze mowing to break layers."),
            (m +=
                "<br><br><strong>LAYER-BREAKING OPERATIONS (Stratification):</strong><br>\n        • <strong>Verticutting:</strong> 0-3mm depth (standard - avoid soil disturbance), 10mm spacing, weekly<br>\n        • <strong>Aggressive scarification:</strong> 25-75mm spacing, penetrating 10-30mm into rootzone to disrupt organic layer<br>\n        • <strong>Frequency:</strong> Monthly during active growth for 3-4 months<br>\n        • <strong>Sarel rolling:</strong> 10mm solid knives, penetrate through organic layer into sand<br>\n        • <strong>DryJect:</strong> Pneumatic sand injection 100-150mm deep, bypasses organic layer and injects sand directly into rootzone<br>\n        • <strong>Timing:</strong> Avoid hot/dry periods (risk of severe damage to hydrophobic areas)<br>\n        • <strong>Follow-up:</strong> Immediate heavy topdressing (3-4 kg/m² sand) to fill channels and dilute organics<br>\n        • <strong>Note:</strong> Layer-breaking is disruptive - plan during periods of lower play demand")) :
        a > 1 &&
        ((l += ` Moderate stratification detected (${a.toFixed(1)}% gradient). OM decreasing with depth indicates surface accumulation.`),
            (d += " Increase core aeration frequency (4-6x per year). Sand topdressing after each aeration."),
            (m +=
                "<br><br><strong>STRATIFICATION PREVENTION:</strong><br>\n        • <strong>Core aeration:</strong> 13-16mm hollow tines, 60mm spacing, 100mm depth<br>\n        • <strong>Frequency:</strong> Every 6-8 weeks during season (5-7x/year)<br>\n        • <strong>Remove cores:</strong> Essential - returning cores re-deposits organic matter<br>\n        • <strong>Sand topdressing:</strong> 1.5-2.0 kg/m² immediately after coring to fill holes<br>\n        • <strong>Deep solid-tine:</strong> 10-12mm tines to 150mm, 30-40mm spacing, alternate months<br>\n        • <strong>Verticutting:</strong> 0-3mm depth (standard), 10mm spacing, bi-weekly<br>\n        • <strong>Goal:</strong> Prevent further stratification while gradually homogenizing profile")), {
            status: s,
            avgLOI: i,
            gradient: a,
            analysis: l + g + u,
            recommendations: d,
            maintenanceProgram: m,
        }
    );
}

function assessCEC(e) {
    return e && 0 !== e ?
        (e < 3 ?
            ((t = "Very Low"),
                (r = `CEC ${e.toFixed(1)} meq/100g - Pure sand rootzone (typical USGA greens). Very limited nutrient retention - nutrients leach rapidly.`),
                (n =
                    "Weekly light fertilisation required. Use controlled-release products (3-4 month). Monitor nutrient levels closely (monthly soil tests). Consider organic matter within USGA specs (2-4%).")) :
            e < 8 ?
            ((t = "Low"),
                (r = `CEC ${e.toFixed(1)} meq/100g - Low buffering capacity. Moderate nutrient retention but still prone to leaching.`),
                (n =
                    "Bi-weekly fertilisation. Split N applications (never >5 kg/ha/application). Use slow-release where appropriate. Soil test every 6-8 weeks.")) :
            e < 15 ?
            ((t = "Moderate"),
                (r = `CEC ${e.toFixed(1)} meq/100g - Good nutrient retention. Balanced fertilisation requirements. Typical loamy sand rootzones.`),
                (n =
                    "Standard fertilisation programs effective. Monthly applications acceptable for most nutrients. Soil test 2-3x per year.")) :
            e < 25 ?
            ((t = "Moderate-High"),
                (r = `CEC ${e.toFixed(1)} meq/100g - High nutrient retention. Lower fertilisation frequency possible.`),
                (n =
                    "Less frequent fertilisation needed (6-8 week intervals). Watch for trace element tie-up at high pH. May need higher K rates to compete with Ca/Mg on exchange sites.")) :
            ((t = "High"),
                (r = `CEC ${e.toFixed(1)} meq/100g - Very high buffering capacity (typical heavy clay - not ideal for high-performance sports turf).`),
                (n =
                    "Likely drainage/compaction issues. Nutrient retention high but availability may be limited. Consider rootzone modification (sand incorporation) or reconstruction.")), {
                status: t,
                CEC: e,
                analysis: r,
                recommendations: n,
            }) :
        null;
    var t, r, n;
}
window.GAIP_ClimateUtils = {
    validate: validateClimateMetrics,
    getStatusSummary: generateClimateStatusSummary,
    getWithFallback: getClimateMetricsWithFallback,
};
var SEVERITY = {
        ACCEPTABLE: {
            code: "ACCEPTABLE",
            symbol: "✅",
            color: "#065f46",
            bgColor: "var(--gaip-good-bg)",
            borderColor: "#10b981",
            description: "Operate normally. Routine monitoring only.",
            actionWindow: "No immediate action required",
        },
        NO_DATA: {
            code: "NO DATA",
            symbol: "❓",
            color: "var(--gaip-text-secondary)",
            bgColor: "var(--gaip-surface-hover)",
            borderColor: "var(--gaip-text-muted)",
            description: "Data required for assessment.",
            actionWindow: "Enter data to enable analysis",
        },
        MONITOR: {
            code: "MONITOR",
            symbol: "⚠️",
            color: "#92400e",
            bgColor: "var(--gaip-warning-bg)",
            borderColor: "#f59e0b",
            description: "Caution advised. Schedule intervention.",
            actionWindow: "Action within 90-180 days",
        },
        HIGH_RISK: {
            code: "HIGH_RISK",
            symbol: "🔴",
            color: "#991b1b",
            bgColor: "var(--gaip-critical-bg)",
            borderColor: "#ef4444",
            description: "Action required. Performance degrading.",
            actionWindow: "Action within 30-90 days",
        },
        IMMINENT_FAILURE: {
            code: "IMMINENT_FAILURE",
            symbol: "⛔",
            color: "#7f1d1d",
            bgColor: "var(--gaip-critical-border)",
            borderColor: "#dc2626",
            description: "CRITICAL. Immediate intervention required.",
            actionWindow: "IMMEDIATE action (0-30 days)",
        },
    },
    FORENSIC_RECORD = {
        runID: "",
        timestamp: "",
        inputs: {},
        assumptions: {},
        determinations: {},
        init: function() {
            ((this.runID = "GAIP-" + Date.now().toString(36).toUpperCase()),
                (this.timestamp = new Date().toISOString()),
                (this.inputs = {}),
                (this.assumptions = {}),
                (this.determinations = {}));
        },
        recordInput: function(e, t, r) {
            (this.inputs[e] || (this.inputs[e] = {}), (this.inputs[e][t] = r));
        },
        recordAssumption: function(e, t) {
            this.assumptions[e] = t;
        },
        recordDetermination: function(e, t, r, n) {
            this.determinations[e] = {
                severity: t,
                decision: r,
                actions: n,
            };
        },
    };

function generateDecisionBlock(e, t, r, n, i, a, o) {
    var s = SEVERITY[t] || SEVERITY.MONITOR,
        l = "";
    o &&
        o.length > 0 &&
        ((l =
                '<div style="margin-top: 10px;"><strong>REQUIRED ACTIONS:</strong><ul style="margin: 5px 0 0 20px; padding: 0;">'),
            o.forEach(function(e) {
                l += '<li style="margin: 3px 0;">' + e + "</li>";
            }),
            (l += "</ul></div>"));
    var d = `\n    <div style="margin: 15px 0; padding: 12px; background: ${s.bgColor}; border-left: 4px solid ${s.borderColor}; border-radius: 4px; color: var(--gaip-text);">\n        <div style="display: flex; align-items: center; margin-bottom: 8px;">\n            <span style="font-size: 20px; margin-right: 8px;">${s.symbol}</span>\n            <strong style="color: ${s.color}; font-size: 14px;">${e}: ${s.code}</strong>\n        </div>\n        <p style="margin: 4px 0; font-size: 12px; color: ${s.color};">\n            ${s.description} ${s.actionWindow}\n        </p>\n        <div style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 3px; color: var(--gaip-text);">\n            <strong>DECISION:</strong><br>\n            <strong style="font-size: 11px; color: var(--gaip-text-secondary);">OBSERVATION:</strong> ${r}<br>\n            <strong style="font-size: 11px; color: var(--gaip-text-secondary);">MECHANISM:</strong> ${n}<br>\n            <strong style="font-size: 11px; color: var(--gaip-text-secondary);">CONSEQUENCE:</strong> ${i}<br>\n            <strong style="font-size: 11px; color: var(--gaip-text-secondary);">DETERMINATION:</strong> ${a}\n        </div>\n        ${l}\n    </div>\n    `;
    return (FORENSIC_RECORD.recordDetermination(e, t, `${r} ${n} ${i} ${a}`, o ? o.join("; ") : "None required"), d);
}

function generateFailurePreview(e, t, r) {
    return `\n    <div style="margin: 10px 0; padding: 10px; background: var(--gaip-critical-bg); border: 1px solid var(--gaip-critical-border); border-radius: 4px;">\n        <strong style="color: #991b1b;">⚠️ Failure Preview (if ignored):</strong><br>\n        <span style="font-size: 12px; color: #7f1d1d;">${t}</span><br>\n        <strong style="font-size: 11px; margin-top: 6px; display: inline-block;">Remediation complexity:</strong>\n        <span style="font-size: 11px;">${r}</span>\n    </div>\n    `;
}

function evaluateConstraintHierarchy(e) {
    for (var t = ["shade", "water", "mlsn", "traffic"], r = null, n = [], i = 0; i < t.length; i++) {
        var a = t[i];
        if (e[a] && ("HIGH_RISK" === e[a].severity || "IMMINENT_FAILURE" === e[a].severity)) {
            r = a;
            for (var o = i + 1; o < t.length; o++) n.push(t[o]);
            break;
        }
    }
    return {
        blockingConstraint: r,
        blockedModules: n,
    };
}

function exportForensicRecordPDF() {
    var e = null;
    if ((window.jspdf && window.jspdf.jsPDF ? (e = window.jspdf.jsPDF) : window.jsPDF && (e = window.jsPDF), !e))
        return (
            console.error("jsPDF not found. Checked window.jspdf.jsPDF and window.jsPDF"),
            console.log("window.jspdf:", window.jspdf),
            console.log("window.jsPDF:", window.jsPDF),
            void alert("PDF library not loaded. Please contact support.\n\nTechnical details logged to console (F12).")
        );
    var t = new e(),
        r = 15,
        n = t.internal.pageSize.getWidth(),
        i = 20;
    if (
        (t.setFontSize(16),
            t.setFont(void 0, "bold"),
            t.text("GILBA AGRONOMIC INTELLIGENCE", r, i),
            (i += 8),
            t.setFontSize(14),
            t.text("Forensic Decision Record", r, i),
            (i += 10),
            t.setFontSize(10),
            t.setFont(void 0, "normal"),
            t.text("Run ID: " + FORENSIC_RECORD.runID, r, i),
            (i += 6),
            t.text("Timestamp: " + new Date(FORENSIC_RECORD.timestamp).toLocaleString(), r, i),
            (i += 6),
            window.GaipTurfProfile && window.GaipTurfProfile.state)
    ) {
        var a = window.GaipTurfProfile.state,
            o = window.GaipTurfProfile.getThresholdContext(),
            s = o && o.description ? o.description : a.turfType || "Not specified",
            l = a.species || "Not specified",
            d = o ? "DLI: " + o.dliMinimum + "–" + o.dliOptimal + " mol/m²/d" : "";
        (t.text("Turf Profile: " + s + " | " + l + (d ? " | " + d : ""), r, i),
            (i += 6),
            a.variety && "generic" !== a.variety && (t.text("Variety: " + a.variety, r, i), (i += 6)));
    }
    for (var c in ((i += 4),
            t.setFont(void 0, "bold"),
            t.text("MODULE DETERMINATIONS:", r, i),
            t.setFont(void 0, "normal"),
            (i += 6),
            FORENSIC_RECORD.determinations)) {
        i > 270 && (t.addPage(), (i = 20));
        var p = FORENSIC_RECORD.determinations[c];
        (t.setFont(void 0, "bold"),
            t.text(c.toUpperCase() + ": " + p.severity, 18, i),
            (i += 6),
            t.setFont(void 0, "normal"),
            t.setFontSize(9));
        var g = t.splitTextToSize(p.decision, n - 30 - 10);
        if ((t.text(g, 20, i), (i += 5 * g.length), p.actions && "None required" !== p.actions)) {
            var u = t.splitTextToSize("Actions: " + p.actions, n - 30 - 10);
            (t.text(u, 20, i), (i += 5 * u.length));
        }
        (t.setFontSize(10), (i += 3));
    }
    ((i = 280),
        t.setFontSize(8),
        t.setTextColor(107, 114, 128),
        t.text("Generated by Gilba Agronomic Intelligence Hub v9.3.3", r, i),
        t.save("GAIP_Forensic_Record_" + FORENSIC_RECORD.runID + ".pdf"));
}

function getAverageTemperature(e, t) {
    // FIX v10.9.5: Always check rawWeatherData first — it's set fresh on every
    // run before cascade fires, so it's never stale. climateMetrics.todayMean
    // can be stale if cascade reads it before the new P object is assigned.
    function _currentHourTemp(temps, times) {
        var nowHour = new Date().getHours();
        if (nowHour < temps.length && temps[nowHour] != null) return temps[nowHour];
        if (times && times.length === temps.length) {
            var nowDate = new Date().toISOString().slice(0, 10);
            for (var _i = 0; _i < Math.min(48, times.length); _i++) {
                var _ts = times[_i] || "";
                if (_ts.startsWith(nowDate) && parseInt(_ts.slice(11, 13), 10) === nowHour && temps[_i] != null)
                    return temps[_i];
            }
        }
        return null;
    }

    // 1. rawWeatherData — set at start of every run, always current
    var _raw = window.rawWeatherData;
    if (_raw && _raw.forecast && _raw.forecast.hourly && _raw.forecast.hourly.temperature_2m) {
        var _ct = _currentHourTemp(_raw.forecast.hourly.temperature_2m, _raw.forecast.hourly.time);
        if (_ct != null) {
            console.log("✅ Using temperature from climate engine:", _ct.toFixed(1) + "°C (current hour)");
            return _ct;
        }
    }

    // 2. Passed-in weather arg (same data, different reference)
    if (e && e.forecast && e.forecast.hourly && e.forecast.hourly.temperature_2m) {
        var _ct2 = _currentHourTemp(e.forecast.hourly.temperature_2m, e.forecast.hourly.time);
        if (_ct2 != null) {
            console.log("✅ Using temperature from climate engine:", _ct2.toFixed(1) + "°C (current hour)");
            return _ct2;
        }
    }
    if (e && e.hourly && e.hourly.temperature_2m) {
        var _ct3 = _currentHourTemp(e.hourly.temperature_2m, e.hourly.time);
        if (_ct3 != null) {
            console.log("✅ Using temperature from legacy weather:", _ct3.toFixed(1) + "°C (current hour)");
            return _ct3;
        }
    }

    // 3. climateMetrics fallback — may be stale but better than nothing
    if (window.climateMetrics && window.climateMetrics.temperature) {
        var cm = window.climateMetrics.temperature;
        var preferred = cm.todayMean != null ? cm.todayMean : cm.mean;
        if (preferred != null) {
            console.log("✅ Using temperature from climate engine:", preferred.toFixed(1) + "°C (today mean)");
            return preferred;
        }
    }
    console.warn("⚠️ No weather data, using manual/default temps");
    var o = t.climate?.manual?.temperature || {},
        s = safeNum(o.min, 0),
        l = safeNum(o.max, 0);
    return (
        0 === s && (s = safeNum(t.climate?.manual?.tmin, 0)),
        0 === l && (l = safeNum(t.climate?.manual?.tmax, 0)),
        0 === s && (s = 15),
        0 === l && (l = 25),
        console.log("   Manual temps: " + s + "°C - " + l + "°C (avg " + ((s + l) / 2).toFixed(1) + "°C)"),
        (s + l) / 2
    );
}

function calcC3GrowthPotential(e) {
    var t = Math.exp(-0.5 * Math.pow((e - 20) / 10, 2));
    return Math.max(0, Math.min(100, 100 * t));
}

function calcC4GrowthPotential(e) {
    var t = Math.exp(-0.5 * Math.pow((e - 31) / 8, 2));
    return Math.max(0, Math.min(100, 100 * t));
}

function calcMixedGrowthPotential(e, t, r) {
    var n = calcC3GrowthPotential(e),
        i = calcC4GrowthPotential(e),
        a = t * n + r * i;
    return {
        c3potential: n,
        c4potential: i,
        weighted: a,
        temperature: e,
        dominant: t > r ? "C3" : r > t ? "C4" : "Mixed",
        status: a >= 80 ?
            "Optimal growth conditions" :
            a >= 60 ?
            "Good growth conditions" :
            a >= 40 ?
            "Moderate growth - suboptimal temp" :
            a >= 20 ?
            "Slow growth - temperature stress" :
            "Minimal/dormant - temperature limiting",
    };
}

function generateGrowthChart_OLD_NOT_USED(e, t, r) {
    for (
        var n = 600, i = 300, a = 20, o = 100, s = 40, l = 50, d = n - l - o, c = i - a - s, p = [], g = [], u = [], m = 0; m <= 45; m += 1
    ) {
        var f = l + (m / 45) * d,
            y = calcC3GrowthPotential(m),
            h = calcC4GrowthPotential(m),
            v = a + c - y * c,
            b = a + c - h * c,
            x = a + c - (t * y + r * h) * c;
        (p.push(f.toFixed(1) + "," + v.toFixed(1)),
            g.push(f.toFixed(1) + "," + b.toFixed(1)),
            t > 0 && r > 0 && u.push(f.toFixed(1) + "," + x.toFixed(1)));
    }
    var w = l + (e / 45) * d,
        S = calcC3GrowthPotential(e),
        C = calcC4GrowthPotential(e),
        M = a + c - (t * S + r * C) * c,
        I = `\n    <svg width="600" height="300" style="background: var(--gaip-surface); border: 1px solid var(--gaip-border); border-radius: 8px; margin: 10px 0;">\n        \x3c!-- Grid lines --\x3e\n        <g stroke="var(--gaip-border)" stroke-width="1">\n            ${[
      0, 0.25, 0.5, 0.75, 1,
    ]
      .map(function (e) {
        var t = a + c - e * c;
        return '<line x1="' + l + '" y1="' + t + '" x2="' + (n - o) + '" y2="' + t + '" stroke-dasharray="2,2"/>';
      })
      .join(
        "",
      )}\n        </g>\n        \n        \x3c!-- Temperature grid --\x3e\n        <g stroke="var(--gaip-surface-hover)" stroke-width="1">\n            ${[
      0, 10, 20, 30, 40,
    ]
      .map(function (e) {
        var t = l + (e / 45) * d;
        return '<line x1="' + t + '" y1="' + a + '" x2="' + t + '" y2="' + (i - s) + '"/>';
      })
      .join(
        "",
      )}\n        </g>\n        \n        \x3c!-- C3 curve --\x3e\n        <polyline points="${p.join(" ")}" \n                  fill="none" stroke="#3b82f6" stroke-width="2.5" opacity="0.8"/>\n        \n        \x3c!-- C4 curve --\x3e\n        <polyline points="${g.join(" ")}" \n                  fill="none" stroke="#ef4444" stroke-width="2.5" opacity="0.8"/>\n        \n        \x3c!-- Mixed curve (if applicable) --\x3e\n        ${u.length > 0 ? '<polyline points="' + u.join(" ") + '" fill="none" stroke="#8b5cf6" stroke-width="3" opacity="0.9"/>' : ""}\n        \n        \x3c!-- Current temperature indicator --\x3e\n        <line x1="${w}" y1="${a}" x2="${w}" y2="${i - s}" \n              stroke="#f59e0b" stroke-width="2" stroke-dasharray="5,5"/>\n        <circle cx="${w}" cy="${M}" r="5" fill="#f59e0b" stroke="var(--gaip-surface)" stroke-width="2"/>\n        \n        \x3c!-- Axes --\x3e\n        <line x1="${l}" y1="${i - s}" \n              x2="${n - o}" y2="${i - s}" \n              stroke="var(--gaip-text)" stroke-width="2"/>\n        <line x1="${l}" y1="${a}" \n              x2="${l}" y2="${i - s}" \n              stroke="var(--gaip-text)" stroke-width="2"/>\n        \n        \x3c!-- Y-axis labels --\x3e\n        ${[
      0, 25, 50, 75, 100,
    ]
      .map(function (e) {
        return (
          '<text x="' +
          (l - 10) +
          '" y="' +
          (a + c - (e / 100) * c + 4) +
          '" text-anchor="end" font-size="11" fill="var(--gaip-text-secondary)">' +
          e +
          "%</text>"
        );
      })
      .join("")}\n        \n        \x3c!-- X-axis labels --\x3e\n        ${[0, 10, 20, 30, 40]
      .map(function (e) {
        return (
          '<text x="' +
          (l + (e / 45) * d) +
          '" y="' +
          (i - s + 20) +
          '" text-anchor="middle" font-size="11" fill="var(--gaip-text-secondary)">' +
          e +
          "°C</text>"
        );
      })
      .join(
        "",
      )}\n        \n        \x3c!-- Axis titles --\x3e\n        <text x="300" y="295" text-anchor="middle" font-size="12" font-weight="600" fill="var(--gaip-text)">\n            Temperature (°C)\n        </text>\n        <text x="${l - 35}" y="150" text-anchor="middle" transform="rotate(-90 ${l - 35} 150)" \n              font-size="12" font-weight="600" fill="var(--gaip-text)">\n            Growth Potential (%)\n        </text>\n        \n        \x3c!-- Legend --\x3e\n        <g transform="translate(${n - o + 10}, ${a})">\n            <line x1="0" y1="10" x2="30" y2="10" stroke="#3b82f6" stroke-width="2.5"/>\n            <text x="35" y="14" font-size="11" fill="var(--gaip-text)">C3 Cool-season</text>\n            \n            <line x1="0" y1="30" x2="30" y2="30" stroke="#ef4444" stroke-width="2.5"/>\n            <text x="35" y="34" font-size="11" fill="var(--gaip-text)">C4 Warm-season</text>\n            \n            ${u.length > 0 ? '<line x1="0" y1="50" x2="30" y2="50" stroke="#8b5cf6" stroke-width="3"/><text x="35" y="54" font-size="11" fill="var(--gaip-text)">Your Mix</text>' : ""}\n            \n            <line x1="0" y1="${u.length > 0 ? 70 : 50}" x2="30" y2="${u.length > 0 ? 70 : 50}" \n                  stroke="#f59e0b" stroke-width="2" stroke-dasharray="5,5"/>\n            <text x="35" y="${u.length > 0 ? 74 : 54}" font-size="11" fill="#f59e0b" font-weight="600">\n                Current (${e.toFixed(1)}°C)\n            </text>\n        </g>\n    </svg>`;
    return I;
}

/**
 * MLSN/SLAN Soil Nutrient Analysis Engine
 *
 * Calculates soil nutrient sufficiency using either:
 * - MLSN (Minimum Levels for Sustainable Nutrition) methodology
 * - SLAN (Sufficiency Level of Available Nutrients) methodology
 *
 * @param {Object} state - Hub state containing soil, turf, and water data
 * @param {Object} weather - Weather data for growth potential calculations
 * @returns {string} HTML output for soil analysis display
 */
/**
 * PACE-Style MLSN Engine v2.0.0
 *
 * Key change: Target = MLSN + Annual Uptake (N-linked)
 * Instead of: Target = MLSN × 1.5
 *
 * This aligns with PACE Turf Climate Appraisal methodology where:
 * - Annual uptake is calculated from N programme via tissue concentration ratios
 * - Target soil level = MLSN minimum + expected annual removal
 *
 * References:
 * - PACE Turf Climate Appraisal Form
 * - Kussow et al. (2012) ISRN Agronomy
 * - Woods/Asian Turfgrass Center ClipVol methodology
 */

function mlsnEngine(state, weather) {
    // Extract soil nutrient values (ppm)
    const soilPPM = (state.soil && state.soil.ppm) || {};

    // Rootzone parameters with defaults
    const rootzoneDepth = safeNum(state.soil && state.soil.depthCm, 10);
    const bulkDensity = safeNum(state.soil && state.soil.bulkDensity, 1.4);

    // Turf profile
    const turfProfile = state.turf || {};
    const methodology = (state.soil && state.soil.methodology) || "slan";

    // Determine soil type from construction
    const construction = (turfProfile.construction || "").toLowerCase();
    const soilType = construction === "sand_profile" || construction === "sand profile" ? "sands" : "others";

    // Determine grass type (cool-season vs warm-season)
    let grassType = "cool-season";
    if (turfProfile.warmBase && turfProfile.percentC3Cover < 50) {
        grassType = "warm-season";
    }

    // Calculate growth potential from temperature
    const avgTemperature = getAverageTemperature(weather, state);
    const c3c4Fractions = calculateC3C4Fractions(turfProfile);

    // Cotula: bypass C3/C4 GP — use cotula activity fraction instead
    let growthPotential;
    if (c3c4Fractions.isCotula && window.GAIP_CotulaBowling) {
        const cotulaActivity = window.GAIP_CotulaBowling.calcCotulActivityFraction(avgTemperature);
        growthPotential = {
            c3potential: 0,
            c4potential: 0,
            weighted: cotulaActivity * 100, // scale to 0-100 to match GP convention
            temperature: avgTemperature,
            dominant: "Cotula",
            isCotula: true,
            status: cotulaActivity >= 0.7 ?
                "Active growth conditions" :
                cotulaActivity >= 0.4 ?
                "Moderate growth conditions" :
                cotulaActivity >= 0.15 ?
                "Slow growth — temperature limiting" :
                "Dormant — minimal growth",
        };
    } else {
        growthPotential = calcMixedGrowthPotential(avgTemperature, c3c4Fractions.c3frac, c3c4Fractions.c4frac);
    }

    // Soil pH for Fe/Mn adjustment
    const soilPH = safeNum(state.soil.pH_water || state.soil.pH_cacl2, 7);

    // =========================================================================
    // N PROGRAMME CONTEXT (NEW - PACE-style)
    // =========================================================================

    // Get monthly N rate from fertility settings (if available)
    const monthlyNRate = safeNum(state.fertility?.monthlyN, 0);
    const species = turfProfile.grassSpecies || turfProfile.warmBase || null;
    const context = (turfProfile.turfType || "").toLowerCase().includes("green") ? "greens" : "sports";

    // ── Cotula N program — empirical model, bypasses PACE Turf GP-linked calc ─
    const isCotulaSurface =
        c3c4Fractions.isCotula === true || turfProfile.cotula === true || (species || "").toLowerCase() === "cotula";

    let annualNRate;
    if (isCotulaSurface && window.GAIP_CotulaBowling) {
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const cotulaN = window.GAIP_CotulaBowling.calcCotulaMonthlyN(avgTemperature, "moderate", currentMonth, true);
        // Annualise from benchmark (empirical, not GP-derived)
        annualNRate = cotulaN.annualBenchmark;
    } else {
        // Standard path: estimate growing season months based on latitude
        const latitude = Math.abs(state.climate?.latitude || state.climate?.lat || -33);
        const isC4 = grassType === "warm-season";
        let growingMonths = 10; // default
        if (isC4) {
            growingMonths = latitude < 27 ? 12 : latitude < 35 ? 11 : 9;
        } else {
            growingMonths = latitude < 25 ? 9 : 10;
        }
        annualNRate = monthlyNRate * growingMonths; // kg/ha/year
    }

    // =========================================================================
    // PACE-STYLE TISSUE CONCENTRATION RATIOS
    // These are the ratios of nutrient to N in plant tissue (% basis)
    // K = N × 0.55 means if tissue N is 4%, tissue K is ~2.2%
    // =========================================================================

    const tissueRatios = {
        // PACE Turf ratios (relative to N)
        K: 0.55, // K:N ratio in tissue (~2.2% K at 4% N)
        P: 0.1, // P:N ratio
        Ca: 0.125, // Ca:N ratio
        Mg: 0.0625, // Mg:N ratio
        S: 0.075, // S:N ratio
        Fe: 0.0025,
        Mn: 0.00125,
        Zn: 0.00075,
        Cu: 0.00025,
        B: 0.00025,
    };

    // Use species-specific ratios from GilbaNutrientDemandEngine if available
    // Cotula: no published tissue N ratios exist — PACE model does not apply.
    // Soil test interpretation (S78) is the authoritative guide for cotula nutrition.
    let speciesRatios = tissueRatios;
    if (isCotulaSurface) {
        // No cotula tissue ratio data — retain generic ratios as indicative only.
        // annualUptakeKgHa values will be flagged as 'not validated' in output.
        speciesRatios._cotulaCaveat = true;
    } else if (window.GilbaNutrientDemandEngine && species) {
        try {
            const speciesData = window.GilbaNutrientDemandEngine.getSpeciesTissueConcentrations(species, context);
            if (speciesData && speciesData.isSpeciesSpecific && speciesData.data) {
                // Convert absolute % to ratios relative to N
                const nConc = speciesData.data.N || 4;
                speciesRatios = {};
                for (const nut in speciesData.data) {
                    if (nut !== "N") {
                        speciesRatios[nut] = speciesData.data[nut] / nConc;
                    }
                }
            }
        } catch (e) {}
    }

    // =========================================================================
    // CALCULATE ANNUAL UPTAKE (N-linked, PACE-style)
    // Uptake = Annual N × tissue ratio
    // =========================================================================

    const growthWeighted = (growthPotential?.weighted ?? 50) / 100;
    const effectiveNRate = annualNRate * Math.max(0.15, growthWeighted); // GP-adjusted

    // Annual uptake in kg/ha (N-linked)
    const annualUptakeKgHa = {};
    for (const nut in speciesRatios) {
        annualUptakeKgHa[nut] = effectiveNRate * speciesRatios[nut];
    }
    // N itself
    annualUptakeKgHa.N = effectiveNRate;

    // Helper: Convert ppm to kg/ha
    function ppmToKgHa(ppm) {
        return ppm * rootzoneDepth * bulkDensity * 0.1;
    }

    // Helper: Convert kg/ha to ppm
    function kgHaToPpm(kgHa) {
        return kgHa / (rootzoneDepth * bulkDensity * 0.1);
    }

    // Annual uptake in ppm (for PACE "Soil ppm" column)
    const annualUptakePpm = {};
    for (const nut in annualUptakeKgHa) {
        annualUptakePpm[nut] = kgHaToPpm(annualUptakeKgHa[nut]);
    }

    // Build reference thresholds based on methodology
    let referenceThresholds;

    // Get Ammonium Acetate soil texture if using that methodology
    const aaSoilTexture =
        (state.soil && state.soil.aaSoilTexture) || document.querySelector(".gaip-aa-soil-texture")?.value || "others";

    if (methodology === "ammonium_acetate") {
        // =========================================================================
        // AMMONIUM ACETATE METHODOLOGY (Hill Labs NZ)
        // Extractants: Olsen P (NaHCO₃), NH₄OAc (pH 8.1) for cations
        // Data source: Hill Labs NZ standard turf interpretation ranges
        // =========================================================================

        // Ammonium Acetate ranges by soil texture (sands vs others for K, Mg)
        const aaRanges =
            aaSoilTexture === "sands" ?
            {
                // Olsen P - same for all soil types (mg/L, equivalent to ppm)
                P: {
                    lo: 12,
                    hi: 28
                },
                // NH₄OAc cations - sand-based rootzones
                K: {
                    lo: 75,
                    hi: 175
                },
                Ca: {
                    lo: 500,
                    hi: 750
                },
                Mg: {
                    lo: 100,
                    hi: 200
                },
                S: {
                    lo: 30,
                    hi: 60
                },
                // Micronutrients - DTPA extraction (standard ranges)
                Fe: {
                    lo: 40,
                    hi: 100
                },
                Mn: {
                    lo: 10,
                    hi: 50
                },
                Cu: {
                    lo: 0.5,
                    hi: 3
                },
                Zn: {
                    lo: 1,
                    hi: 5
                },
                B: {
                    lo: 0.4,
                    hi: 1.5
                },
            } :
            {
                // Olsen P - same for all soil types
                P: {
                    lo: 12,
                    hi: 28
                },
                // NH₄OAc cations - native/soil-based
                K: {
                    lo: 100,
                    hi: 235
                },
                Ca: {
                    lo: 500,
                    hi: 750
                },
                Mg: {
                    lo: 140,
                    hi: 250
                },
                S: {
                    lo: 30,
                    hi: 60
                },
                // Micronutrients - DTPA extraction
                Fe: {
                    lo: 40,
                    hi: 100
                },
                Mn: {
                    lo: 10,
                    hi: 50
                },
                Cu: {
                    lo: 0.5,
                    hi: 3
                },
                Zn: {
                    lo: 1,
                    hi: 5
                },
                B: {
                    lo: 0.4,
                    hi: 1.5
                },
            };

        referenceThresholds = {
            P: aaRanges.P.lo,
            K: aaRanges.K.lo,
            Ca: aaRanges.Ca.lo,
            Mg: aaRanges.Mg.lo,
            S: aaRanges.S.lo,
            Fe: aaRanges.Fe.lo,
            Mn: aaRanges.Mn.lo,
            Zn: aaRanges.Zn.lo,
            Cu: aaRanges.Cu.lo,
            B: aaRanges.B.lo,
            _ranges: aaRanges,
            _methodology: "Ammonium Acetate",
            _soilType: aaSoilTexture,
            _extractants: {
                P: "Olsen",
                cations: "NH₄OAc (pH 8.1)",
            },
            _dataSource: "Hill Labs NZ",
        };
    } else if (methodology === "slan") {
        // SLAN methodology - pH-adjusted Fe/Mn thresholds
        const phFactor = (Math.max(6, Math.min(8.5, soilPH)) - 6) / 2.5;

        const feMnRanges = {
            Fe: {
                lo: 80 + 30 * phFactor * 0.8,
                hi: 80 + 30 * phFactor * 1.2,
            },
            Mn: {
                lo: 27 + 10 * phFactor * 0.8,
                hi: 27 + 10 * phFactor * 1.2,
            },
        };

        // SLAN ranges by soil type
        const slanRanges =
            soilType === "sands" ?
            {
                P: {
                    lo: 12,
                    hi: 28
                },
                K: {
                    lo: 50,
                    hi: 116
                },
                Ca: {
                    lo: 500,
                    hi: 750
                },
                Mg: {
                    lo: 60,
                    hi: 120
                },
                S: {
                    lo: 15,
                    hi: 40
                },
                B: {
                    lo: 0.4,
                    hi: 1.5
                },
                Cu: {
                    lo: 0.6,
                    hi: 2
                },
                Zn: {
                    lo: 1.3,
                    hi: 3.5
                },
            } :
            {
                P: {
                    lo: 12,
                    hi: 28
                },
                K: {
                    lo: 75,
                    hi: 176
                },
                Ca: {
                    lo: 500,
                    hi: 750
                },
                Mg: {
                    lo: 70,
                    hi: 140
                },
                S: {
                    lo: 15,
                    hi: 40
                },
                B: {
                    lo: 0.4,
                    hi: 1.5
                },
                Cu: {
                    lo: 0.6,
                    hi: 2
                },
                Zn: {
                    lo: 1.3,
                    hi: 3.5
                },
            };

        referenceThresholds = {
            P: slanRanges.P.lo,
            K: slanRanges.K.lo,
            Ca: slanRanges.Ca.lo,
            Mg: slanRanges.Mg.lo,
            S: slanRanges.S.lo,
            Fe: feMnRanges.Fe.lo,
            Mn: feMnRanges.Mn.lo,
            Zn: slanRanges.Zn.lo,
            Cu: slanRanges.Cu.lo,
            B: slanRanges.B.lo,
            _ranges: {
                P: slanRanges.P,
                K: slanRanges.K,
                Ca: slanRanges.Ca,
                Mg: slanRanges.Mg,
                S: slanRanges.S,
                Fe: feMnRanges.Fe,
                Mn: feMnRanges.Mn,
                Zn: slanRanges.Zn,
                Cu: slanRanges.Cu,
                B: slanRanges.B,
            },
            _methodology: "SLAN",
            _soilType: soilType,
        };
    } else {
        // MLSN methodology - fixed thresholds with pH adjustment for P
        // b35fix301a: MLSN_THRESHOLDS sourced from gaip-classification-constants.js.
        //             Fallback literal retained for Node-test contexts.
        // NB: The inline pH-adjustment block below is NOT harmonised in 301a.
        //     It uses strict-inequality boundaries (soilPH < 5.5, soilPH > 7.5, ...)
        //     which differ at equality from the pH-adjust block in
        //     nutrition-summary-integration.js (which uses ph <= adj.maxPh).
        //     Harmonisation of pH-adjust semantics deferred to a later build.
        const _gcc_ht = (typeof window !== 'undefined' && window.GilbaClassificationConstants) ||
                        (typeof globalThis !== 'undefined' && globalThis.GilbaClassificationConstants) ||
                        null;
        const _mlsnBase = _gcc_ht ? _gcc_ht.MLSN_THRESHOLDS : {
            P: 21, K: 37, Ca: 331, Mg: 47, S: 7,
            Fe: 2, Mn: 1, Zn: 1, Cu: 0.3, B: 0.3
        };
        referenceThresholds = {
            P: _mlsnBase.P,
            K: _mlsnBase.K,
            Ca: _mlsnBase.Ca,
            Mg: _mlsnBase.Mg,
            S: _mlsnBase.S,
            Fe: _mlsnBase.Fe,
            Mn: _mlsnBase.Mn,
            Zn: _mlsnBase.Zn,
            Cu: _mlsnBase.Cu,
            B: _mlsnBase.B,
            _methodology: "MLSN",
        };

        // pH-based P threshold adjustment (inline, unchanged in 301a)
        if (soilPH) {
            if (soilPH < 5.5) referenceThresholds.P = 35;
            else if (soilPH < 6) referenceThresholds.P = 28;
            else if (soilPH > 8) referenceThresholds.P = 40;
            else if (soilPH > 7.5) referenceThresholds.P = 32;
        }
    }

    // =========================================================================
    // ANALYSE EACH NUTRIENT (PACE-style target calculation)
    // =========================================================================

    const nutrientResults = [];
    const nutrients = ["P", "K", "Ca", "Mg", "S", "Fe", "Mn", "Zn", "Cu", "B"];
    const hasNProgramme = annualNRate > 0;

    nutrients.forEach((nutrient) => {
        const actualPPM = safeNum(soilPPM[nutrient], 0);
        const mlsnThreshold = referenceThresholds[nutrient] || 0;
        const isSLAN = referenceThresholds._methodology === "SLAN";
        const ranges = referenceThresholds._ranges;

        let status, statusClass, recommendation;

        // No threshold data
        if (!mlsnThreshold) {
            nutrientResults.push({
                nutrient: nutrient,
                actual: actualPPM.toFixed(1),
                mlsn: "N/A",
                uptakePpm: 0,
                targetPpm: 0,
                status: "NO DATA",
                statusClass: "no-data",
                recommendation: "No reference value",
                deficitPpm: 0,
                deficitKgHa: 0,
            });
            return;
        }

        // SLAN range-based assessment (unchanged)
        if (isSLAN && ranges && ranges[nutrient]) {
            const range = ranges[nutrient];
            // Format range values to 1 decimal place to avoid floating point display errors
            const rangeStr = `${Number(range.lo).toFixed(1)}-${Number(range.hi).toFixed(1)}`;

            if (actualPPM < range.lo) {
                status = "LOW";
                statusClass = "deficient";
                const deficit = range.lo - actualPPM;
                recommendation = `Below sufficiency range. Apply to increase by ~${deficit.toFixed(0)} ppm`;
            } else if (actualPPM <= range.hi) {
                status = "SUFFICIENT";
                statusClass = "adequate";
                recommendation = "Within target range - maintain current program";
            } else {
                status = "HIGH";
                statusClass = "high";
                const excess = actualPPM - range.hi;
                recommendation = `${excess.toFixed(0)} ppm above range. Reduce/omit applications`;
            }

            nutrientResults.push({
                nutrient: nutrient,
                actual: actualPPM.toFixed(1),
                mlsn: rangeStr,
                uptakePpm: annualUptakePpm[nutrient]?.toFixed(1) || "—",
                targetPpm: range.lo, // For SLAN, target is the low end of range
                status: status,
                statusClass: statusClass,
                recommendation: recommendation,
                deficitPpm: Math.max(0, range.lo - actualPPM),
                deficitKgHa: Math.max(0, ppmToKgHa(range.lo - actualPPM)),
            });
            return;
        }

        // =========================================================================
        // MLSN PACE-STYLE ASSESSMENT
        // Target = MLSN + Annual Uptake (instead of MLSN × 1.5)
        // =========================================================================

        const uptakePpm = annualUptakePpm[nutrient] || 0;

        // PACE formula: Target = MLSN minimum + Annual uptake
        // This is the "Plus MLSN ppm" column in PACE spreadsheet
        const targetPpm = hasNProgramme ?
            mlsnThreshold + uptakePpm // PACE-style when N programme entered
            :
            mlsnThreshold * 1.5; // Fallback to 1.5× when no N data

        const actualKgHa = ppmToKgHa(actualPPM);
        const targetKgHa = ppmToKgHa(targetPpm);
        const deficitPpm = Math.max(0, targetPpm - actualPPM);
        const deficitKgHa = Math.max(0, targetKgHa - actualKgHa);
        const surplusPpm = Math.max(0, actualPPM - targetPpm);
        const surplusKgHa = Math.max(0, actualKgHa - targetKgHa);

        // Ratio against MLSN minimum (for status classification)
        const ratioVsMLSN = actualPPM / mlsnThreshold;
        // Ratio against target (for recommendation)
        const ratioVsTarget = actualPPM / targetPpm;

        if (ratioVsMLSN < 0.8) {
            // Below MLSN minimum - critical
            status = "DEFICIENT";
            statusClass = "deficient";
            recommendation = `Apply ${deficitKgHa.toFixed(1)} kg/ha (${deficitPpm.toFixed(0)} ppm) immediately to reach target`;
        } else if (ratioVsTarget < 0.85) {
            // Above MLSN but below target - needs topping up
            status = "BORDERLINE";
            statusClass = "borderline";
            recommendation = `Apply ${deficitKgHa.toFixed(1)} kg/ha (${deficitPpm.toFixed(0)} ppm) to build reserve for season`;
        } else if (ratioVsTarget <= 1.5) {
            // At or above target - adequate
            status = "ADEQUATE";
            statusClass = "adequate";
            if (hasNProgramme && uptakePpm > 0) {
                const yearsSupply = surplusPpm / uptakePpm;
                recommendation =
                    yearsSupply > 0.5 ?
                    `${yearsSupply.toFixed(1)} years above target at current N rate` :
                    "At target - maintain routine fertilisation";
            } else {
                recommendation = "Adequate – maintain current program";
            }
        } else {
            // Well above target - high
            status = "HIGH";
            statusClass = "high";
            if (hasNProgramme && uptakePpm > 0) {
                const yearsSupply = surplusPpm / uptakePpm;
                recommendation =
                    yearsSupply > 2 ?
                    `>${yearsSupply.toFixed(0)} years supply. Reduce inputs to avoid imbalance.` :
                    `~${yearsSupply.toFixed(1)} years supply. Monitor balance.`;
            } else {
                recommendation = "High – reduce applications, monitor ratios";
            }
        }

        nutrientResults.push({
            nutrient: nutrient,
            actual: actualPPM.toFixed(1),
            mlsn: mlsnThreshold,
            uptakePpm: uptakePpm.toFixed(1),
            targetPpm: targetPpm.toFixed(1),
            status: status,
            statusClass: statusClass,
            recommendation: recommendation,
            deficitPpm: deficitPpm,
            deficitKgHa: deficitKgHa,
        });
    });

    // =========================================================================
    // BUILD HTML OUTPUT
    // =========================================================================

    // Methodology label for table header
    let methodologyLabel;
    const methodName = referenceThresholds._methodology || "MLSN";
    if (methodName === "SLAN") {
        methodologyLabel = "Range (ppm)";
    } else if (methodName === "Ammonium Acetate") {
        methodologyLabel = "Range (mg/L)";
    } else {
        methodologyLabel = "MLSN (ppm)";
    }

    // N Programme Context Panel (NEW - only show if N rate entered)
    let nProgrammeHTML = "";
    if (hasNProgramme) {
        // Estimate clipping yield (simplified - use GilbaNutrientDemandEngine if available)
        let clippingYield = effectiveNRate * 25; // Default: 25g clippings per g N
        if (window.GilbaNutrientDemandEngine) {
            try {
                const yieldData = window.GilbaNutrientDemandEngine.estimateClippingYieldFromN(
                    effectiveNRate / 10, // Convert to g/m²
                    {
                        species: species,
                        context: context,
                        detailed: true
                    },
                );
                if (yieldData && yieldData.clippingYieldKgHa) {
                    clippingYield = yieldData.clippingYieldKgHa;
                }
            } catch (e) {}
        }

        nProgrammeHTML = `
      <div style="background: var(--gaip-info-bg); border: 1px solid var(--gaip-info-bg); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af; margin-bottom: 8px;">
          N Programme Context (PACE-style)
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
          <div style="background: var(--gaip-surface); padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-family: monospace; font-size: 18px; font-weight: 600; color: #2563eb;">${annualNRate.toFixed(0)}</div>
            <div style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">kg N/ha/year</div>
          </div>
          <div style="background: var(--gaip-surface); padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-family: monospace; font-size: 18px; font-weight: 600; color: #2563eb;">${(growthWeighted * 100).toFixed(0)}%</div>
            <div style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">Weighted GP</div>
          </div>
          <div style="background: var(--gaip-surface); padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-family: monospace; font-size: 18px; font-weight: 600; color: #2563eb;">${clippingYield.toFixed(0)}</div>
            <div style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">kg clippings/ha/yr</div>
          </div>
        </div>
        <div style="margin-top: 10px; padding: 8px; background: var(--gaip-info-bg); border-radius: 4px;">
          <div style="font-family: monospace; font-size: 12px; font-weight: 600; color: #1e3a8a;">
            Target = MLSN + Annual Uptake
          </div>
          <div style="font-size: 11px; color: #3b82f6; margin-top: 2px;">
            Uptake linked to N rate via tissue concentration ratios (PACE Turf methodology)
          </div>
        </div>
      </div>
    `;
    }

    const muldersInteractionSummaryHTML = "";

    // Build PACE-style nutrient table with uptake column
    const nutrientTableHTML = hasNProgramme ?
        `
    <table class="gaip-mlsn-table">
        <thead>
            <tr>
                <th>Nutrient</th>
                <th>Soil (ppm)</th>
                <th>${methodologyLabel}</th>
                <th>Uptake</th>
                <th>Target</th>
                <th>Status</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            ${nutrientResults
              .map(
                (r) => `
            <tr class="status-${r.statusClass}">
                <td><strong>${r.nutrient}</strong></td>
                <td>${r.actual}</td>
                <td>${r.mlsn}</td>
                <td style="color: var(--gaip-text-muted, var(--gaip-text-secondary)); font-size: 11px;">${r.uptakePpm}</td>
                <td><strong>${r.targetPpm}</strong></td>
                <td><span class="status-badge ${r.statusClass}">${r.status}</span></td>
                <td style="font-size: 11px;">${r.deficitKgHa > 0 ? r.deficitKgHa.toFixed(1) + " kg/ha" : "—"}</td>
            </tr>
            `,
              )
              .join("")}
        </tbody>
    </table>
    ` :
        `
    <table class="gaip-mlsn-table">
        <thead>
            <tr>
                <th>Nutrient</th>
                <th>Actual (ppm)</th>
                <th>${methodologyLabel}</th>
                <th>Status</th>
                <th>Recommendation</th>
            </tr>
        </thead>
        <tbody>
            ${nutrientResults
              .map(
                (r) => `
            <tr class="status-${r.statusClass}">
                <td><strong>${r.nutrient}</strong></td>
                <td>${r.actual}</td>
                <td>${r.mlsn}</td>
                <td><span class="status-badge ${r.statusClass}">${r.status}</span></td>
                <td>${r.recommendation}</td>
            </tr>
            `,
              )
              .join("")}
        </tbody>
    </table>
    `;

    // Deficit summary panel (NEW - show fertiliser required)
    let deficitSummaryHTML = "";
    const deficits = nutrientResults.filter((r) => r.deficitKgHa > 1);
    if (hasNProgramme && deficits.length > 0) {
        deficitSummaryHTML = `
      <div style="background: var(--gaip-warning-bg); border: 1px solid var(--gaip-warning-border); border-left: 4px solid #d97706; border-radius: 8px; padding: 12px; margin-top: 12px;">
        <div style="font-weight: 600; color: #92400e; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>⚠️</span> Fertiliser Required to Reach Target
        </div>
        <div style="display: grid; gap: 6px;">
          ${deficits
            .map(
              (d) => `
            <div style="background: var(--gaip-surface); border-radius: 6px; padding: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-weight: 600;">${d.nutrient}</span>
                <span style="font-size: 12px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-left: 8px;">${d.deficitPpm.toFixed(0)} ppm deficit</span>
              </div>
              <div style="font-family: monospace; font-size: 14px; color: #d97706; font-weight: 600;">
                ${d.deficitKgHa.toFixed(1)} kg/ha
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
    }

    // Calculate cation ratios (unchanged)
    const calciumPPM = safeNum(soilPPM.Ca, 0);
    const magnesiumPPM = safeNum(soilPPM.Mg, 0);
    const potassiumPPM = safeNum(soilPPM.K, 0);

    const caMgRatio = magnesiumPPM > 0 ? calciumPPM / magnesiumPPM : 0;
    const kMgRatio = magnesiumPPM > 0 ? potassiumPPM / magnesiumPPM : 0;
    const kCaRatio = calciumPPM > 0 ? potassiumPPM / calciumPPM : 0;

    const ratioNotes = [];

    if (calciumPPM > 0 && magnesiumPPM > 0) {
        const caMgInterpretation =
            caMgRatio < 2 ?
            "Tight surface, higher compaction/softness risk." :
            caMgRatio <= 6 ?
            "Balanced for shear strength and stability." :
            "High Ca:Mg – firmer but monitor Mg deficiency.";
        ratioNotes.push(`<strong>Ca:Mg ratio</strong> ≈ ${caMgRatio.toFixed(1)} – ${caMgInterpretation}`);
    }

    if (potassiumPPM > 0 && magnesiumPPM > 0) {
        const kMgInterpretation =
            kMgRatio < 0.1 ?
            "Insufficient K for divot resistance and recovery." :
            kMgRatio <= 0.3 ?
            "Balanced for wear and recovery." :
            "High K:Mg – Mg antagonism, softness risk.";
        ratioNotes.push(`<strong>K:Mg ratio</strong> ≈ ${kMgRatio.toFixed(2)} – ${kMgInterpretation}`);
    }

    if (potassiumPPM > 0 && calciumPPM > 0) {
        const kCaInterpretation =
            kCaRatio < 0.03 ?
            "Very Ca-dominant – firm but slower recovery." :
            kCaRatio <= 0.1 ?
            "Balanced for stability + recovery." :
            "High K:Ca – softer leaf, higher softness risk.";
        ratioNotes.push(`<strong>K:Ca ratio</strong> ≈ ${kCaRatio.toFixed(3)} – ${kCaInterpretation}`);
    }

    // Traffic/divot support assessment (unchanged)
    const cationsAboveThreshold =
        (safeNum(soilPPM.K, 0) >= referenceThresholds.K ? 1 : 0) +
        (safeNum(soilPPM.Ca, 0) >= referenceThresholds.Ca ? 1 : 0) +
        (safeNum(soilPPM.Mg, 0) >= referenceThresholds.Mg ? 1 : 0);

    const divotSupport =
        cationsAboveThreshold === 3 ?
        "Good divot resistance and recovery." :
        cationsAboveThreshold === 2 ?
        "Partial support – one key cation is marginal." :
        "Weak support – expect divoting under load.";

    // Overseed establishment risk (unchanged)
    const pAboveThreshold = safeNum(soilPPM.P, 0) >= referenceThresholds.P;
    const kAboveThreshold = safeNum(soilPPM.K, 0) >= referenceThresholds.K;

    const establishmentRisk =
        pAboveThreshold && kAboveThreshold ?
        "Low – establishment stable under match load." :
        pAboveThreshold || kAboveThreshold ?
        "Moderate – seedling survival stressed under traffic." :
        "High – correct P and K before renovation.";

    // Build rootzone summary (unchanged)
    const rootzoneSummary =
        `<strong>Rootzone depth:</strong> ${rootzoneDepth.toFixed(1)} cm; ` +
        `<strong>Bulk density:</strong> ${bulkDensity.toFixed(2)} g/cm³; ` +
        `<strong>Turf demand basis:</strong> ${grassType === "warm-season" ? "Warm-season grass" : "Cool-season grass"}`;

    // Build growth conditions panel (unchanged, with defensive guards)
    // Fallback to climateMetrics when growthPotential is not available
    var _cm = window.climateMetrics;
    const displayTemp = avgTemperature ?? _cm?.temperature?.mean ?? 20;
    // v10.9.9: null means "not applicable for this stand" — hide it, don't show 0%
    const rawC3 = growthPotential?.c3potential ?? _cm?.growth?.c3;
    const rawC4 = growthPotential?.c4potential ?? _cm?.growth?.c4;
    const displayC3 = rawC3 != null ? rawC3 : 50;
    const displayC4 = rawC4 != null ? rawC4 : 50;
    const showC3 = rawC3 != null;
    const showC4 = rawC4 != null;
    const displayWeighted = growthPotential?.weighted ?? _cm?.growth?.weighted ?? 50;
    const displayStatus = growthPotential?.status ?? _cm?.growth?.status ?? "Unknown";

    const growthDemandNote =
        displayWeighted < 30 ?
        "Minimal uptake during dormancy/stress - reduce applications." :
        displayWeighted < 60 ?
        "Moderate uptake - apply conservative rates." :
        "Active growth - full nutrient demand.";

    const growthConditionsHTML = `
        <div style="margin: 10px 0; padding: 8px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px;">
            <strong>Current Growth Conditions:</strong><br>
            <span style="font-size: 12px;">
                Temperature: ${displayTemp.toFixed(1)}°C | 
                ${showC3 ? "C3 Growth: " + displayC3.toFixed(0) + "%" : ""}${showC3 && showC4 ? " | " : ""}${showC4 ? "C4 Growth: " + displayC4.toFixed(0) + "%" : ""}${showC3 || showC4 ? " | " : ""}System: ${displayStatus}
            </span><br>
            <span style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">
                Nutrient demand adjusted by ${displayWeighted.toFixed(0)}% based on current growth potential. 
                ${growthDemandNote}
            </span>
        </div>
    `;

    // pH impact assessment (unchanged)
    let phImpactHTML = "";
    const phAssessment = assessPHImpact(state.soil.pH_water || state.soil.pH_cacl2);

    if (phAssessment) {
        const phBgColor =
            phAssessment.status === "Optimal" ?
            "var(--gaip-good-bg)" :
            phAssessment.status === "Acidic" || phAssessment.status === "Slightly Alkaline" ?
            "var(--gaip-warning-bg)" :
            "var(--gaip-critical-bg)";
        const phBorderColor =
            phAssessment.status === "Optimal" ?
            "#10b981" :
            phAssessment.status === "Acidic" || phAssessment.status === "Slightly Alkaline" ?
            "#f59e0b" :
            "#ef4444";

        phImpactHTML = `
        <div style="margin: 10px 0; padding: 10px; background: ${phBgColor}; border-left: 3px solid ${phBorderColor}; border-radius: 4px;">
            <strong>pH Impact on Nutrient Availability:</strong><br>
            <strong>pH: ${phAssessment.pH.toFixed(1)}</strong> - ${phAssessment.status}<br>
            <span style="font-size: 12px;">${phAssessment.issues}</span><br>
            <strong style="font-size: 11px;">Recommendation:</strong> 
            <span style="font-size: 11px;">${phAssessment.recommendations}</span>
        </div>
        `;

        // pH-specific fertiliser recommendations
        const fertRecs = generatePHFertiliserRecommendations(
            phAssessment.pH,
            state.soil.CEC,
            state.soil.bulkDensity,
            state.soil.Na_ppm,
        );

        if (fertRecs) {
            phImpactHTML += `
            <div style="margin: 10px 0; padding: 10px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px;">
                <strong>pH-Specific Fertiliser Selection:</strong><br>
                <span style="font-size: 11px;">
                    ${fertRecs.nForm}<br>
                    ${fertRecs.feChelate}
                    ${fertRecs.acidification || ""}
                </span>
            </div>
            `;
            if (fertRecs.sodiumWarning) {
                phImpactHTML += fertRecs.sodiumWarning;
            }
        }

        // pH-water interaction
        const waterInteraction = assessPHWaterInteraction(
            phAssessment.pH,
            safeNum(state.water?.ions?.Ca, 0),
            safeNum(state.water?.ions?.HCO3, 0),
            state.water?.pH,
        );

        if (waterInteraction) {
            phImpactHTML += waterInteraction;
        }

        // v9.9.6: Species-specific pH tolerance assessment
        const speciesPHAssessment = assessSpeciesPHTolerance(phAssessment.pH, species);

        if (speciesPHAssessment && speciesPHAssessment.status !== "optimal") {
            // Determine alert styling based on severity
            let alertBg, alertBorder, alertIcon;
            if (speciesPHAssessment.severity === "high") {
                alertBg = "var(--gaip-critical-bg)";
                alertBorder = "#ef4444";
                alertIcon = "⚠️";
            } else if (speciesPHAssessment.severity === "moderate") {
                alertBg = "var(--gaip-warning-bg)";
                alertBorder = "#f59e0b";
                alertIcon = "⚠️";
            } else {
                alertBg = "var(--gaip-info-bg)";
                alertBorder = "#3b82f6";
                alertIcon = "ℹ️";
            }

            phImpactHTML += `
        <div style="margin: 10px 0; padding: 10px; background: ${alertBg}; border-left: 3px solid ${alertBorder}; border-radius: 4px;">
            <strong>${alertIcon} Species pH Tolerance:</strong><br>
            <span style="font-size: 12px;">${speciesPHAssessment.message}</span><br>
            ${speciesPHAssessment.recommendation ? `<span style="font-size: 11px;"><strong>Species-specific advice:</strong> ${speciesPHAssessment.recommendation}</span><br>` : ""}
            <span style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: 4px; display: block;">
                Optimal: pH ${speciesPHAssessment.optimalRange[0].toFixed(1)}–${speciesPHAssessment.optimalRange[1].toFixed(1)} | 
                Tolerance: pH ${speciesPHAssessment.toleranceRange[0].toFixed(1)}–${speciesPHAssessment.toleranceRange[1].toFixed(1)}
                ${speciesPHAssessment.acidTolerant ? " | Acid-tolerant ✓" : ""}
                ${speciesPHAssessment.alkalineTolerant ? " | Alkaline-tolerant ✓" : ""}
            </span>
        </div>
      `;
        } else if (speciesPHAssessment && speciesPHAssessment.status === "optimal") {
            // Show positive confirmation when pH is optimal for species
            phImpactHTML += `
        <div style="margin: 10px 0; padding: 8px; background: var(--gaip-good-bg); border-left: 3px solid #10b981; border-radius: 4px;">
            <span style="font-size: 11px;">✓ <strong>${speciesPHAssessment.species}</strong> — pH ${phAssessment.pH.toFixed(1)} is within optimal range (${speciesPHAssessment.optimalRange[0].toFixed(1)}–${speciesPHAssessment.optimalRange[1].toFixed(1)})</span>
        </div>
      `;
        }
    }

    // Citation footer (NEW)
    const citationHTML = hasNProgramme ?
        `
    <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--gaip-border); font-size: 10px; ">
      Methodology: PACE Turf Climate Appraisal; Kussow et al. (2012) ISRN Agronomy; Woods/ATC ClipVol
    </div>
  ` :
        "";

    // Assemble final output
    return (
        rootzoneSummary +
        "<br><br>" +
        growthConditionsHTML +
        muldersInteractionSummaryHTML + // Mulder's interaction flags above nutrient table
        nProgrammeHTML +
        phImpactHTML +
        generateSoilQualityHTML(state) +
        "<strong>" +
        (methodology === "ammonium_acetate" ? "Ammonium Acetate" : methodology === "slan" ? "SLAN" : "MLSN") +
        " sufficiency by nutrient</strong><br>" +
        `<p class='gaip-note' style='margin-top:4px;'>` +
        (hasNProgramme ?
            `Target = ${methodology === "ammonium_acetate" ? "AA threshold" : "MLSN"} + Annual Uptake (linked to ${annualNRate.toFixed(0)} kg N/ha/yr). Deficit shows fertiliser to reach target.` :
            `Recommendations based on ${grassType} turf demand. Enter monthly N rate for PACE-style N-linked targets.`) +
        `</p>` +
        nutrientTableHTML +
        deficitSummaryHTML + // NEW: Deficit summary
        "<br><strong>Key nutrient ratios</strong><br>" +
        (ratioNotes.length ? ratioNotes.join("<br>") : "Insufficient data.") +
        "<br><br><strong>Traffic/divot support:</strong> " +
        divotSupport +
        "<br><strong>Overseed establishment risk:</strong> " +
        establishmentRisk +
        citationHTML // NEW: Citation
    );
}

function generateSoilQualityHTML(e) {
    var t = "",
        r = assessSoilSodium(e.soil.Na_ppm, e.soil.CEC);
    r &&
        (t += `\n        <div style="margin: 10px 0; padding: 10px; background: ${"Normal" === r.status ? "var(--gaip-good-bg)" : "Slightly Elevated" === r.status ? "var(--gaip-warning-bg)" : "var(--gaip-critical-bg)"}; border-left: 3px solid ${"Normal" === r.status ? "#10b981" : "Slightly Elevated" === r.status ? "#f59e0b" : "#ef4444"}; border-radius: 4px;">\n            <strong>Soil Sodium (Mehlich-3):</strong> ${r.Na_ppm.toFixed(0)} ppm${r.ESP !== null ? " &nbsp;|&nbsp; <strong>Estimated ESP:</strong> " + r.ESP + "%" : ""}<br>\n            <strong>Status:</strong> ${r.status}<br>\n            <span style="font-size: 12px;">${r.assessment}</span><br>\n            <strong style="font-size: 11px;">Recommendations:</strong> \n            <span style="font-size: 11px;">${r.recommendations}</span><br>\n            <em style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); display: block; margin-top: 5px;">${r.note}</em>\n        </div>\n        `);
    var n = analyseLOIStratification(e.soil.LOI_0_2, e.soil.LOI_2_4, e.soil.LOI_4_6, e.soil.LOI);
    n &&
        (t += `\n        <div style="margin: 10px 0; padding: 10px; background: ${"Optimal OM" === n.status ? "var(--gaip-good-bg)" : "Low OM" === n.status || "Elevated OM" === n.status ? "var(--gaip-warning-bg)" : "var(--gaip-critical-bg)"}; border-left: 3px solid ${"Optimal OM" === n.status ? "#10b981" : "Low OM" === n.status || "Elevated OM" === n.status ? "#f59e0b" : "#ef4444"}; border-radius: 4px;">\n            <strong>Organic Matter (LOI 440°C):</strong> ${n.status}<br>\n            <span style="font-size: 12px;">${n.analysis}</span><br>\n            <strong style="font-size: 11px;">Recommendations:</strong> \n            <span style="font-size: 11px;">${n.recommendations}</span>\n            <span style="font-size: 11px;">${n.maintenanceProgram || ""}</span>\n        </div>\n        `);
    var i = assessCEC(e.soil.CEC);
    i &&
        (t += `\n        <div style="margin: 10px 0; padding: 10px; background: ${"Moderate" === i.status || "Moderate-High" === i.status ? "var(--gaip-good-bg)" : "Low" === i.status || "Very Low" === i.status ? "var(--gaip-warning-bg)" : "var(--gaip-info-bg)"}; border-left: 3px solid ${"Moderate" === i.status || "Moderate-High" === i.status ? "#10b981" : "Low" === i.status || "Very Low" === i.status ? "#f59e0b" : "#3b82f6"}; border-radius: 4px;">\n            <strong>Cation Exchange Capacity (CEC):</strong> ${i.status}<br>\n            <span style="font-size: 12px;">${i.analysis}</span><br>\n            <strong style="font-size: 11px;">Fertilisation Strategy:</strong> \n            <span style="font-size: 11px;">${i.recommendations}</span>\n        </div>\n        `);
    return t;
}

function waterEngine(e) {
    var t = (e.water && e.water.ions) || {},
        r = safeNum(e.water.ecw, 0),
        n = safeNum(e.water.pH, 7);

    function i(e, t) {
        return (e = safeNum(e, 0)) / t;
    }
    var a,
        o,
        s = i(t.Ca, 20.04),
        l = i(t.Mg, 12.15),
        d = i(t.Na, 23),
        c = i(t.K, 39.1),
        p = (i(t.Cl, 35.45), i(t.SO4, 48), i(t.HCO3, 61)),
        g = i(t.CO3, 30),
        u = safeNum(t.B, 0),
        m = safeNum(t.Fe, 0),
        f = s + l > 0 ? d / Math.sqrt((s + l) / 2) : 0;
    if (s + l > 0 && p + g > 0) {
        var y = s + l,
            h = p + g;
        if (h > y) {
            var v = Math.max(0.5, y - 0.5 * (h - y));
            a = d / Math.sqrt(v / 2);
        } else a = f;
        var b = a / f;
        o =
            b > 1.3 ?
            `<strong>CRITICAL:</strong> High bicarbonate/carbonate will precipitate Ca/Mg during irrigation, increasing effective sodium hazard by ${(100 * (b - 1)).toFixed(0)}%. Use SARadj for management decisions.` :
            b > 1.1 ?
            `Moderate bicarbonate effect - some Ca/Mg precipitation expected. SARadj is ${(100 * (b - 1)).toFixed(0)}% higher than basic SAR.` :
            "Low bicarbonate levels - minimal Ca/Mg precipitation. SAR and SARadj are similar.";
    } else((a = f), (o = "Insufficient data for SARadj calculation."));
    var x,
        w,
        S,
        C,
        M = (100 * d) / (s + l + d + c) || 0,
        I = p + g - (s + l),
        k = s + l > 0 ? (d / (d + s + l)) * 100 : 0,
        A =
        r < 0.7 ?
        "Low salinity risk" :
        r < 1.5 ?
        "Medium salinity risk" :
        r < 3 ?
        "High – monitor turf response" :
        "Very high – specialised management needed",
        E =
        a < 3 ?
        "Low sodium hazard" :
        a < 6 ?
        "Medium sodium hazard" :
        a < 9 ?
        "High – infiltration decline likely" :
        "Very high – severe infiltration risk",
        N =
        a < 3 ?
        "Safe" :
        a < 6 ?
        "Marginal" :
        a < 9 ?
        "Unsuitable (high sodicity risk)" :
        "Unsuitable (severe sodicity risk)",
        T =
        I < 0 ?
        "No carbonate hazard" :
        I < 1.25 ?
        "Moderate carbonate hazard" :
        I < 2.5 ?
        "High carbonate hazard" :
        "Severe carbonate hazard",
        P = safeNum(t.Na, 0) < 70 ? "Safe" : safeNum(t.Na, 0) < 150 ? "Caution" : "High risk",
        R = safeNum(t.Cl, 0) < 100 ? "Safe" : safeNum(t.Cl, 0) < 350 ? "Caution" : "High risk",
        $ = u < 0.5 ? "Safe" : u < 2 ? "Caution – sensitive turf impacted" : "High – toxicity likely";
    m < 0.3 ?
        ((x = "Safe"),
            (w = "Iron levels are acceptable for irrigation."),
            (S = "No staining risk"),
            (C = "No action required.")) :
        m < 1 ?
        ((x = "Caution"),
            (w = "Moderate iron levels – may cause staining on hard surfaces and equipment."),
            (S = "Low to moderate staining risk"),
            (C = "Monitor equipment and surfaces. Consider in-line filtration if staining occurs.")) :
        m < 2 ?
        ((x = "High"),
            (w =
                "Elevated iron – expect staining on turf, concrete, and equipment. May precipitate in irrigation lines."),
            (S = "High staining risk"),
            (C =
                "Install iron filtration system. Avoid foliar irrigation during hot periods. Regular line flushing required.")) :
        ((x = "Very High"),
            (w =
                "Excessive iron – severe staining likely. Iron precipitation will clog emitters and cause orange/brown deposits on turf."),
            (S = "Severe staining risk"),
            (C =
                "CRITICAL: Mandatory filtration/treatment system. Avoid this water for fine turf irrigation if possible. Acidification may worsen precipitation."));
    var F,
        _ = "";
    m > 0.3 && n > 7.5 ?
        (_ =
            "<br><strong>pH-Iron interaction:</strong> High pH accelerates iron oxidation and precipitation, worsening staining and clogging. Consider acidification to pH 6.5-7.0.") :
        m > 0.3 &&
        n < 6.5 &&
        (_ =
            "<br><strong>pH-Iron interaction:</strong> Low pH keeps iron soluble, reducing precipitation but increasing mobility. May cause phytotoxicity in sensitive grasses.");
    var D = a * r;
    F =
        D < 6 ?
        "No infiltration restriction expected." :
        D < 12 ?
        "Mild infiltration decline possible." :
        D < 20 ?
        "Moderate infiltration reduction – monitor soil structure." :
        "Severe infiltration reduction likely – gypsum required.";
    var G =
        safeNum(t.Cl, 0) > 350 || safeNum(t.Na, 0) > 150 ?
        "High – foliar scorch possible in hot, dry periods." :
        "Normal – no immediate scorch risk.",
        L =
        r < 1 ?
        "LF ~0.10–0.15 (10-15% extra irrigation beyond ET)" :
        r < 2 ?
        "LF ~0.15–0.20 (15-20% extra irrigation beyond ET)" :
        r < 3 ?
        "LF ~0.20–0.25 (20-25% extra irrigation beyond ET)" :
        "LF ≥0.25 (≥25% extra irrigation beyond ET)",
        O = safeNum(t.Ca, 0),
        z = safeNum(t.HCO3, 0),
        H = safeNum(t.CO3, 0),
        q = safeNum(n, 7),
        W = 640 * r,
        U = 0,
        B = 7,
        j = "Balanced",
        V = "";
    if (O > 0 && z + H > 0) {
        var K = 2.497 * O,
            Y = 0.82 * z + 1.67 * H;
        if (K > 0 && Y > 0)
            (U =
                q - (B = 9.3 + (Math.log10(Math.max(W, 100)) - 1) / 10 + (u = 0.6) - (Math.log10(K) - 0.4 + Math.log10(Y)))) >
            0.5 ?
            ((j = "SCALE-FORMING"),
                (V =
                    "Water will <strong>DEPOSIT calcium carbonate scale</strong>. Emitter clogging likely. White deposits on surfaces. Acidification recommended to reduce pH below saturation point.")) :
            U > 0 ?
            ((j = "Slightly scaling"),
                (V =
                    "Water may deposit some scale at evaporation points. Monitor emitters and consider periodic acidification.")) :
            U > -0.5 ?
            ((j = "Balanced"), (V = "Water is near equilibrium - minimal scaling or corrosion expected.")) :
            U > -1 ?
            ((j = "Slightly corrosive"),
                (V = "Water may slowly dissolve calcium carbonate from soil. Monitor soil calcium levels.")) :
            ((j = "CORROSIVE (Stripping)"),
                (V =
                    "Water will <strong>STRIP calcium from soil</strong> and dissolve existing calcium carbonate. Supplement with gypsum or calcium chloride to protect soil structure."));
    }
    var Z = [];
    ((a >= 6 || M >= 40 || k >= 15) && Z.push("Apply gypsum / Ca-source to offset Na accumulation."),
        I >= 1.25 && Z.push("Acidify irrigation water to neutralise bicarbonates."),
        r >= 2 && Z.push("Increase leaching fraction and irrigation frequency."),
        Z.length || Z.push("No immediate treatment required."));
    var J =
        r < 1 && a < 3 ?
        "Suitable for all turf." :
        r < 2 && a < 6 ?
        "Suitable with monitoring." :
        r < 3 && a < 9 ?
        "High-management turf only." :
        "Unsuitable without significant amendments.";
    return `\n<strong>Salinity class:</strong> ${A}<br>\n<strong>Sodium hazard (SAR):</strong> ${f.toFixed(2)} – ${E}<br>\n<strong>Adjusted SAR (SARadj):</strong> ${a.toFixed(2)} – ${N}<br>\n<span style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">${o}</span><br>\n<strong>ESP estimate:</strong> ${k.toFixed(1)}%<br>\n<strong>Na%:</strong> ${M.toFixed(1)}%<br>\n<strong>RSC:</strong> ${I.toFixed(2)} – ${T}<br><br>\n\n<strong>Toxicity risk:</strong><br>\nNa: ${P}<br>\nCl: ${R}<br>\nB: ${$}<br>\nFe: ${x} (${m.toFixed(2)} mg/L)<br><br>\n\n<strong>Iron assessment:</strong><br>\n${w}<br>\n<strong>Staining risk:</strong> ${S}<br>\n<strong>Management:</strong> ${C}${_}<br><br>\n\n<strong>Infiltration warning:</strong> ${F}<br>\n<strong>Leaf scorch risk:</strong> ${G}<br>\n<strong>Recommended leaching fraction:</strong> ${L}<br>\n<span style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));"><em>Leaching Fraction (LF) = % of applied irrigation water that drains below the rootzone to flush accumulated salts.</em></span><br><br>\n\n<strong>Calcium Carbonate Precipitation:</strong><br>\n<strong>Langelier Saturation Index (LSI):</strong> ${U.toFixed(2)} – ${j}<br>\n<span style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">pHs (saturation pH): ${B.toFixed(2)} | Actual pH: ${q.toFixed(1)}</span><br>\n<span style="font-size: 12px;">${V}</span><br><br>\n\n<strong>Treatment actions:</strong><br>\n${Z.join("<br>")}<br><br>\n\n<strong>Irrigation suitability:</strong> ${J}\n`;
}

function gaip_firmness_engine(e, t) {
    var r = e.soil.bulkDensity || 1.4,
        n = safeNum(e.water.ecw, 0),
        i = safeNum(e.turf.nProgramKgHaYr, 0),
        a = e.turf.warmBase || "",
        o = e.turf.coolOverseed || "",
        s = e.soil?.surfaceType || "",
        l = e.turf?.grassSpecies || "",
        d = "greens" === s || l.toLowerCase().includes("greens") || l.toLowerCase().includes("putting"),
        c = calculateC3C4Fractions(e.turf),
        p = (c.c3frac, c.c4frac, 0);
    if (t && t.hourly && t.hourly.precipitation)
        for (var g = t.hourly.precipitation, u = g.length - 48; u < g.length; u++) u >= 0 && (p += g[u]);
    else p = safeNum(e.climate.manual.rain, 0);
    var m,
        f,
        y,
        h = safeNum(e.turf.cleggHammer, 0),
        v = h > 0,
        b = (e.turf.construction || "").toLowerCase(),
        x = (e.turf.drainage || "").toLowerCase();
    ("usga" === b || "sand_profile" === b ?
        ((m = 0.95), (f = "USGA sand profile - consistent surface year-round, optimal shock absorption")) :
        "sand_carpet" === b ?
        ((m = 0.92), (f = "Sand carpet - good consistency and player safety")) :
        "hybrid" === b ?
        ((m = 0.88),
            (f = "Hybrid reinforced - stable but often TOO HARD. Monitor Clegg values closely, typically 85-100+ Gmax")) :
        "modified" === b || "pipe_drained" === b ?
        ((m = 0.8), (f = "Pipe drained - variable depending on soil type, prone to hardness when dry")) :
        ((m = 0.7),
            (f =
                "Native soil - prone to extremes (rock-hard when dry, mud when wet). High injury risk in dry conditions")),
        (y =
            "usga" === b || "sand_profile" === b ?
            "excellent" === x ?
            220 :
            "good" === x ?
            180 :
            "moderate" === x ?
            140 :
            100 :
            "sand_carpet" === b ?
            "excellent" === x ?
            200 :
            "good" === x ?
            160 :
            "moderate" === x ?
            120 :
            80 :
            "hybrid" === b ?
            "excellent" === x ?
            180 :
            "good" === x ?
            140 :
            "moderate" === x ?
            100 :
            60 :
            "modified" === b || "pipe_drained" === b ?
            "excellent" === x ?
            150 :
            "good" === x ?
            120 :
            "moderate" === x ?
            80 :
            50 :
            "excellent" === x ?
            80 :
            "good" === x ?
            60 :
            "moderate" === x ?
            30 :
            15) <= 0 && (y = 1));
    var w = Math.max(0, Math.min(2, p / y)),
        S = 0.25,
        C = 1 - 6 * (S + Math.max(0, Math.min(1, w)) * (0.4 - S) - S);
    (C < 0.1 && (C = 0.1), C > 1 && (C = 1));
    var M = Math.exp(-2 * Math.abs(r - 1.6));
    (M < 0.4 && (M = 0.4), M > 1 && (M = 1));
    var I,
        k = 1;
    "Tall Fescue" === o
        ?
        (k = 1.2) :
        "Kentucky Bluegrass" === o ?
        (k = 1.25) :
        a ?
        (k = 1.35) :
        (/PRG/i.test((I = o)) || /Ryegrass/i.test(I)) && (k = 1);
    var A = i / 190;
    (!isFinite(A) || A <= 0) && (A = 1);
    var E = 1 - 0.4 * Math.abs(A - 1);
    (E < 0.6 && (E = 0.6), E > 1 && (E = 1));
    var N = 1;
    if (n > 2 && n <= 4) N = 1 - (0.15 * (n - 2)) / 2;
    else if (n > 4) {
        N = 0.85 - (0.15 * (Math.min(n, 8) - 4)) / 4;
    }
    N < 0.7 && (N = 0.7);
    var T = C * M * k * E * N * m;
    (!isFinite(T) || T <= 0) && (T = 0.1);
    var P,
        R,
        $,
        F = Math.max(0, Math.min(1, T)),
        _ = null,
        D = safeNum(e.turf.cleggMax, 0),
        G = safeNum(e.turf.cleggMin, 0),
        L = D > 0 && G > 0,
        O = L ? D - G : 0,
        z = null,
        H = null,
        q = null;
    if (v)
        ((P = h),
            (R = "Measured (Clegg hammer)"),
            L &&
            ((R = "Measured (mean of zones)"),
                O <= 10 ?
                (z = "Excellent") :
                O <= 20 ?
                ((z = "Good"), (H = "Minor variation across surface - continue monitoring")) :
                O <= 35 ?
                ((z = "Moderate"), (H = "Noticeable variation - targeted maintenance recommended")) :
                ((z = "Poor"), (H = "Significant variation (" + O + " Gmax spread) - player safety concern")),
                (q = []),
                D > 100 ?
                q.push({
                    zone: "Hardest zones (Gmax " + D + ")",
                    status: "critical",
                    issue: "Exceeds safe limit - injury risk elevated",
                    actions: [
                        "Deep aeration (150-200mm depth) with hollow tines",
                        "Increase irrigation frequency to these zones",
                        "Consider sand topdressing to improve structure",
                        "If persistent, may indicate subsurface compaction layer",
                    ],
                }) :
                D > 90 &&
                q.push({
                    zone: "Hardest zones (Gmax " + D + ")",
                    status: "warning",
                    issue: "Above ideal range - monitor closely",
                    actions: [
                        "Regular aeration (solid or hollow tine)",
                        "Light irrigation before play if forecast is dry",
                        "Monitor player feedback for impact-related complaints",
                    ],
                }),
                G < 50 ?
                q.push({
                    zone: "Softest zones (Gmax " + G + ")",
                    status: "warning",
                    issue: "Too soft - divoting and poor ball bounce likely",
                    actions: [
                        "Improve drainage if waterlogging observed",
                        "Reduce irrigation to these zones",
                        "Consider sand topdressing to firm up",
                        "Check for excessive thatch/organic matter",
                    ],
                }) :
                G < 60 &&
                q.push({
                    zone: "Softest zones (Gmax " + G + ")",
                    status: "monitor",
                    issue: "Slightly soft - may be acceptable",
                    actions: ["Monitor for divot damage during play", "Ensure good surface drainage"],
                }),
                O > 25 &&
                q.push({
                    zone: "Uniformity management",
                    status: "advice",
                    issue: "High variation requires zone-specific approach",
                    actions: [
                        "Map hardness zones to guide maintenance",
                        "Aerate hard zones more frequently/deeper",
                        "Consider differential irrigation by zone",
                        "Re-measure after intervention to track improvement",
                    ],
                })));
    else {
        var W;
        W =
            "usga" === b || "sand_profile" === b ?
            75 :
            "sand_carpet" === b ?
            70 :
            "hybrid" === b ?
            92 :
            "modified" === b || "pipe_drained" === b ?
            88 :
            95;
        var U = 40 * (1 - C),
            B = 20 * (r - 1.4);
        ((P = Math.round(W - U + B)), (P = Math.max(30, Math.min(130, P))), (R = "Estimated (no Clegg data)"));
    }
    d
        ?
        P < 60 ?
        (($ = "Too soft"),
            (_ = "Surface too soft for quality putting - consider reducing irrigation, improving drainage")) :
        P < 80 ?
        ($ = "Soft") :
        P < 110 ?
        ($ = "Ideal") :
        P < 140 ?
        ($ = "Firm") :
        (($ = "Very firm"),
            (_ = "Surface very firm - may cause excessive ball bounce, consider light irrigation")) :
        P < 50 ?
        (($ = "Too soft"), (_ = "Surface too soft - poor ball bounce, divoting likely")) :
        P < 70 ?
        ($ = "Soft") :
        P < 90 ?
        ($ = "Ideal") :
        P < 110 ?
        (($ = "Firm"), (_ = "Surface firm - monitor player feedback, especially headers/falls")) :
        (($ = "Too hard"),
            (_ = "CRITICAL: Surface too hard - injury risk elevated, consider irrigation or closure"));
    var j = 100 * (1 - F);
    return (
        j < 0 && (j = 0),
        j > 100 && (j = 100), {
            FI: F,
            softnessRisk: j,
            softnessClass: j >= 66 ? "High softness / low firmness" : j >= 33 ? "Moderate softness" : "Firm–normal",
            surfaceHardness: P,
            hardnessClass: $,
            hardnessSource: R,
            hardnessWarning: _,
            hasCleggData: v,
            cleggMax: D,
            cleggMin: G,
            cleggRange: O,
            hasCleggRange: L,
            uniformityClass: z,
            uniformityWarning: H,
            zoneRecommendations: q,
            constructionFactor: m,
            constructionNote: f,
            FIcomponents: {
                tau_w: C,
                tau_bd: M,
                tau_species: k,
                tau_N: E,
                tau_salinity: N,
                tau_construction: m,
                rain48h: p,
                infCap: y,
                bd: r,
                ecw: n,
                cleggValue: h,
            },
        }
    );
}

function gaip_Nopt_engine(e, t) {
    var r,
        n = e.turf.warmBase || "",
        i = e.turf.coolOverseed || "",
        a = safeNum(e.turf.hoc, 25),
        o = calculateC3C4Fractions(e.turf),
        s = o.c3frac,
        l = o.c4frac,
        d = calcMixedGrowthPotential(getAverageTemperature(t, e), s, l),
        c = {
            "Intense PRG": 240,
            "Slugger 3GL": 230,
            "Premier III": 220,
            "Allstar Fore": 220,
            "PRG generic": 200,
            "Kentucky Bluegrass": 180,
            "Tall Fescue": 160,
            "Creeping Bentgrass (Fairway)": 140,
            "Fine Fescue": 120,
            "Annual Bluegrass (Fairway)": 160,
            "Creeping Bentgrass (Greens)": 100,
            "Annual Bluegrass (Greens)": 110,
            "Velvet Bentgrass (Greens)": 90,
            "Tahoma 31": 160,
            "Santa Ana couch": 225,
            Bermudagrass: 225,
            "Couch generic": 225,
            Kikuyu: 225,
            "Bermudagrass (Greens)": 120,
            "TifEagle (Greens)": 115,
            "Champion (Greens)": 115,
        },
        p = c[n] || 0,
        g = c[i] || 0;
    return (
        (r = !n && g > 0 ?
            g * Math.max(0.25, d.c3potential / 100) :
            p > 0 && !i ?
            p * Math.max(0.15, d.c4potential / 100) :
            p > 0 && g > 0 ?
            (s * g * d.c3potential) / 100 + (l * p * d.c4potential) / 100 :
            190 * Math.max(0.2, d.weighted / 100)),
        a < 15 ? (r *= 1.15) : a < 25 ? (r *= 1.05) : a > 35 && (r *= 0.9), {
            Nopt: r,
            growthData: d,
            baseOptimum: !n && g > 0 ? g : p > 0 && !i ? p : 190,
        }
    );
}

function gaip_traffic_engine(e, t, r) {
    var n = safeNum(e.traffic.matchesPerWeek, 0),
        i = safeNum(e.traffic.sessionsPerWeek, 0),
        a = safeNum(e.traffic.restDays, 0),
        o = 1 * n + 0.5 * i,
        s = r?.FI || 0.5,
        l = 1 / Math.max(0.2, s),
        d = o * l,
        c = Math.min(100, (d / 10) * 100),
        p = "low",
        g = [];
    (d >= 30 ?
        ((p = "catastrophic"),
            g.push({
                severity: "critical",
                message: "CATASTROPHIC LOAD: Effective load of " +
                    d.toFixed(0) +
                    " events (" +
                    n +
                    " matches × " +
                    l.toFixed(1) +
                    " softness factor) is unsustainable.",
                action: "Immediately reduce usage or improve field conditions. Maximum sustainable effective load is ~15-20 events/week.",
            })) :
        d >= 20 ?
        ((p = "extreme"),
            g.push({
                severity: "critical",
                message: "EXTREME LOAD: Effective load of " + d.toFixed(0) + " events exceeds sustainable limits.",
                action: "Reduce matches or improve drainage/firmness to lower the softness multiplier.",
            })) :
        d >= 15 ?
        ((p = "very_high"),
            g.push({
                severity: "warning",
                message: "VERY HIGH LOAD: Effective load of " + d.toFixed(0) + " events is at the upper limit.",
                action: "Monitor closely. Consider improving field conditions to reduce softness multiplier (currently " +
                    l.toFixed(1) +
                    "x).",
            })) :
        d >= 10 ?
        ((p = "high"),
            l > 1.5 &&
            g.push({
                severity: "caution",
                message: "HIGH LOAD amplified by soft conditions: " +
                    n +
                    " matches × " +
                    l.toFixed(1) +
                    " = " +
                    d.toFixed(0) +
                    " effective events.",
                action: "Field softness is increasing damage. Address drainage, reduce irrigation before events, or reduce traffic.",
            })) :
        (p = d >= 6 ? "moderate" : "low"),
        s < 0.4 &&
        n > 2 &&
        g.push({
            severity: "warning",
            message: "SOFT FIELD WARNING: Firmness Index " + (100 * s).toFixed(0) + "% is too low for current traffic.",
            action: "Improve drainage, reduce irrigation, or close field until conditions firm up.",
        }),
        i > 2 * n &&
        i > 6 &&
        g.push({
            severity: "caution",
            message: "Training load (" + i + " sessions) is high relative to matches.",
            action: "Consider rotating training areas to distribute wear.",
        }));
    var u = calculateC3C4Fractions(e.turf),
        m = u.c3frac,
        f = u.c4frac,
        y = calcMixedGrowthPotential(getAverageTemperature(t, e), m, f),
        h = y.weighted / 100,
        v = s >= 0.6 ? 90 : s >= 0.5 ? 75 : s >= 0.4 ? 55 : s >= 0.3 ? 35 : 15,
        b = 0;
    d >= 30 ?
        (b = 80) :
        d >= 20 ?
        (b = 65) :
        d >= 15 ?
        (b = 50) :
        d >= 10 ?
        (b = 35) :
        d >= 6 ?
        (b = 20) :
        d >= 3 && (b = 10);
    var x = Math.max(5, v - b);
    if (h >= 0.85) {
        var w = 100 * (h - 0.85);
        x = Math.min(95, x + w);
    } else if (h < 0.8) {
        var S = 75 * (0.8 - h);
        x = Math.max(5, x - S);
    }
    var C = 1;
    h < 0.3 ? (C = 2.5) : h < 0.5 ? (C = 1.8) : h < 0.7 ? (C = 1.3) : h >= 0.9 && (C = 0.8);
    var M = (s >= 0.6 ? 2 : s >= 0.5 ? 3 : s >= 0.4 ? 4 : s >= 0.3 ? 6 : 8) * C,
        I = 1;
    return (
        d >= 30 ?
        (I = 5) :
        d >= 20 ?
        (I = 3.5) :
        d >= 15 ?
        (I = 2.5) :
        d >= 10 ?
        (I = 1.8) :
        d >= 6 ?
        (I = 1.4) :
        d >= 3 && (I = 1.2),
        (M = Math.ceil(M * I)) > 21 &&
        ((M = 21),
            g.push({
                severity: "critical",
                message: "Recovery time exceeds 3 weeks - field may require renovation rather than natural recovery.",
                action: "Consider field closure and renovation program.",
            })), {
            TrafficRisk: isFinite(c) ? c : 0,
            recoveryProb: isFinite(x) ? x : 0,
            recoveryWindow: isFinite(M) ? M : 0,
            FI: s,
            FIcomponents: r?.FIcomponents || {},
            rawLoad: o,
            effectiveLoad: d,
            softnessMult: l,
            matches: n,
            sessions: i,
            restDays: a,
            trafficLevel: p,
            trafficWarnings: g,
            growthData: y,
            growthMultiplier: h,
            growthWindowFactor: C,
        }
    );
}

function gaip_shade_engine(e, t) {
    var r = safeNum(e.turf.dli, 0);
    if (0 === r)
        if (e.ambientDLI && e.ambientDLI.current > 0)
            ((r = e.ambientDLI.current), console.log("[Shade] Using ambient DLI from state:", r));
        else if (e.turf.ambientDLI > 0)((r = e.turf.ambientDLI), console.log("[Shade] Using ambient DLI from turf:", r));
    else if ("undefined" != typeof window && window.gaip_currentAmbientDLI && window.gaip_currentAmbientDLI.current > 0)
        ((r = window.gaip_currentAmbientDLI.current), console.log("[Shade] Using ambient DLI from global:", r));
    else if ("undefined" != typeof window && "function" == typeof window.gaip_getAmbientDLI) {
        var n = window.gaip_getAmbientDLI();
        n && n.dli > 0 && ((r = n.dli), console.log("[Shade] Using ambient DLI from integration:", r));
    }
    var i = safeNum(e.turf.ledPPFD, 0),
        a = safeNum(e.turf.ledHours, 0),
        o = i > 0 && a > 0 ? (i * a * 3600) / 1e6 : 0,
        s = safeNum(document.querySelector(".gaip-svf-input")?.value, 1);
    (s < 0 && (s = 0), s > 1 && (s = 1));
    var l = safeNum(document.querySelector(".gaip-facade-angle")?.value, 0);
    (l < 0 && (l = 0), l > 90 && (l = 90));
    var d = safeNum(document.querySelector(".gaip-tree-occlusion")?.value, 0);
    (d < 0 && (d = 0), d > 100 && (d = 100));
    var c,
        p = safeNum(e.climate.lat, -35),
        g = Math.abs(p),
        u = g <= 25 ? 0.8 : g <= 35 ? 0.7 : 0.6,
        m = l / 90,
        f = d / 100,
        y = 0.6 * (1 - Math.min(1, m + f)) + 0.4 * s;
    y < 0.05 && (y = 0.05);
    var h = (c = s >= 0.99 && 0 === l && 0 === d ? r : r * y * u) + o,
        v = e.turf.warmBase || "",
        b = e.turf.coolOverseed || "",
        x = getAverageTemperature(t, e),
        w = calculateC3C4Fractions(e.turf),
        S = w.c3frac,
        C = w.c4frac,
        M = calcMixedGrowthPotential(x, S, C),
        I = 1,
        k = 1;
    (x < 15 ? (I = 0.85) : x > 28 && (I = 1.15), x < 18 ? (k = 1.2) : x > 30 && (k = 0.9));
    var A = 12 * I, // C3 minimum (survival floor)
        c3Target = 15 * I, // C3 target (acceptable quality) - NEW
        E = 18 * I, // C3 optimal (high performance)
        N = 20 * k, // C4 minimum
        c4Target = 22 * k, // C4 target (acceptable quality) - NEW
        T = 25 * k; // C4 optimal

    function P(e, t, r, n) {
        return (e >= r ? "Optimal" : e >= t ? "Suboptimal" : "Critical") + (n ? " " + n : "");
    }
    var R,
        $ = x < 18 ? "(cool temps increase light demand)" : x > 30 ? "(optimal temps reduce light demand)" : "",
        F =
        S > 0 ?
        P(h, A, E, x < 15 ? "(cool temps reduce light demand)" : x > 28 ? "(heat stress increases light demand)" : "") :
        "N/A",
        _ = C > 0 ? P(h, N, T, $) : "N/A",
        D = 0;

    // Calculate deficit from TARGET (not optimal) for LED recommendations
    // LED should only be suggested when significantly below target, not for minor suboptimal conditions
    var c3Deficit = Math.max(0, c3Target - h),
        c4Deficit = Math.max(0, c4Target - h),
        needsLED_C3 = h < A + 2, // Only recommend LED if within 2 mol of minimum
        needsLED_C4 = h < N + 3; // Only recommend LED if within 3 mol of minimum

    (b ? (D = Math.max(0, E - h)) : v && (D = Math.max(0, T - h)),
        (R = b ?
            h < A ?
            `<span style="color: #991b1b; font-weight: 600;">POOR - Do Not Renovate</span><br>
                <span style="font-size: 12px;">DLI critically low (${h.toFixed(1)} vs ${A.toFixed(1)} minimum). 
                Seedlings will fail to establish. Success rate: <20%.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-critical-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Required improvements:</strong><br>
                    • Need ${c3Deficit.toFixed(1)} mol/m²/day additional DLI to reach acceptable levels<br>
                    • Add LED supplementation (min ${Math.ceil((1e6 * c3Deficit) / 3600 / 12)} µmol/m²/s for 12hrs)<br>
                    • OR reduce shade significantly (trim trees, remove obstructions)<br>
                    • OR postpone until seasonal light improves
                </div>` :
            h < c3Target ?
            `<span style="color: #92400e; font-weight: 600;">MARGINAL - Challenging</span><br>
                <span style="font-size: 12px;">DLI below target (${h.toFixed(1)} vs ${c3Target.toFixed(1)} target). 
                Success rate: 50-70%. Enhanced management required.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Expected issues:</strong><br>
                    • Reduced seedling vigour and tillering<br>
                    • Slower establishment (1.5× longer to playability)<br>
                    • Moderate vulnerability to traffic wear<br>
                    • Increased disease monitoring needed<br>
                    • May require overseeding to fill gaps
                </div>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Management strategies:</strong><br>
                    • Increase seeding rate by 20-30%<br>
                    • Use shade-tolerant cultivars (e.g., Evening Shade, Fiesta 4)<br>
                    • Extend traffic-free establishment period to 5-6 weeks<br>
                    • Increase monitoring frequency<br>
                    • Consider timing renovation for peak seasonal light${
                      needsLED_C3
                        ? `<br>
                    • LED supplementation may help if available (${Math.ceil((1e6 * c3Deficit) / 3600 / 12)} µmol/m²/s)`
                        : ""
                    }
                </div>` :
            h < E ?
            `<span style="color: #a16207; font-weight: 600;">MARGINAL - Acceptable</span><br>
                <span style="font-size: 12px;">DLI adequate but below optimal (${h.toFixed(1)} vs ${E.toFixed(1)} optimal). 
                Success rate: 70-85%. Standard management with monitoring.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Expected conditions:</strong><br>
                    • Acceptable establishment with slight reduction in density<br>
                    • Normal to slightly extended time to playability<br>
                    • Monitor for disease pressure in humid conditions<br>
                    • Good results achievable with standard care
                </div>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Recommended approach:</strong><br>
                    • Standard seeding rate (consider +10% if budget allows)<br>
                    • Select proven cultivars for your region<br>
                    • Normal establishment protocol (4-5 weeks traffic-free)<br>
                    • Regular disease scouting during establishment
                </div>` :
            `<span style="color: #065f46; font-weight: 600;">SUITABLE - Proceed with Confidence</span><br>
                <span style="font-size: 12px;">DLI meets or exceeds optimal (${h.toFixed(1)} vs ${E.toFixed(1)} required). 
                Excellent establishment expected. Success rate: >90%.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-good-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Expected outcomes:</strong><br>
                    • Rapid germination and establishment<br>
                    • Strong, dense seedling growth<br>
                    • Normal time to playability (3-4 weeks)<br>
                    • Good stress tolerance and recovery<br>
                    • Reliable stand establishment
                </div>` :
            v ?
            h < N ?
            `<span style="color: #991b1b; font-weight: 600;">POOR - Do Not Renovate</span><br>
                <span style="font-size: 12px;">DLI critically low (${h.toFixed(1)} vs ${N.toFixed(1)} minimum). 
                Warm-season seedlings will fail. Success rate: <20%.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-critical-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Required improvements:</strong><br>
                    • Need ${c4Deficit.toFixed(1)} mol/m²/day additional DLI<br>
                    • Add LED supplementation (min ${Math.ceil((1e6 * c4Deficit) / 3600 / 14)} µmol/m²/s for 14hrs)<br>
                    • OR reduce shade significantly<br>
                    • OR postpone until peak summer light
                </div>` :
            h < c4Target ?
            `<span style="color: #92400e; font-weight: 600;">MARGINAL - Challenging</span><br>
                <span style="font-size: 12px;">DLI below target (${h.toFixed(1)} vs ${c4Target.toFixed(1)} target). 
                Success rate: 50-70%. Enhanced management required.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Expected issues:</strong><br>
                    • Slow stoloniferous spread<br>
                    • Weak root development<br>
                    • Extended establishment time (2-3× longer)<br>
                    • Poor initial wear tolerance<br>
                    • May revert to dormancy under stress
                </div>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Management strategies:</strong><br>
                    • Increase sprig/plug density by 30-40%<br>
                    • Extend traffic-free period to 8-10 weeks<br>
                    • Optimise temperature (ensure soil >18°C)<br>
                    • Maintain adequate N fertilization<br>
                    • Consider postponing to peak growing season${
                      needsLED_C4
                        ? `<br>
                    • LED supplementation may help if available (${Math.ceil((1e6 * c4Deficit) / 3600 / 14)} µmol/m²/s)`
                        : ""
                    }
                </div>` :
            h < T ?
            `<span style="color: #a16207; font-weight: 600;">MARGINAL - Acceptable</span><br>
                <span style="font-size: 12px;">DLI adequate but below optimal (${h.toFixed(1)} vs ${T.toFixed(1)} optimal). 
                Success rate: 70-85%. Standard management with monitoring.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Expected conditions:</strong><br>
                    • Acceptable establishment with slightly slower coverage<br>
                    • Normal to slightly extended establishment time<br>
                    • Monitor soil temperature and moisture<br>
                    • Good results achievable with proper timing
                </div>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Recommended approach:</strong><br>
                    • Standard sprig/plug density (consider +20% if budget allows)<br>
                    • Ensure soil temps consistently >18°C<br>
                    • Normal establishment protocol (6-8 weeks traffic-free)<br>
                    • Regular monitoring during establishment
                </div>` :
            `<span style="color: #065f46; font-weight: 600;">SUITABLE - Proceed with Confidence</span><br>
                <span style="font-size: 12px;">DLI meets or exceeds optimal (${h.toFixed(1)} vs ${T.toFixed(1)} required). 
                Excellent establishment expected. Success rate: >90%.</span>
                <div style="margin-top: 6px; padding: 6px; background: var(--gaip-good-bg); border-radius: 4px; font-size: 11px;">
                    <strong>Expected outcomes:</strong><br>
                    • Rapid stolon/rhizome development<br>
                    • Dense, vigorous growth<br>
                    • Normal establishment time (4-6 weeks to 80% cover)<br>
                    • Excellent wear tolerance<br>
                    • Reliable, uniform coverage
                </div>` :
            '<span style="color: var(--gaip-text-muted, var(--gaip-text-secondary)); font-style: italic;">Select a grass species from the dropdown above to enable renovation assessment.</span>'));
    var G = null;
    if ("undefined" != typeof GAIP_Shade && "function" == typeof GAIP_Shade.engine)
        try {
            var L = {
                turf: {
                    dli: h,
                    species: e.turf.warmBase || e.turf.coolOverseed || "",
                    percentC3Cover: 100 * S,
                    coolOverseed: !!b,
                    trafficLevel: e.turf.trafficLevel || "moderate",
                    plannedNRate: safeNum(e.turf.nRate, 25),
                    hoc: safeNum(e.turf.hoc, null),
                    pgrActive: e.turf.pgrActive || !1,
                },
                shade: {
                    dli: h,
                    skyView: s,
                    canopyDensity: Math.round(d / 20),
                    geometryScore: Math.round(l / 18),
                    aspect: e.shade?.aspect || "N",
                    facade: l,
                    obstructionAngle: l,
                    ledAvailable: o > 0,
                },
                site: {
                    region: g <= 25 ? "tropical" : g <= 35 ? "warm-temperate" : "cool-temperate",
                    hemisphere: p < 0 ? "south" : "north",
                    ledAvailable: o > 0,
                },
                location: {
                    lat: p,
                },
                traffic: {
                    level: e.turf.trafficLevel || "moderate",
                },
                monthIndex: new Date().getMonth(), // pure engine requires explicit date; no implicit fallback
            };
            ((G = GAIP_Shade.engine(L, t)), console.log("✅ Modular Shade Engine v2.0 calculated:", G?.status));
        } catch (e) {
            console.warn("Modular shade engine failed:", e);
        }
    // v9.9.0: Add c3/c4 fractions and effective species status for overseed-aware verdict
    var isOverseedDominant = S > 0.5;
    var effectiveStatus = isOverseedDominant ? F : C > 0 ? _ : F;

    var O = {
        DLI_measured: r,
        DLI_led: o,
        DLI_adj: c,
        DLI_total: h,
        shadeFactor: y,
        seasonalWeight: u,
        svf: s,
        facade: l,
        treeBlock: d,
        c3Status: F,
        c4Status: _,
        c3Fraction: S,
        c4Fraction: C,
        isOverseedDominant: isOverseedDominant,
        effectiveStatus: effectiveStatus,
        renovation: R,
        c3Min: A,
        c3Opt: E,
        c4Min: N,
        c4Opt: T,
        temperature: x,
        growthData: M,
        c3TempFactor: I,
        c4TempFactor: k,
    };
    return (
        G &&
        "NO_DATA" !== G.status &&
        ((O.modular = G),
            (O.fungalRisk = G.fungalRisk),
            (O.fungalClass = G.fungalClass),
            (O.stressIndex = G.stressIndex),
            (O.stressClass = G.stressClass),
            (O.recoveryWindow = G.recoveryWindow),
            (O.ledRecommendation = G.led),
            (O.speciesDecision = G.speciesDecision),
            (O.nAdjustment = G.nAdjustment),
            (O.mowingGuidance = G.mowingGuidance),
            (O.pgrGuidance = G.pgrGuidance),
            (O.seasonalTrajectory = G.seasonalTrajectory),
            (O.dliShaded = G.dliShaded),
            (O.dliTarget = G.dliTarget),
            (O.deficitPct = G.deficitPct)),
        O
    );
}

function gaip_event_multipliers(e, t) {
    var r = {
            soccer: {
                match: 1,
            },
            rugby_league: {
                match: 1.4,
            },
            rugby_union: {
                match: 1.3,
            },
            afl: {
                match: 1.6,
            },
            junior: {
                match: 0.5,
            },
            low_impact: {
                match: 0.3,
            },
        },
        n = {
            standard: {
                train: 0.5,
            },
            elite: {
                train: 0.8,
            },
            technical: {
                train: 0.3,
            },
            junior: {
                train: 0.25,
            },
        },
        i = n[t] || n.standard;
    return {
        matchFactor: (r[e] || r.soccer).match,
        trainingFactor: i.train,
    };
}

function gaip_turf_manager_engine(e, t, r, n) {
    var i,
        a,
        o = safeNum(e.traffic.matchesPerWeek, 0),
        s = safeNum(e.traffic.sessionsPerWeek, 0),
        l = safeNum(e.traffic.restDays, 0),
        d = e.traffic.matchCode || "soccer",
        c = e.traffic.trainingCode || "standard",
        p = gaip_event_multipliers(d, c),
        g = o * p.matchFactor + s * p.trainingFactor,
        u = n?.FI || 1,
        m = r?.TrafficRisk || 0,
        f = r?.recoveryProb || 0;
    ((i =
            u < 0.35 || f < 30 ?
            "Poor – remove from primary schedule" :
            u < 0.45 || f < 50 || m >= 4 ?
            "Marginal – restricted or lower-grade use only" :
            "Acceptable for scheduled use"),
        (a =
            u < 0.35 ?
            "High – elevated lower-limb injury risk under full-speed play." :
            u < 0.45 ?
            "Moderate – caution for elite matches; monitor closely." :
            "Low – firmness and shear resistance within acceptable ranges."));
    var y = 0;
    m >= 5 || u < 0.35 ? (y = 50) : m >= 4 ? (y = 30) : m >= 3 ? (y = 20) : m >= 2 && (y = 10);
    var h = r?.recoveryWindow || 2,
        v =
        l >= h ?
        "Current rest is adequate for projected recovery." :
        "Increase rest to at least " + h + " days between peak events.",
        b = !1,
        x = "";
    f < 40 && m >= 4 ?
        ((b = !0),
            (x = "Surface will not recover to stable FI before calendar load resumes. Major renovation window required.")) :
        u < 0.35 &&
        g > 5 &&
        ((b = !0), (x = "FI below safe threshold under heavy load. Structural renovation recommended."));
    var w = n?.FIcomponents?.rain48h || 0,
        S = n?.FIcomponents?.infCap || 40;
    return {
        eventWear: g,
        playability: i,
        playerRisk: a,
        cutbackPercent: y,
        targetRestDays: h,
        restStatus: v,
        renovationTrigger: b,
        renovationReason: x,
        moistureRisk: w > S ?
            "High – rainfall exceeds infiltration capacity → softness spike expected." :
            w > 0.5 * S ?
            "Moderate – manage surface moisture between events." :
            "Low moisture-related softness risk.",
        matchCode: d,
        trainingCode: c,
    };
}

function generateOverseedHeatAlert(e, t) {
    if (!e || !e.stress) return "";
    var r = e.stress,
        n = (e.growth.dailyPattern, new Date().getMonth() + 1),
        // Offset month by 6 for northern hemisphere so seasons align correctly
        // (SH July=winter C3 dominant, NH July=summer C4 dominant)
        nAdjusted = t.hemi === "northern" ? ((n + 5) % 12) + 1 : n,
        i = AUSTRALIAN_OVERSEED_CALENDAR[nAdjusted];
    if (!i) return "";
    var a = t.turf.overseed && t.turf.overseed.active;
    if (!r.heat || !r.heat.days) return "";
    var o = r.heat.days,
        s = r.heat.maxTemp,
        l = "info";
    a
        ?
        "dead" === i.overseedStatus ?
        (l = "optimal") :
        "establishing" === i.overseedStatus ?
        (l = "critical") :
        "established" === i.overseedStatus ?
        (l = "severe") :
        "dominant" === i.overseedStatus ?
        (l = "critical") :
        "fading" === i.overseedStatus ?
        (l = "warning") :
        "dying" === i.overseedStatus && (l = "expected") :
        (l =
            0 === (g = t.turf.speciesFractions.c3Fraction || 0) ?
            "optimal" :
            g > 0.5 ?
            s > 35 ?
            "critical" :
            "severe" :
            "warning");
    if ("optimal" === l && !a && 1 === t.turf.speciesFractions.c4Fraction) return "";
    var d = {
            critical: {
                bg: "var(--gaip-critical-bg)",
                border: "#dc2626",
                icon: "🔴",
                color: "#991b1b",
            },
            severe: {
                bg: "var(--gaip-warning-bg)",
                border: "#f59e0b",
                icon: "⚠️",
                color: "#92400e",
            },
            warning: {
                bg: "var(--gaip-warning-bg)",
                border: "#fb923c",
                icon: "⚠️",
                color: "#9a3412",
            },
            expected: {
                bg: "var(--gaip-good-bg)",
                border: "#22c55e",
                icon: "✅",
                color: "#166534",
            },
            optimal: {
                bg: "var(--gaip-good-bg)",
                border: "#10b981",
                icon: "🌟",
                color: "#065f46",
            },
        },
        c = d[l] || d.warning,
        p =
        '<div style="margin-top: 12px; padding: 12px; background: ' +
        c.bg +
        "; border-left: 4px solid " +
        c.border +
        '; border-radius: 4px; font-size: 12px;">';
    if (
        ((p += '<div style="font-weight: 700; color: ' + c.color + '; margin-bottom: 8px;">'),
            (p += c.icon + " "),
            "optimal" === l)
    )
        p += a ? "OPTIMAL C4 CONDITIONS" : "OPTIMAL WARM-SEASON CONDITIONS";
    else if ("expected" === l) p += "EXPECTED SEASONAL HEAT";
    else if ("critical" === l) {
        var g = t.turf.speciesFractions.c3Fraction || 0;
        p += !a && g >= 0.8 ? "CRITICAL C3 HEAT STRESS" : "CRITICAL HEAT STRESS";
    } else if ("severe" === l) {
        var u = t.turf.speciesFractions.c3Fraction || 0;
        p += !a && u >= 0.5 ? "SEVERE C3 HEAT STRESS" : "SEVERE HEAT STRESS";
    } else p += "HEAT DETECTED";
    if (
        ((p += "</div>"),
            a &&
            ((p +=
                    '<div style="margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 3px; font-size: 11px; line-height: 1.5;">'),
                (p += "<strong>Period:</strong> " + i.month + " (" + i.season + ")<br>"),
                (p +=
                    "<strong>Overseed Status:</strong> " +
                    ("dead" === i.overseedStatus ?
                        "Not present (died Nov/Dec)" :
                        "establishing" === i.overseedStatus ?
                        "Establishing (seeded Feb/Mar)" :
                        "dominant" === i.overseedStatus ?
                        "Dominant winter cover" :
                        "fading" === i.overseedStatus ?
                        "Fading (spring transition)" :
                        "dying" === i.overseedStatus ?
                        "Natural die-off" :
                        "Active") +
                    "<br>"),
                (p += "<strong>Expected:</strong> " + i.expectedC3 + "% ryegrass / " + i.expectedC4 + "% couch<br>"),
                (p += "<strong>Priority:</strong> " + i.priority),
                (p += "</div>")),
            (p += '<div style="color: ' + c.color + '; line-height: 1.6; margin-bottom: 10px;">'),
            (p += "<strong>Heat Event:</strong><br>"),
            (p += "• " + o + " day" + (o > 1 ? "s" : "") + " exceeded 30°C<br>"),
            (p += "• Peak: <strong>" + s + "°C</strong>"),
            (p += "</div>"),
            (p += '<div style="padding: 10px; background: var(--gaip-surface); border-radius: 3px; font-size: 11px;">'),
            (p += '<div style="font-weight: 600; margin-bottom: 6px; color: ' + c.color + ';">'),
            (p += "Management Actions:</div>"),
            "optimal" === l && a && "dead" === i.overseedStatus)
    )
        ((p += '<div style="color: #065f46; font-weight: 600; margin-bottom: 6px;">'),
            (p += "✅ This is IDEAL summer conditions for C4 couch!</div>"),
            (p += "• Maintain summer irrigation schedule<br>"),
            (p += "• C4 growth at peak - perfect for recovery<br>"),
            (p += "• No ryegrass present (expected for " + i.month + ")<br>"),
            (p += "• Next overseed: February-March"));
    else if ("critical" === l && a && "establishing" === i.overseedStatus)
        ((p += '<div style="color: #991b1b; font-weight: 700; margin-bottom: 6px;">'),
            (p += "🔴 CRITICAL - NEW SEEDLINGS AT EXTREME RISK</div>"),
            (p += "• <strong>URGENT:</strong> Increase irrigation immediately<br>"),
            (p += "• Water 2-3 times daily to keep seedbed moist<br>"),
            (p += "• Light syringing during peak heat (11 AM - 3 PM)<br>"),
            (p += "• <strong>ZERO TRAFFIC</strong> on new seedlings<br>"),
            (p += "• Monitor closely - death can occur in hours<br>"),
            (p += "• Be prepared to re-seed if significant loss occurs"));
    else if ("expected" === l && a && "dying" === i.overseedStatus)
        ((p += '<div style="color: #166534; font-weight: 600; margin-bottom: 6px;">'),
            (p += "✅ Natural transition - ryegrass die-off is EXPECTED</div>"),
            (p += "• Heat is killing remaining ryegrass (normal for November)<br>"),
            (p += "• Allow couch to take over completely<br>"),
            (p += "• Reduce irrigation to C4 requirements<br>"),
            (p += "• Don't try to keep ryegrass alive - it should die now"));
    else if ("optimal" !== l || a)
        if (("critical" !== l && "severe" !== l) || a)
            p += "• " + (r.heat.recommendation || "Monitor conditions and adjust irrigation as needed");
        else {
            g = t.turf.speciesFractions.c3Fraction || 0;
            var m =
                window.GAIP_DEW_RESULT &&
                window.GAIP_DEW_RESULT.summary &&
                "severe" === window.GAIP_DEW_RESULT.summary.severity,
                f =
                window.GAIP_DEW_RESULT &&
                window.GAIP_DEW_RESULT.leafWetness &&
                window.GAIP_DEW_RESULT.leafWetness.totalWetHours >= 30,
                y = !m && !f;
            g >= 0.8 ?
                ((p += '<div style="color: #991b1b; font-weight: 700; margin-bottom: 6px;">'),
                    (p += "🔴 COOL-SEASON GRASS UNDER SEVERE STRESS</div>"),
                    (p += "• <strong>URGENT:</strong> C3 grass cannot tolerate this heat<br>"),
                    (p += "• Increase irrigation frequency significantly<br>"),
                    (p += y ?
                        "• Syringe turf during peak heat (11 AM - 3 PM)<br>" :
                        '• <span style="color: #dc2626;">⚠️ Avoid syringing - leaf wetness already extended (disease risk)</span><br>'),
                    (p += "• Raise mowing height to reduce stress<br>"),
                    (p += "• Avoid all traffic if possible<br>"),
                    (p += "• Consider shade cloth for critical areas")) :
                ((p += '<div style="color: #92400e; font-weight: 600; margin-bottom: 6px;">'),
                    (p += "⚠️ Mixed stand heat stress - C3 component at risk</div>"),
                    (p += "• C3 grass in mix is stressed, C4 is thriving<br>"),
                    (p += "• Increase irrigation to support C3 component<br>"),
                    (p += y ?
                        "• Light syringing during peak heat<br>" :
                        '• <span style="color: #dc2626;">⚠️ Skip syringing - extended leaf wetness increases disease</span><br>'),
                    (p += "• Expect C4 to become more dominant<br>"),
                    (p += "• This is natural summer transition for mixed stands"));
        }
    else
        ((p += '<div style="color: #065f46; font-weight: 600; margin-bottom: 6px;">'),
            (p += "✅ IDEAL conditions for warm-season grass!</div>"),
            (p += "• C4 grass thrives at these temperatures<br>"),
            (p += "• Growth potential at peak - excellent recovery conditions<br>"),
            (p += "• Maintain normal summer irrigation schedule<br>"),
            (p += "• Perfect conditions for wear recovery and establishment"));
    return (
        (p += "</div>"),
        a &&
        i.notes &&
        ((p +=
                '<div style="margin-top: 8px; padding: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">'),
            (p += "💡 <strong>Note:</strong> " + i.notes),
            (p += "</div>")),
        (p += "</div>")
    );
}

function generateGrowthChart(e) {
    // Fallback to climateMetrics when growthData is not wired through
    var cm = window.climateMetrics;
    // FIX v10.9.6: use current hour temp from rawWeatherData for the chart marker,
    // not cm.temperature.mean (7-day daily mean ~18.9°C).
    var _chartHour = (function() {
        var raw = window.rawWeatherData;
        if (raw && raw.forecast && raw.forecast.hourly && raw.forecast.hourly.temperature_2m) {
            var h = new Date().getHours();
            var arr = raw.forecast.hourly.temperature_2m;
            if (h < arr.length && arr[h] != null) return arr[h];
        }
        return null;
    })();
    var t = e?.temperature ?? _chartHour ?? cm?.temperature?.todayMean ?? cm?.temperature?.mean ?? 20;
    // Always calculate from temperature — never trust default c3potential/c4potential
    // as they may be stale 50/50 fallbacks from uninitialised nitrogen results
    var x = calcC3GrowthPotential(t);
    var w = calcC4GrowthPotential(t);
    // Override with explicit values only if they came from actual calculation (not defaults)
    if (e?.c3potential != null && e?.c3potential !== 50) x = e.c3potential;
    if (e?.c4potential != null && e?.c4potential !== 50) w = e.c4potential;
    if (cm?.growth?.c3 != null && cm.growth.c3 !== 50) x = cm.growth.c3;
    if (cm?.growth?.c4 != null && cm.growth.c4 !== 50) w = cm.growth.c4;
    // Last resort: if still 50/50 defaults and we have a temp, calculate from temp
    if (x === 50 && w === 50 && t !== 20) {
        x = calcC3GrowthPotential(t);
        w = calcC4GrowthPotential(t);
    }
    var r = 600,
        n = 220,
        i = 50,
        a = 20,
        o = 30,
        s = 40,
        l = r - i - a,
        d = n - o - s,
        c = -5,
        p = [],
        g = [];
    for (var u = c; u <= 45; u += 1) {
        var m = i + ((u - c) / 50) * l,
            f = o + d - (calcC3GrowthPotential(u) / 100) * d,
            y = o + d - (calcC4GrowthPotential(u) / 100) * d;
        (p.push(m.toFixed(1) + "," + f.toFixed(1)), g.push(m.toFixed(1) + "," + y.toFixed(1)));
    }
    var h,
        v,
        b = i + ((t - c) / 50) * l;
    return `\n        <div style="margin: 15px 0; padding: 15px; background: var(--gaip-surface-muted); border: 1px solid var(--gaip-border); border-radius: 6px;">\n            <div style="margin-bottom: 10px; font-size: 13px; font-weight: 600; color: var(--gaip-text);">\n                Growth Potential vs Temperature\n            </div>\n            \n            <svg viewBox="0 0 600 220" width="100%" style="display: block; max-width: 600px; margin: 0 auto;">\n                \x3c!-- Grid lines (horizontal) --\x3e\n                <line x1="${i}" y1="${o + 0.25 * d}" \n                      x2="${r - a}" y2="${o + 0.25 * d}" \n                      stroke="var(--gaip-border)" stroke-width="1" stroke-dasharray="3,3"/>\n                <line x1="${i}" y1="${o + 0.5 * d}" \n                      x2="${r - a}" y2="${o + 0.5 * d}" \n                      stroke="var(--gaip-border)" stroke-width="1" stroke-dasharray="3,3"/>\n                <line x1="${i}" y1="${o + 0.75 * d}" \n                      x2="${r - a}" y2="${o + 0.75 * d}" \n                      stroke="var(--gaip-border)" stroke-width="1" stroke-dasharray="3,3"/>\n                \n                \x3c!-- C3 line (blue) --\x3e\n                <polyline points="${p.join(" ")}" \n                          fill="none" stroke="#3b82f6" stroke-width="3"/>\n                \n                \x3c!-- C4 line (green) --\x3e\n                <polyline points="${g.join(" ")}" \n                          fill="none" stroke="#10b981" stroke-width="3"/>\n                \n                \x3c!-- Current temperature indicator (red dashed line) --\x3e\n                ${t >= c && t <= 45 ? `\n                <line x1="${b}" y1="${o}" \n                      x2="${b}" y2="${n - s}" \n                      stroke="#ef4444" stroke-width="2" stroke-dasharray="5,5"/>\n                ` : ""}\n                \n                \x3c!-- Axes --\x3e\n                <line x1="${i}" y1="${o}" \n                      x2="${i}" y2="${n - s}" \n                      stroke="var(--gaip-text-secondary)" stroke-width="2"/>\n                <line x1="${i}" y1="${n - s}" \n                      x2="${r - a}" y2="${n - s}" \n                      stroke="var(--gaip-text-secondary)" stroke-width="2"/>\n                \n                \x3c!-- Y-axis labels --\x3e\n                <text x="${i - 10}" y="${o + 5}" text-anchor="end" font-size="11" fill="var(--gaip-text-secondary)">100%</text>\n                <text x="${i - 10}" y="${o + 0.25 * d + 4}" text-anchor="end" font-size="11" fill="var(--gaip-text-secondary)">75%</text>\n                <text x="${i - 10}" y="${o + 0.5 * d + 4}" text-anchor="end" font-size="11" fill="var(--gaip-text-secondary)">50%</text>\n                <text x="${i - 10}" y="${o + 0.75 * d + 4}" text-anchor="end" font-size="11" fill="var(--gaip-text-secondary)">25%</text>\n                <text x="${i - 10}" y="${n - s + 4}" text-anchor="end" font-size="11" fill="var(--gaip-text-secondary)">0%</text>\n                \n                \x3c!-- X-axis labels --\x3e\n                ${[
    -5, 5, 15, 25, 35, 45,
  ]
    .map(function (e) {
      return (
        '<text x="' +
        (i + ((e - c) / 50) * l) +
        '" y="' +
        (n - s + 20) +
        '" text-anchor="middle" font-size="11" fill="var(--gaip-text-secondary)">' +
        e +
        "°C</text>"
      );
    })
    .join(
      "",
    )}\n                \n                \x3c!-- Current temp label at TOP of line --\x3e\n                ${t >= c && t <= 45 ? `\n                <rect x="${b - 24}" y="${o - 18}" \n                      width="48" height="16" rx="3" fill="#ef4444"/>\n                <text x="${b}" y="${o - 6}" text-anchor="middle" font-size="10" fill="white" font-weight="600">\n                    ${t.toFixed(1)}°C\n                </text>\n                ` : ""}\n                \n                \x3c!-- Axis titles --\x3e\n                <text x="300" y="215" text-anchor="middle" font-size="12" font-weight="600" fill="var(--gaip-text)">\n                    Temperature (°C)\n                </text>\n                <text x="${i - 35}" y="110" text-anchor="middle" \n                      transform="rotate(-90 ${i - 35} 110)" \n                      font-size="12" font-weight="600" fill="var(--gaip-text)">\n                    Growth Potential (%)\n                </text>\n            </svg>\n            \n            \x3c!-- Legend --\x3e\n            <div style="display: flex; gap: 20px; justify-content: center; margin-top: 15px; font-size: 12px;">\n                <div style="display: flex; align-items: center; gap: 5px;">\n                    <div style="width: 20px; height: 3px; background: #3b82f6;"></div>\n                    <span>C3 Cool-Season (${x.toFixed(0)}% GP)</span>\n                </div>\n                <div style="display: flex; align-items: center; gap: 5px;">\n                    <div style="width: 20px; height: 3px; background: #10b981;"></div>\n                    <span>C4 Warm-Season (${w.toFixed(0)}% GP)</span>\n                </div>\n            </div>\n            \n\x3c!-- Key insights - now forecast-aware --\x3e\n            <div style="margin-top: 12px; padding: 10px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 11px; color: #1e40af;">\n                <strong>Key Insight:</strong> \n                ${((h = void 0 !== window.climateMetrics && window.climateMetrics?.stress?.heat?.days > 0), (v = window.climateMetrics?.stress?.heat?.maxTemp || t), h && v > 30 ? "Heat event forecast (" + v.toFixed(1) + "°C peak) - C3 stress expected." : t < 10 ? "C4 grasses are dormant - C3 dominant in mixed stands." : t > 30 ? "C3 grasses are heat-stressed - C4 grasses dominating." : t >= 15 && t <= 25 ? "Optimal C3 growth range - cool-season grasses thriving." : "Transition zone - both grass types moderately active.")}\n            </div>\n            \n            \x3c!-- OVERSEED-AWARE HEAT ALERTS --\x3e\n            ${void 0 !== window.climateMetrics && void 0 !== window.currentState ? generateOverseedHeatAlert(window.climateMetrics, window.currentState) : ""}\n        </div>\n    </div>\n    `;
}

function generateSeasonalNPlan(e, t) {
    if (!t || typeof t.baseOptimum !== "number") {
        return '<div style="padding: 10px; color: var(--gaip-text-secondary); font-size: 12px;">Seasonal N plan unavailable - nitrogen diagnostics incomplete.</div>';
    }
    var r,
        n,
        i = e.hemi || "southern",
        a = e.turf.warmBase || "",
        o = e.turf.coolOverseed || "";
    a && o ?
        ((r = safeNum(e.turf.percentC3Cover, 70) / 100), (n = 1 - r)) :
        o && !a ?
        ((r = 1), (n = 0)) :
        a && !o ?
        ((r = 0), (n = 1)) :
        ((r = 0.7), (n = 0.3));
    var s,
        l = new Date().getMonth();
    s =
        "southern" === i ?
        [{
            name: "Summer (Dec-Feb)",
            avgTemp: 25,
            months: "Dec-Feb",
            monthRange: [11, 0, 1],
        }, {
            name: "Autumn (Mar-May)",
            avgTemp: 18,
            months: "Mar-May",
            monthRange: [2, 3, 4],
        }, {
            name: "Winter (Jun-Aug)",
            avgTemp: 10,
            months: "Jun-Aug",
            monthRange: [5, 6, 7],
        }, {
            name: "Spring (Sep-Nov)",
            avgTemp: 18,
            months: "Sep-Nov",
            monthRange: [8, 9, 10],
        }, ] :
        [{
            name: "Winter (Dec-Feb)",
            avgTemp: 5,
            months: "Dec-Feb",
            monthRange: [11, 0, 1],
        }, {
            name: "Spring (Mar-May)",
            avgTemp: 15,
            months: "Mar-May",
            monthRange: [2, 3, 4],
        }, {
            name: "Summer (Jun-Aug)",
            avgTemp: 25,
            months: "Jun-Aug",
            monthRange: [5, 6, 7],
        }, {
            name: "Autumn (Sep-Nov)",
            avgTemp: 15,
            months: "Sep-Nov",
            monthRange: [8, 9, 10],
        }, ];
    var d = null,
        c = !1,
        p = "default seasonal averages";
    if (window.rawWeatherData && window.rawWeatherData.daily) {
        var g = window.rawWeatherData.daily;
        if (g.temperature_2m_max && g.temperature_2m_min && g.temperature_2m_max.length > 0) {
            for (var u = 0, m = 0, f = 0; f < g.temperature_2m_max.length; f++) {
                ((u += (g.temperature_2m_max[f] + g.temperature_2m_min[f]) / 2), m++);
            }
            m > 0 && ((c = !0), (p = m + "-day forecast (avg " + (d = u / m).toFixed(1) + "°C)"));
        }
    }
    if (!c && window.climateMetrics && window.climateMetrics.temperature) {
        var y = window.climateMetrics.temperature;
        (y.mean || y.current) && ((c = !0), (p = "current conditions (" + (d = y.mean || y.current).toFixed(1) + "°C)"));
    }
    c &&
        null !== d &&
        (s = s.map(function(e) {
            return (-1 !== e.monthRange.indexOf(l) && ((e.avgTemp = d), (e.isActual = !0)), e);
        }));
    var h = s.map(function(e) {
            var t = calcMixedGrowthPotential(e.avgTemp, r, n),
                i = -1 !== e.monthRange.indexOf(l);
            return {
                season: e.name,
                months: e.months,
                temp: e.avgTemp,
                growth: t,
                growthWeighted: t.weighted,
                isCurrent: i,
                isActual: e.isActual || !1,
            };
        }),
        v = h.reduce(function(e, t) {
            return e + t.growthWeighted;
        }, 0),
        b = t.baseOptimum,
        x = safeNum(e.turf.hoc, 25);
    x < 15 ? (b *= 1.15) : x < 25 ? (b *= 1.05) : x > 35 && (b *= 0.9);
    var w = (h = h.map(function(e) {
            var t = e.growthWeighted / v,
                r = b * t;
            return {
                season: e.season,
                months: e.months,
                temp: e.temp,
                growth: e.growth,
                nSeasonal: r,
                percentOfAnnual: 100 * t,
                isCurrent: e.isCurrent,
                isActual: e.isActual,
            };
        })).reduce(function(e, t) {
            return t.nSeasonal > e.nSeasonal ? t : e;
        }),
        S = (h = h.map(function(e) {
            return ((e.percentOfPeak = (e.nSeasonal / w.nSeasonal) * 100), e);
        }))
        .map(function(e) {
            var t = e.season === w.season,
                r = e.isCurrent,
                n = t ? "background: var(--gaip-good-bg); font-weight: 600;" : r ? "background: var(--gaip-info-bg);" : "",
                i = e.isActual ? ' <span style="color:#059669;font-size:10px;">✓</span>' : "";
            return (
                '<tr style="' +
                n +
                '"><td style="padding: 8px; border-bottom: 1px solid var(--gaip-surface-hover);">' +
                e.season +
                (t ? " ⭐" : "") +
                (r ? " 📍" : "") +
                '</td><td style="padding: 8px; text-align: center; border-bottom: 1px solid var(--gaip-surface-hover);">' +
                e.temp.toFixed(0) +
                "°C" +
                i +
                '</td><td style="padding: 8px; text-align: center; border-bottom: 1px solid var(--gaip-surface-hover);">' +
                e.growth.weighted.toFixed(0) +
                '%</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid var(--gaip-surface-hover);">' +
                e.nSeasonal.toFixed(0) +
                ' kg/ha</td><td style="padding: 8px; text-align: center; border-bottom: 1px solid var(--gaip-surface-hover);">' +
                e.percentOfAnnual.toFixed(0) +
                "%</td></tr>"
            );
        })
        .join(""),
        C = h.reduce(function(e, t) {
            return t.growth.weighted < e.growth.weighted ? t : e;
        });
    return (
        '<div style="margin: 15px 0;"><table style="width: 100%; border-collapse: collapse; font-size: 12px;"><thead style="background: var(--gaip-surface-hover);"><tr><th style="padding: 8px; text-align: left; border-bottom: 2px solid var(--gaip-border);">Season</th><th style="padding: 8px; text-align: center; border-bottom: 2px solid var(--gaip-border);">Avg Temp</th><th style="padding: 8px; text-align: center; border-bottom: 2px solid var(--gaip-border);">Growth</th><th style="padding: 8px; text-align: right; border-bottom: 2px solid var(--gaip-border);">Seasonal N</th><th style="padding: 8px; text-align: center; border-bottom: 2px solid var(--gaip-border);">% of Annual</th></tr></thead><tbody>' +
        S +
        '</tbody></table><div style="margin-top: 10px; font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">📍 Current season ' +
        (c ? "• ✓ Using " + p : "• Using default seasonal averages") +
        '</div><div style="margin-top: 15px; padding: 10px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 11px;"><strong>Annual Planning Strategy:</strong><br>• <strong>Annual N budget:</strong> ' +
        b.toFixed(0) +
        " kg/ha/yr<br>• <strong>Peak demand:</strong> " +
        w.season +
        " (" +
        w.nSeasonal.toFixed(0) +
        " kg/ha, " +
        w.percentOfAnnual.toFixed(0) +
        "% of annual)<br>• <strong>Reduce applications:</strong> " +
        C.season.split("(")[0] +
        " when growth drops to " +
        C.growth.weighted.toFixed(0) +
        "%</div></div>"
    );
}

function generateRecoveryCalendar(e, t, r) {
    var n = t.matches || 0,
        i = t.sessions || 0,
        a = 7,
        o = null,
        s = 7,
        l = null,
        d = e.turf?.variety || "generic",
        c = !1,
        p = "generic" !== d,
        g = !!(e.climate?.growthPotential || e.turf?.growthMultiplier || t.growthMultiplier),
        u = !!e.turf?.rootDepth,
        m = !(!e.soil?.LOI && !e.soil?.OM_pct),
        f = !(void 0 === e.shade?.stressFactor);
    if (r && r.recoveryCapacity) {
        var y = r.recoveryCapacity;
        ((a = y.days || y.recoveryDays || 7),
            (o = y.modifiers || null),
            (s = y.baseDays || 7),
            (l = y.baseRating || null),
            (c = g));
    } else t.recoveryWindow && (a = t.recoveryWindow);
    var h = new Date(),
        v = [],
        b = [];
    n >= 7 ?
        (b = [0, 1, 2, 3, 4, 5, 6]) :
        n >= 4 ?
        (b = [0, 2, 4, 6]) :
        3 === n ?
        (b = [0, 3, 5]) :
        2 === n ?
        (b = [0, 3]) :
        1 === n && (b = [0]);
    var x = [];
    if (i > 0)
        for (
            var w = [0, 1, 2, 3, 4, 5, 6].filter(function(e) {
                    return -1 === b.indexOf(e);
                }),
                S = [1, 2, 4, 5, 3, 6, 0].filter(function(e) {
                    return -1 !== w.indexOf(e);
                }),
                C = 0; C < Math.min(i, S.length); C++
        )
            x.push(S[C]);
    for (var M = 0; M < 4; M++) {
        for (var I = [], k = 0; k < 7; k++) {
            var A = new Date(h);
            A.setDate(h.getDate() + 7 * M + k);
            var E = -1 !== b.indexOf(k),
                N = -1 !== x.indexOf(k),
                T = E ? "match" : N ? "training" : "rest";
            I.push({
                date: A.getDate(),
                dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][k],
                status: T,
            });
        }
        v.push(I);
    }
    var P =
        '<div style="margin: 15px 0;"><div style="margin-bottom: 10px; font-size: 13px; font-weight: 600; color: var(--gaip-text);">4-Week Traffic Schedule (' +
        n +
        " matches, " +
        i +
        " sessions/week)</div>";
    (v.forEach(function(e) {
            ((P += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px;">'),
                e.forEach(function(e) {
                    var t = "match" === e.status ? "#fca5a5" : "training" === e.status ? "var(--gaip-warning-border)" : "var(--gaip-good-bg)",
                        r = "match" === e.status ? "#7f1d1d" : "training" === e.status ? "#78350f" : "#065f46";
                    P +=
                        '<div style="padding: 6px; background: ' +
                        t +
                        "; border-radius: 4px; text-align: center; font-size: 11px; color: " +
                        r +
                        ';"><div style="font-weight: 600;">' +
                        e.dayName +
                        "</div><div>" +
                        e.date +
                        "</div></div>";
                }),
                (P += "</div>"));
        }),
        (P +=
            '<div style="display: flex; gap: 15px; margin-top: 12px; font-size: 11px;"><div style="display: flex; align-items: center; gap: 5px;"><div style="width: 15px; height: 15px; background: #fca5a5; border-radius: 3px;"></div><span>Match Day</span></div><div style="display: flex; align-items: center; gap: 5px;"><div style="width: 15px; height: 15px; background: var(--gaip-warning-border); border-radius: 3px;"></div><span>Training</span></div><div style="display: flex; align-items: center; gap: 5px;"><div style="width: 15px; height: 15px; background: var(--gaip-good-bg); border-radius: 3px;"></div><span>Rest/Recovery</span></div></div>'));
    var R = Math.min(n, 7),
        $ = R > 0 ? parseFloat((7 / R).toFixed(1)) : 7,
        F = Math.max(0, a - $),
        _ = F > 0,
        D = $ >= a,
        G = $ >= 1.3 * a;
    if (
        ((P +=
                '<div style="margin-top: 15px; padding: 12px; background: ' +
                (_ ? "var(--gaip-critical-bg)" : G ? "var(--gaip-good-bg)" : "var(--gaip-warning-bg)") +
                '; border-radius: 6px;"><strong style="font-size: 12px;">Recovery Window Analysis</strong>'),
            (P +=
                '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;"><div><div style="font-size: 22px; font-weight: 700; color: ' +
                (_ ? "#dc2626" : G ? "#059669" : "#92400e") +
                ';">' +
                Math.round(a) +
                ' days</div><div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">recovery needed</div></div><div><div style="font-size: 22px; font-weight: 700; color: ' +
                (_ ? "#dc2626" : "#059669") +
                ';">' +
                $ +
                ' days</div><div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">available (schedule)</div></div></div>'),
            _)
    )
        P +=
        '<div style="margin-top: 10px; padding: 6px 8px; background: var(--gaip-critical-bg); border-radius: 4px; font-size: 11px; color: #991b1b;"><strong>⚠ ' +
        Math.round(F) +
        " day shortfall</strong> — field degradation likely without intervention</div>";
    else if (G) {
        var L = Math.round($ - a);
        P +=
            '<div style="margin-top: 10px; padding: 6px 8px; background: var(--gaip-good-bg); border-radius: 4px; font-size: 11px; color: #065f46;"><strong>✓ Schedule sustainable</strong> — ' +
            L +
            " day buffer for unexpected events</div>";
    } else
        P +=
        '<div style="margin-top: 10px; padding: 6px 8px; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 11px; color: #92400e;"><strong>⚠ Tight margins</strong> — schedule works but no buffer for delays</div>';
    if (((P += "</div>"), o || p)) {
        ((P +=
                '<div style="margin-top: 10px; padding: 10px; background: var(--gaip-surface-muted); border-radius: 6px; font-size: 11px;"><strong>Recovery Modifiers</strong>'),
            (P +=
                p && l ?
                '<div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin: 6px 0;">Base: ' +
                Math.round(s) +
                " days (" +
                d +
                " NTEP rating " +
                l.toFixed(1) +
                ")</div>" :
                p ?
                '<div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin: 6px 0;">Variety: ' +
                d +
                "</div>" :
                '<div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin: 6px 0;">Using generic defaults (no variety selected)</div>'));
        var O = [],
            z = [];
        if (o) {
            if (g) {
                var H = Math.round(100 * (o.growth - 1)),
                    q = H > 0 ? "penalty" : H < 0 ? "bonus" : "neutral",
                    W = H > 0 ? "+" + H + "% slower" : H < 0 ? Math.abs(H) + "% faster" : "No penalty",
                    U =
                    (window.climateMetrics && window.climateMetrics.growth && window.climateMetrics.growth.weighted) ||
                    e.climate?.growthPotential ||
                    e.turf?.growthMultiplier ||
                    t.growthMultiplier,
                    B = U ? "GP " + Math.round(U > 1 ? U : 100 * U) + "%" : "climate";
                O.push({
                    label: "Growth conditions",
                    value: W,
                    cls: q,
                    source: B,
                });
            } else z.push("growth potential");
            if (f || 1 !== o.shade) {
                var j = Math.round(100 * (o.shade - 1)),
                    V = j > 0 ? "+" + j + "% slower" : "No penalty";
                O.push({
                    label: "Shade stress",
                    value: V,
                    cls: j > 0 ? "penalty" : "neutral",
                    source: "shade engine",
                });
            }
            if (u) {
                var K = Math.round(100 * (o.rootDepth - 1)),
                    Y = K > 0 ? "+" + K + "% slower" : K < 0 ? Math.abs(K) + "% faster" : "No penalty",
                    Z = e.turf.rootDepth + "mm";
                O.push({
                    label: "Root depth",
                    value: Y,
                    cls: K > 0 ? "penalty" : K < 0 ? "bonus" : "neutral",
                    source: Z,
                });
            } else z.push("root depth");
            if (m) {
                var J = Math.round(100 * (o.soilHealth - 1)),
                    Q = J > 0 ? "+" + J + "% slower" : J < 0 ? Math.abs(J) + "% faster" : "No penalty",
                    X = "OM " + (e.soil?.LOI || e.soil?.OM_pct).toFixed(1) + "%";
                O.push({
                    label: "Soil health",
                    value: Q,
                    cls: J > 0 ? "penalty" : J < 0 ? "bonus" : "neutral",
                    source: X,
                });
            } else z.push("soil OM");
            var ee = o.nitrogen;
            if (ee && "default" !== ee.source) {
                var te = Math.round(100 * (ee.factor - 1)),
                    re = te > 0 ? "+" + te + "% slower" : te < 0 ? Math.abs(te) + "% faster" : "No penalty",
                    ne =
                    "tissue" === ee.source ?
                    "tissue N" :
                    "n_rate" === ee.source ?
                    "N rate" :
                    "om_estimate" === ee.source ?
                    "OM estimate" :
                    "";
                O.push({
                    label: "N availability",
                    value: re,
                    cls: te > 0 ? "penalty" : te < 0 ? "bonus" : "neutral",
                    source: ne,
                });
            } else(ee && "default" !== ee.source) || z.push("N status");
            if (o.salinity && o.salinity.factor > 1) {
                var ie = "+" + Math.round(100 * (o.salinity.factor - 1)) + "% slower",
                    ae = o.salinity.note || "ECw stress";
                O.push({
                    label: "Salinity stress",
                    value: ie,
                    cls: "penalty",
                    source: ae,
                });
            }
            if (o.temperatureStress && o.temperatureStress.factor > 1) {
                var oe = "+" + Math.round(100 * (o.temperatureStress.factor - 1)) + "% slower",
                    se = o.temperatureStress.esi || 0;
                O.push({
                    label: "Environmental stress",
                    value: oe,
                    cls: "penalty",
                    source: "ESI " + Math.round(se),
                });
            }
        }
        O.length > 0 &&
            O.forEach(function(e) {
                var t = "penalty" === e.cls ? "#dc2626" : "bonus" === e.cls ? "#059669" : "var(--gaip-text-secondary)";
                P +=
                    '<div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--gaip-surface); border-radius: 4px; margin-top: 4px;"><span style="color: var(--gaip-text);">' +
                    e.label +
                    '</span><div style="display: flex; align-items: center; gap: 8px;"><span style="font-weight: 600; color: ' +
                    t +
                    ';">' +
                    e.value +
                    "</span>" +
                    (e.source ? '<span style="font-size: 9px; ">' + e.source + "</span>" : "") +
                    "</div></div>";
            });
        var le =
            window.GaipOrchestrator && window.GaipOrchestrator.getComputed ?
            window.GaipOrchestrator.getComputed("wear") :
            null,
            de = le ? le.adjustedRecovery : null;
        (de &&
            de.adjustments &&
            de.adjustments.length > 0 &&
            ((P +=
                    '<div style="border-top: 1px dashed var(--gaip-border); margin: 8px 0; padding-top: 8px;"><div style="font-size: 10px; color: #92400e; font-weight: 600; margin-bottom: 4px;">⚠️ Environmental Stress Impact</div>'),
                de.adjustments.forEach(function(e) {
                    var t = "•",
                        r = "#d97706";
                    ("shade" === e.factor ?
                        ((t = "☁️"), (r = "#6366f1")) :
                        "salinity" === e.factor ?
                        ((t = "💧"), (r = "#0891b2")) :
                        "temperature" === e.factor ?
                        ((t = "🌡️"), (r = "#dc2626")) :
                        "compound" === e.factor && ((t = "⚠️"), (r = "#7c3aed")),
                        (P +=
                            '<div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: var(--gaip-warning-bg); border-radius: 4px; margin-top: 3px;"><span style="color: var(--gaip-text);">' +
                            t +
                            " " +
                            (e.modification || e.factor) +
                            '</span><span style="font-weight: 600; color: ' +
                            r +
                            ';">' +
                            e.effect +
                            "</span></div>"));
                }),
                (P +=
                    '<div style="font-size: 10px; color: #92400e; margin-top: 6px;">Recovery: ' +
                    de.baseProbability +
                    "% → " +
                    de.adjustedProbability +
                    "% | " +
                    de.baseDays +
                    "d → " +
                    de.adjustedDays +
                    "d</div>"),
                de.warning &&
                (P +=
                    '<div style="font-size: 10px; color: #dc2626; margin-top: 4px; font-style: italic;">' +
                    de.warning +
                    "</div>"),
                (P += "</div>")),
            z.length > 0 &&
            (P +=
                '<div style="font-size: 10px;  margin-top: 8px; font-style: italic;">Missing: ' +
                z.join(", ") +
                " — using defaults</div>"),
            (P += "</div>"));
    }
    P +=
        '<div style="margin-top: 10px; padding: 10px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 11px;"><strong>Recommendations</strong>';
    if (
        (_ &&
            (P +=
                '<div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--gaip-info-bg);"><div style="width: 18px; height: 18px; border-radius: 50%; background: var(--gaip-critical-bg); color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">!</div><div><div style="color: var(--gaip-text);"><strong>Reduce match frequency</strong> to 1 per ' +
                Math.ceil(a) +
                '+ days, or accept progressive wear</div><div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: 2px;">Current schedule provides only ' +
                $ +
                " days between high-load events</div></div></div>"),
            o &&
            o.growth > 1.3 &&
            _ &&
            (P +=
                '<div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--gaip-info-bg);"><div style="width: 18px; height: 18px; border-radius: 50%; background: var(--gaip-warning-bg); color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">—</div><div><div style="color: var(--gaip-text);"><strong>Deploy LED grow lights</strong> to boost effective GP during dormancy</div><div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: 2px;">Target 15+ mol/m²/day supplemental DLI to halve recovery time</div></div></div>'),
            _ && n >= 2)
    ) {
        0;
        var ce = Math.ceil(a / $);
        P +=
            '<div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--gaip-info-bg);"><div style="width: 18px; height: 18px; border-radius: 50%; background: var(--gaip-warning-bg); color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">🔄</div><div><div style="color: var(--gaip-text);"><strong>Zone rotation</strong> — divide field into ' +
            ce +
            ' sections</div><div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: 2px;">Rotate high-wear activities weekly to give each zone ' +
            Math.round($ * ce) +
            " days rest</div></div></div>";
    }
    if (!c || !p) {
        0;
        var pe = [];
        (p || pe.push("variety selection"),
            c || pe.push("climate module"),
            (P +=
                '<div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 0;"><div style="width: 18px; height: 18px; border-radius: 50%; background: var(--gaip-info-bg); color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">📋</div><div><div style="color: var(--gaip-text);">Enable ' +
                pe.join(" and ") +
                ' for more accurate estimates</div><div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: 2px;">Recovery time varies significantly with growth conditions and variety genetics</div></div></div>'));
    }
    return (
        D &&
        !_ &&
        (P +=
            '<div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 0;"><div style="width: 18px; height: 18px; border-radius: 50%; background: var(--gaip-good-bg); color: #059669; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0;">✓</div><div><div style="color: var(--gaip-text);">Current schedule is sustainable</div><div style="font-size: 10px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: 2px;">Monitor growth potential — recovery time increases as GP drops below 50%</div></div></div>'),
        (P += "</div></div>")
    );
}

function gaip_render_results(e, t, r, n, i, a, o, s, l, d) {
    var c = !1 !== document.querySelector(".gaip-enable-soil-water")?.checked,
        p = !1 !== document.querySelector(".gaip-enable-turf-traffic")?.checked,
        g = !1 !== document.querySelector(".gaip-enable-shade")?.checked,
        u = document.querySelector(".gaip-mlsn-body"),
        m = document.querySelector(".gaip-water-body"),
        f = document.querySelector(".gaip-traffic-body"),
        y = document.querySelector(".gaip-tissue-body"),
        h = document.querySelector(".gaip-shade-body"),
        v = document.querySelector(".gaip-growth-body"),
        b = document.querySelector(".gaip-seasonal-body"),
        x = document.querySelector(".gaip-calendar-body");
    if (u && m && f && h) {
        var w = [],
            S = ["couch", "bermuda", "kikuyu", "buffalo", "zoysia", "seashore paspalum", "santa anna"].some(function(t) {
                return (e.turf?.grassSpecies || "").toLowerCase().includes(t);
            }),
            C = e.turf?.percentC3Cover || 0,
            M = e.turf?.coolOverseed || "",
            // v9.9.1: Also check if effectiveSpecies is already set to a C3 species
            effectiveIsC3 =
            e.turf?.effectiveSpecies && ["ryegrass", "fescue", "bluegrass", "bentgrass", "poa"].some(function(c3) {
                return (e.turf.effectiveSpecies || "").toLowerCase().includes(c3);
            });
        S &&
            C > 50 &&
            !M &&
            !effectiveIsC3 &&
            w.push({
                type: "warning",
                title: "Overseed species not selected",
                message: "You have " +
                    C +
                    '% C3 cover on a C4 base but no overseed species selected. PGR calculations are using the base grass (couch) which may be incorrect. Select "Perennial Ryegrass" in the Overseed Species dropdown if ryegrass is present.',
            });
        var I = document.querySelector(".gaip-results"),
            k = document.getElementById("gaip-validation-warnings");
        if ((k && k.remove(), w.length > 0 && I)) {
            var A = '<div id="gaip-validation-warnings" style="margin-bottom: 15px;">';
            (w.forEach(function(e) {
                    A +=
                        '<div style="background: var(--gaip-warning-bg); border: 1px solid #f59e0b; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px; margin-bottom: 10px;"><div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">⚠️ ' +
                        e.title +
                        '</div><div style="font-size: 13px; color: #78350f;">' +
                        e.message +
                        "</div></div>";
                }),
                (A += "</div>"),
                I.insertAdjacentHTML("afterbegin", A));
        }
        var E = document.getElementById("gaip-climate-status-banner");
        if (E) {
            var N = e.turf?.grassSpecies || "",
                T = window.climateMetrics;
            if (T && T.temperature) {
                var P = window.climateStatusSummary || generateClimateStatusSummary(T, N, e),
                    R = document.getElementById("gaip-climate-icon"),
                    $ = document.getElementById("gaip-climate-summary");
                (R && (R.textContent = P.icon), $ && ($.textContent = P.text));
                var F = "#0ea5e9",
                    _ = "linear-gradient(135deg, var(--gaip-info-bg) 0%, var(--gaip-info-bg) 100%)";
                ("critical" === P.class ?
                    ((F = "#ef4444"), (_ = "linear-gradient(135deg, var(--gaip-critical-bg) 0%, var(--gaip-critical-bg) 100%)")) :
                    "concern" === P.class ?
                    ((F = "#f97316"), (_ = "linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-bg) 100%)")) :
                    "watch" === P.class ?
                    ((F = "#f59e0b"), (_ = "linear-gradient(135deg, var(--gaip-warning-bg) 0%, var(--gaip-warning-bg) 100%)")) :
                    "good" === P.class && ((F = "#22c55e"), (_ = "linear-gradient(135deg, var(--gaip-good-bg) 0%, var(--gaip-good-bg) 100%)")),
                    (E.style.borderLeftColor = F),
                    (E.style.background = _),
                    (E.style.display = "block"));
            } else E.style.display = "none";
        }
        var D = document.querySelector('[data-section="mlsn"]'),
            G = document.querySelector('[data-section="water"]'),
            L = document.querySelector('[data-section="traffic"]'),
            O = document.querySelector('[data-section="shade"]');
        (D && (D.style.display = c ? "block" : "none"),
            G && (G.style.display = c ? "block" : "none"),
            L && (L.style.display = p ? "block" : "none"),
            O && (O.style.display = g ? "block" : "none"));
        if (
            o &&
            o.growthData &&
            typeof o.applied === "number" &&
            typeof o.opt === "number" &&
            typeof o.baseOptimum === "number"
        ) {
            var z = o.status || "Unknown",
                H = o.growthData,
                q =
                (H.weighted ?? 50) >= 80 ?
                "Optimal growth - full N uptake capacity" :
                (H.weighted ?? 50) >= 60 ?
                "Good growth - near-optimal N demand" :
                (H.weighted ?? 50) >= 40 ?
                "Moderate growth - reduced N uptake" :
                (H.weighted ?? 50) >= 20 ?
                "Slow growth - minimal N demand" :
                "Dormant/stressed - very low N uptake";
            ir(
                "N-Program Adequacy (Growth-Adjusted)",
                `\n            <p><strong>Status:</strong> ${z}</p>\n            <p><strong>Applied N:</strong> ${o.applied.toFixed(1)} kg/ha/yr</p>\n            <p><strong>Current optimal N:</strong> ${o.opt.toFixed(1)} kg/ha/yr</p>\n            <p><strong>Base optimal (at peak growth):</strong> ${o.baseOptimum.toFixed(1)} kg/ha/yr</p>\n            \n            <div style="margin: 10px 0; padding: 8px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px;">\n                <strong>Growth Adjustment:</strong><br>\n                <span style="font-size: 12px;">\n                    Temperature: ${(H.temperature ?? 20).toFixed(1)}°C | \n                    ${H.c3potential != null ? "C3 Growth: " + H.c3potential.toFixed(0) + "%" : ""}${H.c3potential != null && H.c4potential != null ? " | " : ""}${H.c4potential != null ? "C4 Growth: " + H.c4potential.toFixed(0) + "%" : ""}<br>\n                    ${q}\n                </span>\n            </div>\n\n            <hr>\n\n            <p><strong>What this metric represents</strong><br>\n            N-optimum is adjusted by current growth potential. At optimal temperature, grass uses full N rate. \n            During dormancy or stress, N uptake drops significantly - excess N leads to waste, leaching, and surface issues.</p>\n\n            <p><strong>Traffic load × N interaction</strong><br>\n            Under-N → thinning, reduced shear strength, slow divot repair.<br>\n            Adequate-N → stable density under load.<br>\n            Over-N → deformation rises, softness increases.</p>\n\n            <p><strong>Recommended adjustments</strong><br>\n            If insufficient: raise N toward current optimum (${o.opt.toFixed(0)} kg/ha/yr); reduce PGR suppression.<br>\n            If excessive: reduce N applications, especially during low-growth periods.<br>\n            ${(H.weighted ?? 50) < 30 ? "<strong>⚠ Currently dormant/stressed - significantly reduce N inputs.</strong>" : ""}</p>\n\n            <p><strong>Over-fertilisation risks</strong><br>\n            Surface softening, thatch swelling, inconsistent PGR response, nutrient leaching.</p>\n        `,
            );
        } else
            /* Ndiag incomplete — no soil data entered, expected pre-analysis */
            ir(
                "N-Program Adequacy (Growth-Adjusted)",
                '\n            <p style="color: #dc2626;">N-Program calculation failed. Check console for details.</p>\n        ',
            );
        ir(
            "Firmness Index (FI)",
            `\n        <p><strong>FI score:</strong> ${(100 * (a?.FI ?? 0.5)).toFixed(0)} / 100</p>\n        <p><strong>Softness risk:</strong> ${(a?.softnessRisk ?? 0).toFixed(0)}%</p>\n        <p><strong>Class:</strong> ${a?.softnessClass ?? "Unknown"}</p>\n\n        <hr>\n\n        <p><strong>Meaning of FI</strong><br>\n        Composite indicator of shear stability and deformation resistance under stud pressure.\n        Lower FI = softer, more deformable profile.</p>\n\n        <p><strong>Critical thresholds</strong><br>\n        FI < 35 → high softness risk.<br>\n        FI 35–45 → marginal.<br>\n        FI > 45 → acceptable for scheduled use.</p>\n\n        <p><strong>Recommended operational adjustments</strong><br>\n        • Increase venting / drying cycles when FI drops.<br>\n        • Reduce N if softness persists.<br>\n        • Apply light rolling to stabilise upper profile.<br>\n        • Increase rest spacing when FI < 0.40.</p>\n    `,
        );
        var W =
            i.TrafficRisk > 10 ?
            "SEVERE (>10)" :
            i.TrafficRisk > 7 ?
            "HIGH (7-10)" :
            i.TrafficRisk > 5 ?
            "MODERATE-HIGH (5-7)" :
            i.TrafficRisk > 3 ?
            "MODERATE (3-5)" :
            "LOW (<3)",
            U = i.growthData ?
            `\n        <div style="margin: 10px 0; padding: 8px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px;">\n            <strong>Growth-Adjusted Recovery:</strong><br>\n            <span style="font-size: 12px;">\n                Temperature: ${(i.growthData.temperature ?? 20).toFixed(1)}°C | \n                Growth potential: ${(100 * (i.growthMultiplier ?? 0.5)).toFixed(0)}%<br>\n                Recovery rate adjusted by ${(100 * (i.growthWindowFactor ?? 1)).toFixed(0)}% \n                ${(i.growthWindowFactor ?? 1) > 1 ? "(slower due to low growth)" : (i.growthWindowFactor ?? 1) < 1 ? "(faster due to optimal growth)" : ""}\n            </span>\n        </div>\n    ` :
            "";
        if (d && d.summary) {
            var B = d,
                j = B.summary,
                V =
                "critical" === j.actionPriority || "high" === j.actionPriority ?
                "gaip-priority-high" :
                "medium" === j.actionPriority ?
                "gaip-priority-medium" :
                "gaip-priority-low",
                K =
                "critical" === j.stressStatus ?
                "gaip-stress-critical" :
                "stressed" === j.stressStatus ?
                "gaip-stress-stressed" :
                "stable" === j.stressStatus ?
                "gaip-stress-stable" :
                "gaip-stress-recovering",
                Y =
                j.capacityUtilisation > 100 ?
                "#c62828" :
                j.capacityUtilisation > 80 ?
                "#f57f17" :
                j.capacityUtilisation > 60 ?
                "#fbc02d" :
                "#4caf50",
                Z = "";
            if (B.weeklyLoad && B.weeklyLoad.components) {
                var J = B.weeklyLoad.components;
                Z = `\n                <table class="gaip-load-breakdown">\n                    <tr><th>Activity</th><th>Count</th><th>Hours</th><th>Wear Load</th></tr>\n                    <tr>\n                        <td>Matches (${J.matches?.sport || "soccer"})</td>\n                        <td>${J.matches?.count || 0}</td>\n                        <td>${(J.matches?.hours || 0).toFixed(1)}</td>\n                        <td>${(J.matches?.wearLoad || 0).toFixed(1)}</td>\n                    </tr>\n                    <tr>\n                        <td>Training (${J.training?.type || "drills"})</td>\n                        <td>${J.training?.count || 0}</td>\n                        <td>${(J.training?.hours || 0).toFixed(1)}</td>\n                        <td>${(J.training?.wearLoad || 0).toFixed(1)}</td>\n                    </tr>\n                    <tr style="font-weight: 600; background: var(--gaip-surface-muted);">\n                        <td colspan="2">Total Weekly</td>\n                        <td>${(B.weeklyLoad.totalHours || 0).toFixed(1)}</td>\n                        <td>${(B.weeklyLoad.totalWearLoad || 0).toFixed(1)}</td>\n                    </tr>\n                </table>\n            `;
            }
            var Q = "";
            (B.recommendations &&
                B.recommendations.length > 0 &&
                (Q = B.recommendations
                    .map(function(e) {
                        return `\n                    <div class="gaip-recommendation ${"critical" === e.priority ? "gaip-recommendation-critical" : "high" === e.priority ? "gaip-recommendation-warning" : "gaip-recommendation-positive"}">\n                        <div class="rec-title">${e.title}</div>\n                        <div class="rec-action">${e.action}</div>\n                    </div>\n                `;
                    })
                    .join("")),
                ir(
                    "Traffic Load vs Recovery (Baker/Gibbs/Adams STRI)",
                    `\n            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">\n                <span class="${K} gaip-stress-status">\n                    ${j.stressStatus.toUpperCase()}\n                </span>\n                <span class="${V} gaip-priority-badge">\n                    ${j.actionPriority} priority\n                </span>\n            </div>\n            \n            <p><strong>Weekly Load:</strong> ${j.weeklyHours.toFixed(1)} hrs/wk</p>\n            <p><strong>Carrying Capacity:</strong> ${j.effectiveCapacity.toFixed(1)} hrs/wk \n                <span style="font-size: 11px; color: var(--gaip-text);">(${B.carryingCapacity?.construction || "unknown"} × ${B.carryingCapacity?.species || "unknown"} × ${B.carryingCapacity?.season || "unknown"})</span>\n            </p>\n            <p><strong>Utilisation:</strong> ${j.capacityUtilisation.toFixed(0)}%</p>\n            \n            <div class="gaip-risk-bar-container">\n                <div class="gaip-risk-bar" style="width: ${Math.min(j.capacityUtilisation, 150)}%; background: ${Y};"></div>\n            </div>\n            \n            <p style="margin-top: 12px;"><strong>Recovery Probability:</strong> ${j.recoveryProbability.toFixed(0)}%</p>\n            <p><strong>Recovery Window:</strong> ${j.recoveryDays.toFixed(1)} days</p>\n            \n            ${j.cumulativeStressIndex > 0 ? `\n            <p><strong>Cumulative Stress (4-wk):</strong> ${j.cumulativeStressIndex.toFixed(1)}</p>\n            ` : ""}\n            \n            ${Z}\n            \n            ${Q ? `\n            <div style="margin-top: 16px;">\n                <strong>Recommendations:</strong>\n                ${Q}\n            </div>\n            ` : ""}\n            \n            ${U}\n            \n            <hr>\n            \n            <p style="font-size: 11px; color: var(--gaip-text);">\n                <strong>Sources:</strong> Baker SW, Gibbs RJ (1989) J Sports Turf Res Inst 65:9-33; \n                Baker SW, Gibbs RJ, Adams WA (1992) J Sports Turf Res Inst 68:20-32; \n                GMA UK Pitch Advisory Service; Gilba Solutions agronomic guidelines\n            </p>\n        `,
                ));
        } else
            ir(
                "Traffic Load vs Recovery Probability",
                `\n            <p><strong>Traffic load index:</strong> ${((i.TrafficRisk ?? 0) || 0).toFixed(1)} — ${W}</p>\n            <p><strong>Recovery probability:</strong> ${Math.round(i.recoveryProb ?? 0)}%</p>\n            <p><strong>Expected recovery window:</strong> ${i.recoveryWindow ?? 0} days</p>\n            \n            ${U}\n\n            <hr>\n\n            <p><strong>How traffic load affects recovery</strong><br>\n            Higher traffic load (matches + training sessions) reduces recovery probability and extends the required recovery window. \n            This combines with firmness AND growth potential to determine overall playability risk.</p>\n            \n            <p><strong>Growth impact on recovery:</strong><br>\n            • Optimal growth (>80%): Rapid recovery, ~20% faster healing<br>\n            • Good growth (60-80%): Normal recovery rates<br>\n            • Moderate growth (40-60%): 30% slower recovery<br>\n            • Slow growth (20-40%): 80% slower recovery<br>\n            • Dormant (<20%): 2.5x slower recovery - avoid heavy use</p>\n\n            <p><strong>Traffic load thresholds:</strong><br>\n            • Low (<3): Minimal impact on recovery<br>\n            • Moderate (3-5): Some reduction in recovery rate<br>\n            • Moderate-High (5-7): Significant recovery delays<br>\n            • High (7-10): Major recovery impediment<br>\n            • Severe (>10): Critical load, extended recovery required</p>\n\n            <p><strong>Operational implications</strong><br>\n            • High TrafficRisk → restrict high-intensity sessions, rotate field areas.<br>\n            • Low recoveryProb → add rest days, manage moisture more aggressively.<br>\n            • Extended recovery window → plan longer breaks between peak events.<br>\n            ${i.growthMultiplier < 0.4 ? "• <strong>⚠ Low growth conditions - significantly reduce traffic load</strong>" : ""}</p>\n        `,
            );
        ir(
            "Field Manager Scheduling Guidance",
            `\n        <p><strong>Playability:</strong> ${s.playability}</p>\n        <p><strong>Player risk:</strong> ${s.playerRisk}</p>\n        <p><strong>Recommended cutback:</strong> ${s.cutbackPercent}%</p>\n        <p><strong>Rest requirement:</strong> ${s.targetRestDays} days</p>\n        <p><strong>Status:</strong> ${s.restStatus}</p>\n        <p><strong>Moisture risk:</strong> ${s.moistureRisk}</p>\n\n        ${s.renovationTrigger ? `<p><strong>Renovation trigger:</strong> ${s.renovationReason}</p>` : "<p><strong>Renovation trigger:</strong> Not required.</p>"}\n    `,
        );
        var X = generateGrowthChart(o.growthData);
        if (e.fertility && e.fertility.monthlyN > 0 && "function" == typeof window.gaip_n_validate) {
            var ee = o.growthData ? o.growthData.weighted : 50,
                te =
                ((N = e.turf.grassSpecies || e.turf.warmBase || "couch"),
                    window.gaip_n_validate(e.fertility.monthlyN, N, ee));
            if (te) {
                var re =
                    "status-adequate" === te.verdictClass ?
                    "#22c55e" :
                    "status-borderline" === te.verdictClass ?
                    "#f59e0b" :
                    "#ef4444";
                X += `\n                <div style="margin-top: 20px; padding: 15px; background: ${"status-adequate" === te.verdictClass ? "var(--gaip-good-bg)" : "status-borderline" === te.verdictClass ? "var(--gaip-warning-bg)" : "var(--gaip-critical-bg)"}; border-left: 4px solid ${re}; border-radius: 6px;">\n                    <h4 style="margin: 0 0 10px 0; color: ${re};">\n                        N Program Validation: ${te.verdictLabel}\n                    </h4>\n                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">\n                        <div>\n                            <span style="font-size: 12px; color: var(--gaip-text);">Applied N:</span><br>\n                            <strong>${te.appliedNKgHa} kg/ha/month</strong>\n                        </div>\n                        <div>\n                            <span style="font-size: 12px; color: var(--gaip-text);">Uptake Capacity:</span><br>\n                            <strong>${te.capacityKgHa} kg/ha/month</strong>\n                        </div>\n                    </div>\n                    <div style="margin: 10px 0; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">\n                        <strong>Utilisation:</strong> ${te.utilisationPct !== undefined ? te.utilisationPct : te.utilizationPct !== undefined ? te.utilizationPct : 0}% of capacity\n                        ${te.wasteKgHa > 0 ? '<br><span style="color: #dc2626;">⚠ Wasted N: ' + te.wasteKgHa + " kg/ha</span>" : ""}\n                        ${te.deficitKgHa > 0 ? '<br><span style="color: #f59e0b;">⚠ N Deficit: ' + te.deficitKgHa + " kg/ha</span>" : ""}\n                    </div>\n                    <p style="font-size: 12px; color: var(--gaip-text); margin: 8px 0 0 0;">\n                        ${te.verdictMessage}\n                    </p>\n                    ${
          te.recommendations.length > 0
            ? '<ul style="font-size: 12px; margin: 8px 0 0 0; padding-left: 20px;">' +
              te.recommendations
                .map(function (e) {
                  return "<li>" + e + "</li>";
                })
                .join("") +
              "</ul>"
            : ""
        }\n                </div>\n            `;
            }
        } else
            e.fertility &&
            0 === e.fertility.monthlyN &&
            (X +=
                '\n            <div style="margin-top: 15px; padding: 12px; background: var(--gaip-surface-hover); border-radius: 6px; font-size: 13px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">\n                <strong>N Program Validation:</strong> Enter your monthly N rate (kg/ha) in Site &amp; Climate to compare against growth-limited uptake capacity.\n            </div>\n        ');
        var ne = e.soil?.surfaceType || "",
            ie = e.turf?.grassSpecies || "",
            ae = "greens" === ne || ie.toLowerCase().includes("greens") || ie.toLowerCase().includes("putting");
        if (a && i) {
            var oe = void 0 !== a.FI ? (100 * a.FI).toFixed(0) : "—",
                se = a.softnessClass || "Unknown",
                le = void 0 !== i.TrafficRisk ? i.TrafficRisk.toFixed(0) : "—",
                de = void 0 !== i.recoveryProb ? i.recoveryProb.toFixed(0) : "—",
                ce = void 0 !== i.recoveryWindow ? i.recoveryWindow.toFixed(0) : "—",
                pe = void 0 !== a.surfaceHardness ? a.surfaceHardness : "—",
                ge = a.hardnessClass || "Unknown",
                ue = (a.hardnessSource, a.hardnessWarning || null),
                me = a.FI >= 0.6 ? "#22c55e" : a.FI >= 0.4 ? "#f59e0b" : "#ef4444",
                fe = i.TrafficRisk <= 30 ? "#22c55e" : i.TrafficRisk <= 60 ? "#f59e0b" : "#ef4444",
                ye = i.recoveryProb >= 70 ? "#22c55e" : i.recoveryProb >= 40 ? "#f59e0b" : "#ef4444",
                he = pe >= 60 && pe <= 90 ? "#22c55e" : pe >= 50 && pe <= 100 ? "#f59e0b" : "#ef4444";
            X += ae ?
                `\n                <div style="margin-top: 20px; padding: 15px; background: var(--gaip-surface-muted); border: 1px solid var(--gaip-border); border-radius: 6px;">\n                    <div style="font-weight: 600; margin-bottom: 12px; color: var(--gaip-text);">⛳ Green Surface Quality</div>\n                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; text-align: center;">\n                        <div style="padding: 12px; background: var(--gaip-surface); border-radius: 4px; border: 1px solid var(--gaip-border);">\n                            <div style="font-size: 28px; font-weight: 700; color: ${me};">${oe}</div>\n                            <div style="font-size: 11px; color: var(--gaip-text);">Firmness Index</div>\n                            <div style="font-size: 10px; color: var(--gaip-text);">${se}</div>\n                        </div>\n                        <div style="padding: 12px; background: var(--gaip-surface); border-radius: 4px; border: 1px solid var(--gaip-border);">\n                            <div style="font-size: 28px; font-weight: 700; color: ${he};">${pe}</div>\n                            <div style="font-size: 11px; color: var(--gaip-text);">Hardness (Gmax)</div>\n                            <div style="font-size: 10px; color: var(--gaip-text);">${ge}</div>\n                        </div>\n                    </div>\n                    ${ue ? `\n                    <div style="margin-top: 10px; padding: 8px 12px; background: ${pe > 100 ? "var(--gaip-critical-bg)" : "var(--gaip-warning-bg)"}; border: 1px solid ${pe > 100 ? "var(--gaip-critical-border)" : "var(--gaip-warning-border)"}; border-radius: 4px;">\n                        <div style="font-size: 11px; color: ${pe > 100 ? "#dc2626" : "#d97706"};">\n                            <strong>⚠️ Surface Hardness:</strong> ${ue}\n                        </div>\n                    </div>\n                    ` : ""}\n                    <div style="margin-top: 12px; padding: 10px; background: var(--gaip-surface-hover); border-radius: 4px; font-size: 11px; color: var(--gaip-text);">\n                        <strong>Golf Green Metrics:</strong><br>\n                        <strong>Firmness Index:</strong> Surface stability for consistent ball roll. Based on moisture, rootzone, drainage.<br>\n                        <strong>Hardness (Gmax):</strong> ${a.hasCleggData ? "Measured" : "Estimated"} impact absorption. Greens typically 70-100 Gmax. Higher = firmer/faster.\n                    </div>\n                    <div style="margin-top: 8px; padding: 8px 10px; background: var(--gaip-good-bg); border-radius: 4px; font-size: 10px; color: #166534;">\n                        <strong>⛳ Golf Mode:</strong> Traffic analysis hidden - not applicable for continuous foot traffic on greens.\n                    </div>\n                </div>\n            ` :
                `\n                <div style="margin-top: 20px; padding: 15px; background: var(--gaip-surface-muted); border: 1px solid var(--gaip-border); border-radius: 6px;">\n                    <div style="font-weight: 600; margin-bottom: 12px; color: var(--gaip-text);">Surface & Traffic Conditions</div>\n                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center;">\n                        <div style="padding: 10px; background: var(--gaip-surface); border-radius: 4px; border: 1px solid var(--gaip-border);">\n                            <div style="font-size: 22px; font-weight: 700; color: ${me};">${oe}</div>\n                            <div style="font-size: 10px; color: var(--gaip-text);">Firmness Index</div>\n                            <div style="font-size: 9px; color: var(--gaip-text);">${se}</div>\n                        </div>\n                        <div style="padding: 10px; background: var(--gaip-surface); border-radius: 4px; border: 1px solid var(--gaip-border);">\n                            <div style="font-size: 22px; font-weight: 700; color: ${he};">${pe}</div>\n                            <div style="font-size: 10px; color: var(--gaip-text);">Hardness (Gmax)</div>\n                            <div style="font-size: 9px; color: var(--gaip-text);">${ge}</div>\n                        </div>\n                        <div style="padding: 10px; background: var(--gaip-surface); border-radius: 4px; border: 1px solid var(--gaip-border);">\n                            <div style="font-size: 22px; font-weight: 700; color: ${fe};">${le}%</div>\n                            <div style="font-size: 10px; color: var(--gaip-text);">Traffic Risk</div>\n                        </div>\n                        <div style="padding: 10px; background: var(--gaip-surface); border-radius: 4px; border: 1px solid var(--gaip-border);">\n                            <div style="font-size: 22px; font-weight: 700; color: ${ye};">${de}%</div>\n                            <div style="font-size: 10px; color: var(--gaip-text);">Recovery Prob.</div>\n                        </div>\n                        <div style="padding: 10px; background: var(--gaip-surface); border-radius: 4px; border: 1px solid var(--gaip-border);">\n                            <div style="font-size: 22px; font-weight: 700; color: #3b82f6;">${ce}</div>\n                            <div style="font-size: 10px; color: var(--gaip-text);">Recovery Days</div>\n                        </div>\n                    </div>\n                    ${ue ? `\n                    <div style="margin-top: 10px; padding: 8px 12px; background: ${pe > 100 ? "var(--gaip-critical-bg)" : "var(--gaip-warning-bg)"}; border: 1px solid ${pe > 100 ? "var(--gaip-critical-border)" : "var(--gaip-warning-border)"}; border-radius: 4px;">\n                        <div style="font-size: 11px; color: ${pe > 100 ? "#dc2626" : "#d97706"};">\n                            <strong>⚠️ Surface Hardness:</strong> ${ue}\n                        </div>\n                    </div>\n                    ` : ""}\n                    ${
            a.hasCleggRange
              ? `\n                    <div style="margin-top: 12px; padding: 12px; background: var(--gaip-info-bg); border: 1px solid #bae6fd; border-radius: 6px;">\n                        <div style="font-weight: 600; color: #0369a1; margin-bottom: 8px;">📊 Surface Uniformity Analysis</div>\n                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">\n                            <div style="text-align: center; padding: 8px; background: var(--gaip-surface); border-radius: 4px;">\n                                <div style="font-size: 18px; font-weight: 700; color: #dc2626;">${a.cleggMax}</div>\n                                <div style="font-size: 9px; color: var(--gaip-text);">Hardest (Gmax)</div>\n                            </div>\n                            <div style="text-align: center; padding: 8px; background: var(--gaip-surface); border-radius: 4px;">\n                                <div style="font-size: 18px; font-weight: 700; color: #22c55e;">${a.cleggMin}</div>\n                                <div style="font-size: 9px; color: var(--gaip-text);">Softest (Gmax)</div>\n                            </div>\n                            <div style="text-align: center; padding: 8px; background: var(--gaip-surface); border-radius: 4px;">\n                                <div style="font-size: 18px; font-weight: 700; color: #6366f1;">${a.cleggRange}</div>\n                                <div style="font-size: 9px; color: var(--gaip-text);">Range (spread)</div>\n                            </div>\n                            <div style="text-align: center; padding: 8px; background: var(--gaip-surface); border-radius: 4px;">\n                                <div style="font-size: 14px; font-weight: 600; color: ${"Excellent" === a.uniformityClass || "Good" === a.uniformityClass ? "#22c55e" : "Moderate" === a.uniformityClass ? "#f59e0b" : "#dc2626"};">${a.uniformityClass}</div>\n                                <div style="font-size: 9px; color: var(--gaip-text);">Uniformity</div>\n                            </div>\n                        </div>\n                        ${a.uniformityWarning ? `\n                        <div style="padding: 6px 10px; background: var(--gaip-warning-bg); border-radius: 4px; font-size: 11px; color: #92400e; margin-bottom: 10px;">\n                            ⚠️ ${a.uniformityWarning}\n                        </div>\n                        ` : ""}\n                        ${
                  a.zoneRecommendations && a.zoneRecommendations.length > 0
                    ? `\n                        <div style="margin-top: 8px;">\n                            ${a.zoneRecommendations
                        .map(function (e) {
                          var t = "critical" === e.status ? "var(--gaip-critical-bg)" : "warning" === e.status ? "var(--gaip-warning-bg)" : "var(--gaip-good-bg)",
                            r = "critical" === e.status ? "var(--gaip-critical-border)" : "warning" === e.status ? "var(--gaip-warning-border)" : "var(--gaip-good-bg)",
                            n = "critical" === e.status ? "🚨" : "warning" === e.status ? "⚠️" : "ℹ️";
                          return (
                            '<div style="padding: 10px; background: ' +
                            t +
                            "; border: 1px solid " +
                            r +
                            '; border-radius: 4px; margin-bottom: 6px;"><div style="font-weight: 600; color: ' +
                            ("critical" === e.status ? "#dc2626" : "warning" === e.status ? "#d97706" : "#059669") +
                            '; font-size: 11px;">' +
                            n +
                            " " +
                            e.zone +
                            '</div><div style="font-size: 10px; color: var(--gaip-text); margin: 4px 0;">' +
                            e.issue +
                            '</div><div style="font-size: 10px; color: var(--gaip-text);"><strong>Actions:</strong><ul style="margin: 4px 0 0 16px; padding: 0;">' +
                            e.actions
                              .map(function (e) {
                                return "<li>" + e + "</li>";
                              })
                              .join("") +
                            "</ul></div></div>"
                          );
                        })
                        .join("")}\n                        </div>\n                        `
                    : ""
                }\n                    </div>\n                    `
              : ""
          }\n                    <div style="margin-top: 12px; padding: 10px; background: var(--gaip-surface-hover); border-radius: 4px; font-size: 11px; color: var(--gaip-text);">\n                        <strong>What these mean:</strong><br>\n                        <strong>Firmness Index (0-100):</strong> Resistance to deformation under load. Based on moisture, construction, drainage, species. &gt;60 = firm, 40-60 = moderate, &lt;40 = soft.<br>\n                        <strong>Hardness (Gmax):</strong> Impact absorption (Clegg hammer). ${a.hasCleggData ? "Measured" : "Estimated"}. 60-90 = ideal, &lt;60 = soft, &gt;100 = too hard (injury risk).<br>\n                        <strong>Traffic Risk:</strong> Likelihood of damage from scheduled events at current growth rate. &lt;30% = low risk, 30-60% = caution, &gt;60% = high risk.<br>\n                        <strong>Recovery Prob.:</strong> Chance of full recovery before next event. &gt;70% = good, 40-70% = marginal, &lt;40% = poor.<br>\n                        <strong>Recovery Days:</strong> Estimated days to recover from typical match/event wear at current growth rate.\n                    </div>\n                    <div style="margin-top: 8px; padding: 8px 10px; background: var(--gaip-info-bg); border-radius: 4px; font-size: 10px; color: #4338ca;">\n                        <strong>Construction:</strong> ${a.constructionNote || "Unknown"}\n                    </div>\n                    ${
            i.trafficWarnings && i.trafficWarnings.length > 0
              ? `\n                    <div style="margin-top: 12px;">\n                        ${i.trafficWarnings
                  .map(function (e) {
                    return (
                      '<div style="padding: 10px; background: ' +
                      ("critical" === e.severity ? "var(--gaip-critical-bg)" : "warning" === e.severity ? "var(--gaip-warning-bg)" : "var(--gaip-good-bg)") +
                      "; border: 1px solid " +
                      ("critical" === e.severity ? "var(--gaip-critical-border)" : "warning" === e.severity ? "var(--gaip-warning-border)" : "var(--gaip-good-bg)") +
                      '; border-radius: 4px; margin-bottom: 8px;"><div style="font-weight: 600; color: ' +
                      ("critical" === e.severity ? "#dc2626" : "warning" === e.severity ? "#d97706" : "#16a34a") +
                      '; font-size: 12px;">' +
                      ("critical" === e.severity ? "🚨" : "warning" === e.severity ? "⚠️" : "ℹ️") +
                      " " +
                      e.message +
                      '</div><div style="font-size: 11px; color: var(--gaip-text); margin-top: 4px;"><strong>Action:</strong> ' +
                      e.action +
                      "</div></div>"
                    );
                  })
                  .join("")}\n                    </div>\n                    `
              : ""
          }\n                </div>\n            `;
        }
        var ve =
            o && typeof o.baseOptimum === "number" && typeof o.opt === "number" ?
            generateSeasonalNPlan(e, {
                Nopt: o.opt,
                growthData: o.growthData,
                baseOptimum: o.baseOptimum,
            }) :
            '<div style="padding: 10px; color: var(--gaip-text-secondary); font-size: 12px;">Seasonal N plan requires nitrogen diagnostics data. Check that N inputs are configured.</div>',
            be = generateRecoveryCalendar(e, i, d),
            xe = l.c3Opt > 0 ? l.c3Opt.toFixed(1) : "N/A",
            we = l.c4Opt > 0 ? l.c4Opt.toFixed(1) : "N/A",
            Se = "";
        (1 === l.c3TempFactor && 1 === l.c4TempFactor) ||
        (Se = `\n        <div style="margin: 10px 0; padding: 8px; background: var(--gaip-warning-bg); border-left: 3px solid #f59e0b; border-radius: 4px;">\n            <strong>Temperature × Light Interaction:</strong><br>\n            <span style="font-size: 12px;">\n                At ${l.temperature.toFixed(1)}°C, DLI requirements are adjusted:<br>\n                ${l.c3TempFactor < 1 ? "• C3 grasses can tolerate lower DLI in cool conditions" : ""}\n                ${l.c3TempFactor > 1 ? "• C3 grasses need MORE light to compensate for heat stress" : ""}\n                ${l.c4TempFactor < 1 ? "• C4 grasses can tolerate lower DLI at optimal temps" : ""}\n                ${l.c4TempFactor > 1 ? "• C4 grasses need MORE light when temperatures are cool" : ""}\n            </span>\n        </div>\n        `);
        // v9.9.0: Build overseed-aware status display for shade section
        var overseedIndicatorHtml = l.isOverseedDominant ?
            `<div style="margin: 10px 0; padding: 10px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; border-radius: 4px;"><strong>🌱 Overseed-Dominant Stand:</strong> ${Math.round(l.c3Fraction * 100)}% C3 (Cool-Season)<br><span style="font-size: 12px; color: #1e40af;">DLI requirements assessed against <strong>C3 thresholds</strong> — the dominant grass type.</span></div>` :
            "";
        var effectiveStatusColor =
            (l.effectiveStatus || "").indexOf("Optimal") > -1 ?
            "#059669" :
            (l.effectiveStatus || "").indexOf("Critical") > -1 ?
            "#dc2626" :
            "#d97706";
        var speciesStatusHtml = l.isOverseedDominant ?
            `<p><strong>Effective Species Status:</strong> <span style="font-weight: 600; color: ${effectiveStatusColor};">${l.effectiveStatus}</span></p><p style="font-size: 12px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: -4px;">Based on C3 requirements: Min ${l.c3Min.toFixed(1)} | Optimal: ${xe} mol/m²/day</p><details style="margin-top: 8px; font-size: 12px;"><summary style="cursor: pointer; color: var(--gaip-text-muted, var(--gaip-text-secondary));">Base species status (${Math.round(l.c4Fraction * 100)}% C4)</summary><p style=" margin-top: 4px;">C4 Warm-Season Status: ${l.c4Status}</p><p style="font-size: 11px; ">Min requirement: ${l.c4Min.toFixed(1)} | Optimal: ${we} mol/m²/day</p></details>` :
            `<p><strong>C3 Cool-Season Status:</strong> ${l.c3Status}</p><p style="font-size: 12px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: -4px;">Min requirement: ${l.c3Min.toFixed(1)} | Optimal: ${xe} mol/m²/day</p><p><strong>C4 Warm-Season Status:</strong> ${l.c4Status}</p><p style="font-size: 12px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: -4px;">Min requirement: ${l.c4Min.toFixed(1)} | Optimal: ${we} mol/m²/day</p>`;
        var Ce = `\n        <p><strong>Total DLI Available:</strong> ${l.DLI_total.toFixed(1)} mol/m²/day</p>\n        <p style="font-size: 12px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: -4px;">\n            (Natural: ${l.DLI_adj.toFixed(1)} + LED: ${l.DLI_led.toFixed(1)})\n        </p>\n        \n        ${Se}\n        ${overseedIndicatorHtml}\n        ${speciesStatusHtml}\n\n        <p><strong>Renovation Conditions:</strong> ${l.renovation}</p>\n        \n        <hr>\n        \n        <p><strong>Shade Factor:</strong> ${(100 * l.shadeFactor).toFixed(0)}% of full sun</p>\n        <p style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">\n            Sky View: ${(100 * l.svf).toFixed(0)}% | \n            Facade Obstruction: ${l.facade}° | \n            Tree/Structural: ${l.treeBlock}%\n        </p>\n        \n        ${l.DLI_led > 0 ? `\n        <div style="margin-top: 10px; padding: 8px; background: var(--gaip-info-bg); border-left: 3px solid #6366f1; border-radius: 4px;">\n            <strong>LED Supplementation Active:</strong><br>\n            <span style="font-size: 12px;">\n                Providing ${l.DLI_led.toFixed(1)} mol/m²/day additional light\n            </span>\n        </div>\n        ` : ""}\n        \n        ${l.modular ? `\n        <div class="gaip-shade-progressive" style="margin-top: 16px;  padding-top: 12px;">\n            \n            \x3c!-- Fungal Risk Panel --\x3e\n            ${l.fungalClass ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">Fungal Risk</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: ${l.fungalClass.colour}20; color: ${l.fungalClass.colour}; border: 1px solid ${l.fungalClass.colour}40;">${l.fungalClass.label}</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Index: ${l.fungalRisk}/100</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">DLI factor: ${l.DLI_total < 12 ? "Elevated" : "Normal"}</span>\n                    </div>\n                    <div style="font-size: 0.75rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">Low DLI + extended dew increases fungal pressure. Monitor for dollar spot, brown patch.</div>\n                </div>\n            </div>\n            ` : ""}\n            \n            \x3c!-- Stress Forecast Panel --\x3e\n            ${l.stressClass ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">Stress Forecast</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: ${l.stressClass.colour}20; color: ${l.stressClass.colour}; border: 1px solid ${l.stressClass.colour}40;">${l.stressClass.label}</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Index: ${l.stressIndex}/100</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Light deficit: ${l.modular.deficitPct ?? l.modular.dliDeficit ?? 0}%</span>\n                    </div>\n                    <div style="font-size: 0.75rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">Combined assessment of light, ET, traffic, and disease pressure.</div>\n                </div>\n            </div>\n            ` : ""}\n            \n            \x3c!-- Recovery Window Panel --\x3e\n            ${l.recoveryWindow ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">Recovery Window</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: ${"good" === l.recoveryWindow.severity ? "#22c55e" : "watch" === l.recoveryWindow.severity ? "#eab308" : "concern" === l.recoveryWindow.severity ? "#f97316" : "#ef4444"}20; color: ${"good" === l.recoveryWindow.severity ? "#22c55e" : "watch" === l.recoveryWindow.severity ? "#eab308" : "concern" === l.recoveryWindow.severity ? "#f97316" : "#ef4444"}; border: 1px solid ${"good" === l.recoveryWindow.severity ? "#22c55e" : "watch" === l.recoveryWindow.severity ? "#eab308" : "concern" === l.recoveryWindow.severity ? "#f97316" : "#ef4444"}40;">${l.recoveryWindow.flag}</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    ${l.recoveryWindow.windowStart ? `<div style="margin-bottom: 8px;"><span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Window: ${l.recoveryWindow.windowStart} – ${l.recoveryWindow.windowEnd}</span></div>` : ""}\n                    <div style="font-size: 0.75rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">${l.recoveryWindow.detail}</div>\n                </div>\n            </div>\n            ` : ""}\n            \n            \x3c!-- LED Recommendation Panel (from modular engine) --\x3e\n            ${l.ledRecommendation && l.ledRecommendation.required ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">LED Supplementation Needed</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: #eab30820; color: #eab308; border: 1px solid #eab30840;">Required</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Deficit: ${l.ledRecommendation.deficitMol} mol</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Hours: ${l.ledRecommendation.hours}/day</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Energy: ${l.ledRecommendation.kWh} kWh/day</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Cost: $${l.ledRecommendation.costPerDay}/day</span>\n                    </div>\n                    ${l.ledRecommendation.warning ? `<div style="font-size: 0.75rem; color: #fbbf24;">${l.ledRecommendation.warning}</div>` : ""}\n                </div>\n            </div>\n            ` : ""}\n            \n            \x3c!-- ========================================\n                 v2.0 SHADE MANAGEMENT PANELS\n                 Research-backed agronomic adjustments\n            ======================================== --\x3e\n            \n            \x3c!-- Nitrogen Adjustment Panel (Bell & Danneberger 1999) --\x3e\n            ${l.nAdjustment && l.nAdjustment.factor < 1 ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">⚗ Nitrogen Adjustment</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: ${"concern" === l.nAdjustment.severity ? "#f9731620" : "#eab30820"}; color: ${"concern" === l.nAdjustment.severity ? "#f97316" : "#eab308"}; border: 1px solid ${"concern" === l.nAdjustment.severity ? "#f9731640" : "#eab30840"};">${l.nAdjustment.label}</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Reduce N by ${l.nAdjustment.reductionPct}%</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Factor: ${l.nAdjustment.factor.toFixed(2)}</span>\n                    </div>\n                    <div style="font-size: 0.75rem; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-bottom: 6px;">${l.nAdjustment.reason}</div>\n                    <div style="font-size: 0.68rem; color: var(--gaip-text-muted, var(--gaip-text-secondary)); font-style: italic;">Ref: ${l.nAdjustment.reference}</div>\n                </div>\n            </div>\n            ` : ""}\n            \n            \x3c!-- Mowing Height Panel (Dudeck & Peacock 1992) --\x3e\n            ${l.mowingGuidance && l.mowingGuidance.increasePct > 0 ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">✂ Mowing Height</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: ${"concern" === l.mowingGuidance.severity ? "#f9731620" : "#eab30820"}; color: ${"concern" === l.mowingGuidance.severity ? "#f97316" : "#eab308"}; border: 1px solid ${"concern" === l.mowingGuidance.severity ? "#f9731640" : "#eab30840"};">+${l.mowingGuidance.increasePct}%</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Current: ${l.mowingGuidance.currentHOC || "—"}mm</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: rgba(34,197,94,0.2); border: 1px solid rgba(34,197,94,0.4); color: #22c55e;">Recommended: ${l.mowingGuidance.recommendedHOC}mm</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px;  ">Max for shade: ${l.mowingGuidance.shadeMax}mm</span>\n                    </div>\n                    <div style="font-size: 0.75rem; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-bottom: 6px;">${l.mowingGuidance.reason}</div>\n                    <div style="font-size: 0.68rem; color: var(--gaip-text-muted, var(--gaip-text-secondary)); font-style: italic;">Ref: ${l.mowingGuidance.reference}</div>\n                </div>\n            </div>\n            ` : ""}\n            \n            \x3c!-- PGR Warning Panel (Ervin & Koski 1998) --\x3e\n            ${l.pgrGuidance && l.pgrGuidance.warning ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">⚠ PGR Guidance</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: ${"critical" === l.pgrGuidance.severity ? "#ef444420" : "concern" === l.pgrGuidance.severity ? "#f9731620" : "#eab30820"}; color: ${"critical" === l.pgrGuidance.severity ? "#ef4444" : "concern" === l.pgrGuidance.severity ? "#f97316" : "#eab308"}; border: 1px solid ${"critical" === l.pgrGuidance.severity ? "#ef444440" : "concern" === l.pgrGuidance.severity ? "#f9731640" : "#eab30840"};">${l.pgrGuidance.suspend ? "Suspend" : "Caution"}</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    <div style="font-size: 0.82rem; color: ${"critical" === l.pgrGuidance.severity ? "#ef4444" : "#f97316"}; font-weight: 500; margin-bottom: 6px;">${l.pgrGuidance.warning}</div>\n                    <div style="font-size: 0.75rem; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-bottom: 6px;">${l.pgrGuidance.recommendation}</div>\n                    ${l.pgrGuidance.conflictDetected ? '<div style="font-size: 0.75rem; color: #ef4444; margin-bottom: 6px;">⚠ PGR program currently active — review recommended</div>' : ""}\n                    <div style="font-size: 0.68rem; color: var(--gaip-text-muted, var(--gaip-text-secondary)); font-style: italic;">Ref: ${l.pgrGuidance.reference}</div>\n                </div>\n            </div>\n            ` : ""}\n            \n            \x3c!-- Seasonal Trajectory Panel (Solar Geometry) --\x3e\n            ${l.seasonalTrajectory ? `\n            <div class="gaip-shade-panel" style="margin-bottom: 8px;  border-radius: 8px; overflow: hidden;">\n                <div class="gaip-panel-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('.gaip-chevron').textContent = this.nextElementSibling.style.display === 'none' ? '▶' : '▼';" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; ">\n                    <span class="gaip-chevron" style="font-size: 0.7rem; color: var(--gaip-text-muted, var(--gaip-text-secondary));">▶</span>\n                    <span style="flex: 1; font-size: 0.82rem; font-weight: 500;">☀ Seasonal Light Trajectory</span>\n                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: rgba(59,130,246,0.2); color: #3b82f6; border: 1px solid rgba(59,130,246,0.4);">Range: ${(100 * l.seasonalTrajectory.seasonalRange).toFixed(0)}%</span>\n                </div>\n                <div style="display: none; padding: 10px 12px;  font-size: 0.82rem; ">\n                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: rgba(34,197,94,0.2); border: 1px solid rgba(34,197,94,0.4); color: #22c55e;">Peak: ${l.seasonalTrajectory.peakMonthName} (${(100 * l.seasonalTrajectory.peakDLI).toFixed(0)}%)</span>\n                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); color: #ef4444;">Trough: ${l.seasonalTrajectory.troughMonthName} (${(100 * l.seasonalTrajectory.troughDLI).toFixed(0)}%)</span>\n                    </div>\n                    ${l.seasonalTrajectory.stressPeriods.length > 0 ? `\n                    <div style="font-size: 0.75rem; color: #fbbf24; margin-bottom: 6px;">Stress periods: ${l.seasonalTrajectory.stressPeriods.join(", ")}</div>\n                    ` : ""}\n                    <div style="font-size: 0.75rem; color: #22c55e; margin-bottom: 6px;">Optimal renovation: ${l.seasonalTrajectory.optimalRenovation.join(", ")}</div>\n                    <div id="gaip-shade-forecast-chart" style="margin-top: 12px;"></div>\n                    <div style="font-size: 0.68rem; color: var(--gaip-text-muted, var(--gaip-text-secondary)); font-style: italic; margin-top: 8px;">${l.seasonalTrajectory.note}</div>\n                </div>\n            </div>\n            ` : ""}\n            \n        </div>\n        ` : ""}\n    `;
        ((v = document.querySelector(".gaip-growth-body")),
            (b = document.querySelector(".gaip-seasonal-body")),
            (x = document.querySelector(".gaip-calendar-body")));
        FORENSIC_RECORD.init();
        var Me,
            Ie,
            ke,
            Ae = "",
            Ee = "",
            Ne = "",
            Te = "",
            Pe =
            "ammonium_acetate" === ((e.soil && e.soil.methodology) || "mlsn") ?
            "Ammonium Acetate" :
            "slan" === ((e.soil && e.soil.methodology) || "mlsn") ?
            "SLAN" :
            "MLSN";
        // v9.8.1: Check if actual soil test data was entered before showing status
        var hasSoilData =
            e.soil &&
            e.soil.ppm &&
            Object.keys(e.soil.ppm).some(function(k) {
                return e.soil.ppm[k] > 0;
            });
        if (c) {
            var Re;
            if (!hasSoilData) {
                // No soil data entered - show informational status instead of misleading ACCEPTABLE
                Re = "NO_DATA";
            } else {
                Re =
                    (Ie = r).indexOf("DEFICIENT") > -1 ? "HIGH_RISK" : Ie.indexOf("BORDERLINE") > -1 ? "MONITOR" : "ACCEPTABLE";
            }
            Ae =
                Re === "NO_DATA" ?
                generateDecisionBlock(
                    "Soil Nutrition (" + Pe + ")",
                    "NO_DATA",
                    "No soil test results entered",
                    "Soil nutrient status affects turf recovery capacity, wear tolerance, and disease resistance",
                    "Unable to assess nutrient sufficiency without soil test data",
                    "Enter soil test results to receive nutrient recommendations",
                    ["Upload or enter recent soil test results to enable analysis"],
                ) :
                generateDecisionBlock(
                    "Soil Nutrition (" + Pe + ")",
                    Re,
                    "Soil test results analysed against " + Pe + " sufficiency standards",
                    "Nutrient levels determine turf recovery capacity, wear tolerance, and disease resistance",
                    "HIGH_RISK" === Re ?
                    "Deficient nutrients will cause progressive thinning and reduced performance" :
                    "Adequate nutrient supply supports consistent quality",
                    "HIGH_RISK" === Re ?
                    "Apply deficient nutrients immediately to restore sufficiency" :
                    "Continue routine fertilization program",
                    "HIGH_RISK" === Re ?
                    ["IMMEDIATE: Apply fertiliser to correct deficiencies", "30-90 DAYS: Retest to confirm improvement"] :
                    [],
                );
            var $e =
                (Me = n).indexOf("Very high") > -1 || Me.indexOf("Severe") > -1 ?
                "IMMINENT_FAILURE" :
                Me.indexOf("High") > -1 ?
                "HIGH_RISK" :
                Me.indexOf("Medium") > -1 || Me.indexOf("Moderate") > -1 ?
                "MONITOR" :
                "ACCEPTABLE";
            Ee = generateDecisionBlock(
                "Irrigation Water Quality",
                $e,
                "Water chemistry analysed for salinity, sodium hazard, and toxicity risks",
                "Poor water quality causes soil sodicity, reduced infiltration, and direct turf damage",
                "IMMINENT_FAILURE" === $e ?
                "Severe water quality issues will cause rapid turf decline and unplayable conditions" :
                "HIGH_RISK" === $e ?
                "Continued use without treatment will progressively damage soil structure" :
                "Water quality is manageable with standard practices",
                "IMMINENT_FAILURE" === $e ?
                "Implement water treatment system immediately or source alternative water" :
                "HIGH_RISK" === $e ?
                "Apply gypsum and increase leaching fraction" :
                "Monitor and maintain current practices",
                "IMMINENT_FAILURE" === $e ?
                [
                    "IMMEDIATE: Install treatment system or find alternative water source",
                    "IMMEDIATE: Heavy gypsum application",
                ] :
                "HIGH_RISK" === $e ?
                ["30-90 DAYS: Begin gypsum program", "30-90 DAYS: Increase irrigation frequency for leaching"] :
                [],
            );
        }
        if (p) {
            var Fe = (function(e) {
                return e > 80 ? "IMMINENT_FAILURE" : e > 60 ? "HIGH_RISK" : e > 40 ? "MONITOR" : "ACCEPTABLE";
            })(i.TrafficRisk);
            Ne = generateDecisionBlock(
                "Traffic Load Management",
                Fe,
                `Traffic risk score of ${i.TrafficRisk.toFixed(1)} with ${i.recoveryProb.toFixed(0)}% recovery probability`,
                "Excessive load relative to recovery capacity causes progressive surface degradation",
                "IMMINENT_FAILURE" === Fe ?
                "Continued overload will result in bare patches, unsafe playing surface, and event cancellations" :
                "HIGH_RISK" === Fe ?
                "Surface quality will decline with increased injury risk" :
                "Traffic load is within sustainable limits",
                "IMMINENT_FAILURE" === Fe ?
                "Immediately reduce event frequency or implement emergency recovery protocol" :
                "HIGH_RISK" === Fe ?
                "Reduce training sessions or add rest days" :
                "Maintain current schedule with routine monitoring",
                "IMMINENT_FAILURE" === Fe ?
                ["IMMEDIATE: Cancel non-essential events", "IMMEDIATE: Implement grow-in protocol"] :
                "HIGH_RISK" === Fe ?
                ["30-90 DAYS: Reduce training frequency", "30-90 DAYS: Add recovery windows"] :
                [],
            );
            if (d && d.recommendations && d.recommendations.length > 0) {
                console.log("[Hub] POA/Wear recommendations found:", d.recommendations.length);
                d.recommendations.forEach(function(rec) {
                    if (rec.category === "poa" || rec.type === "warning") {
                        Ne +=
                            '<div style="margin-top:12px;padding:12px;background:var(--gaip-warning-bg);border-left:4px solid #f59e0b;border-radius:6px;"><strong style="color:#92400e;">⚠️ ' +
                            rec.text +
                            "</strong>" +
                            (rec.action ? '<br><span style="font-size:12px;color:#78350f;">' + rec.action + "</span>" : "") +
                            "</div>";
                    }
                });
            }
        }
        if (g) {
            // v9.9.0: Use effective species status for verdict when overseed is dominant
            // This fixes the bug where C4 "Critical" status was triggering IMMINENT_FAILURE
            // for overseed-dominant situations (e.g., 55% ryegrass on couch base)
            var effectiveStatusForVerdict = l.effectiveStatus || l.c3Status || l.c4Status || "";
            var verdictSource = effectiveStatusForVerdict.toLowerCase();

            // Log for debugging
            if (l.isOverseedDominant) {}

            var _e =
                verdictSource.indexOf("critical") > -1 ||
                verdictSource.indexOf("cannot sustain") > -1 ||
                verdictSource.indexOf("poor - do not") > -1 ?
                "IMMINENT_FAILURE" :
                verdictSource.indexOf("deficient") > -1 ?
                "HIGH_RISK" :
                verdictSource.indexOf("marginal") > -1 || verdictSource.indexOf("suboptimal") > -1 ?
                "MONITOR" :
                "ACCEPTABLE";
            Te = generateDecisionBlock(
                "Light Availability (Shade)",
                _e,
                "DLI (Daily Light Integral) analysed against species requirements",
                "Insufficient light reduces photosynthesis, weakens turf, and increases disease pressure",
                "IMMINENT_FAILURE" === _e ?
                "Severe shade will cause turf death and complete renovation requirement" :
                "HIGH_RISK" === _e ?
                "Progressive thinning and weak turf that cannot sustain traffic" :
                "Light levels support healthy turf growth",
                "IMMINENT_FAILURE" === _e ?
                "Install LED supplementation immediately or remove shade sources" :
                "HIGH_RISK" === _e ?
                "Add LED grow lights or reduce shade" :
                "Monitor and maintain current light conditions",
                "IMMINENT_FAILURE" === _e ?
                ["IMMEDIATE: Install high-output LED system", "IMMEDIATE: Remove/prune obstructions if possible"] :
                "HIGH_RISK" === _e ?
                ["30-90 DAYS: Install LED supplementation", "90-180 DAYS: Evaluate shade reduction options"] :
                [],
            );
        }
        if (c) {
            var De = window.convertMLSNToProgressive ? window.convertMLSNToProgressive(e, t) : Ae + r;
            u.innerHTML = Ae + De;
            var Ge = document.querySelector(".gaip-nutrient-demand-body"),
                Le = document.querySelector('[data-section="nutrient-demand"]');
            if (Ge && window.GilbaNutrientDemandEngine)
                try {
                    var Oe = document.querySelector(".gaip-monthly-n-rate"),
                        ze = (Oe && parseFloat(Oe.value)) || 0;
                    if (ze <= 0)
                        throw (
                            (Ge.innerHTML =
                                '<div style="padding: 16px; background: var(--gaip-surface-muted); border-radius: 8px; text-align: center;"><div style="font-size: 14px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-bottom: 8px;">📊 N-Linked Nutrient Demand</div><div style="font-size: 13px; ">Enter monthly N rate in the Climate & Growth section to calculate species-specific nutrient demand and clipping yield estimates.</div></div>'),
                            Le && (Le.style.display = "block"),
                            console.log("ℹ️ Nutrient demand: No N rate entered, showing prompt"),
                            new Error("SKIP_NUTRIENT_DEMAND")
                        );
                    var He = "sports",
                        qe = (e.turf?.turfType || e.turf?.type || "").toLowerCase().trim(),
                        We = (e.turf?.subCategory || "").toLowerCase().trim();
                    (console.log("✅ Nutrient demand turf state source:", {
                            "state.turf.turfType": e.turf?.turfType,
                            "state.turf.subCategory": e.turf?.subCategory,
                            "gaipTurfProfile.state": window.gaipTurfProfile?.state,
                        }),
                        (-1 === qe.indexOf("green") && -1 === qe.indexOf("putting") && "greens" !== We) || (He = "greens"),
                        console.log("✅ Nutrient demand context:", He, "(turfType:", qe, ", subCategory:", We, ")"));
                    ((N = e.turf?.grassSpecies || e.turf?.warmBase || null), (M = e.turf?.coolOverseed || null));
                    var Ue = 0,
                        Be = ((S = N && /couch|bermuda|kikuyu|zoysia|paspalum|buffalo/i.test(N)), 10),
                        je = e.climate?.latitude || e.climate?.lat || 0,
                        Ve = Math.abs(je),
                        Ke = ze * (Be = S ? (Ve < 27 ? 12 : Ve < 35 ? 11 : 9) : Ve < 25 ? 9 : 10);
                    (console.log(
                            "✅ Nutrient demand growing season:",
                            Be,
                            "months (lat:",
                            je,
                            ", isC4:",
                            S,
                            ") → Annual N:",
                            Ke,
                            "kg/ha",
                        ),
                        S && e.turf?.speciesFractions && "number" == typeof e.turf.speciesFractions.c3Fraction ?
                        (Ue = e.turf.speciesFractions.c3Fraction) :
                        ((M = null), (Ue = 0)),
                        console.log("✅ Nutrient demand species:", N, "isC4Base:", S, "overseed:", M, "fraction:", Ue));
                    var Ye = window.GilbaNutrientDemandEngine.calculateNutrientDemand({
                            nRateKgHaYear: Ke,
                            context: He,
                            species: N,
                            overseedSpecies: M,
                            overseedFraction: Ue,
                            growingWeeks: 40,
                        }),
                        Ze = window.GilbaNutrientDemandEngine.calculateAdjustedThresholds(Ke, He, e.soil?.methodology || "slan"),
                        Je = window.GilbaNutrientDemandEngine.renderDemandAnalysis({
                            demand: Ye,
                            thresholds: Ze,
                        });
                    ((Ge.innerHTML = Je),
                        Le && (Le.style.display = "block"),
                        (window.GAIP_NUTRIENT_DEMAND_RESULT = {
                            demand: Ye,
                            thresholds: Ze,
                        }),
                        console.log("✅ Nutrient demand analysis rendered (N=" + Ke + " kg/ha/yr, context=" + He + ")"));
                } catch (e) {
                    "SKIP_NUTRIENT_DEMAND" !== e.message &&
                        (console.warn("Nutrient demand analysis failed:", e),
                            (Ge.innerHTML =
                                '<p class="gaip-note">Unable to calculate nutrient demand. Enter monthly N rate to enable.</p>'));
                }
            else
                Ge &&
                ((Ge.innerHTML =
                        '<p class="gaip-note">Enter monthly N rate in Climate & Growth section to enable N-linked demand analysis.</p>'),
                    Le && (Le.style.display = "block"));
            var Qe =
                window.GAIP_WaterBlenderUI &&
                window.GAIP_WaterBlenderUI.getState &&
                window.GAIP_WaterBlenderUI.getState().enabled &&
                window.GAIP_WaterBlenderUI.getState().blendResult;
            if (
                (console.log("[Hub] Water section debug:", {
                        blenderActive: Qe,
                        hasWaterInterp: !!n,
                        hasRenderFunc: typeof window.renderWaterProgressiveDisclosure,
                        waterDecisionLength: Ee ? Ee.length : 0,
                    }),
                    Qe)
            )
                (console.log("[GAIP] Water blender active - skipping standard water render"),
                    (function() {
                        // Populate GAIP_STATE.water from blend result so word export has data
                        try {
                            var _bs =
                                window.GAIP_WaterBlenderUI &&
                                window.GAIP_WaterBlenderUI.getState &&
                                window.GAIP_WaterBlenderUI.getState();
                            if (
                                _bs &&
                                _bs.blendResult &&
                                typeof GAIP_WaterBlender !== "undefined" &&
                                GAIP_WaterBlender.toHubWaterState
                            ) {
                                var _hw = GAIP_WaterBlender.toHubWaterState(_bs.blendResult);
                                if (_hw) {
                                    // Write to both state globals used by word export and synthesis modules
                                    if (typeof window.__GAIP_STATE__ !== "undefined") window.__GAIP_STATE__.water = _hw;
                                    if (typeof window.GAIP_STATE !== "undefined") window.GAIP_STATE.water = _hw;
                                    else window.GAIP_STATE = {
                                        water: _hw
                                    };
                                }
                            }
                        } catch (e) {}
                    })(),
                    window.GAIP_WaterBlenderUI.calculateAndDisplayBlend && window.GAIP_WaterBlenderUI.calculateAndDisplayBlend());
            else {
                var Xe = window.renderWaterProgressiveDisclosure ? window.renderWaterProgressiveDisclosure(n, e) : n;

                // Render phytotoxicity card if results exist
                var phytotoxHtml = "";
                if (
                    window.GAIP_PHYTOTOXICITY_RESULT &&
                    window.GAIP_PHYTOTOXICITY_RESULT.assessments?.length > 0 &&
                    typeof window.gaip_renderPhytotoxicityCard === "function"
                ) {
                    phytotoxHtml = window.gaip_renderPhytotoxicityCard(window.GAIP_PHYTOTOXICITY_RESULT);
                }

                (console.log("[Hub] Water HTML lengths - decision:", Ee ? Ee.length : 0, "progressive:", Xe ? Xe.length : 0),
                    (m.innerHTML = Ee + Xe + phytotoxHtml));
            }
        } else
            ((u.innerHTML = '<p class="gaip-note">Soil & Water analysis disabled. Enable the module to see results.</p>'),
                (m.innerHTML = ""));
        f.innerHTML = p ? Ne : '<p class="gaip-note">Traffic/Wear analysis disabled. Enable the module to see results.</p>';
        var et = document.querySelector(".gaip-enable-tissue")?.checked;
        if (
            (console.log("[Hub] Tissue section debug:", {
                    enableTissue: et,
                    paneTissue: !!y,
                    hasLastTissue: !!window.__GAIP_TISSUE_LAST__,
                    hasRenderFunc: typeof window.renderTissueProgressiveDisclosure,
                }),
                et && y)
        )
            if (window.__GAIP_TISSUE_LAST__) {
                var tt = window.__GAIP_TISSUE_LAST__;
                var rt = null;
                c &&
                    e.soil &&
                    (rt = {
                        pH_water: e.soil.pH_water || e.soil.pH_cacl2,
                        Na_ppm: e.soil.ppm?.Na || 0,
                        EC1_5: e.soil.EC1_5 || 0,
                        ECe: e.soil.ECe || 0,
                        soilTexture: e.soil.soilTexture || "loam",
                        ecw: e.water ? e.water.ecw : 0,
                        ppm: e.soil.ppm || {},
                    });
                var nt = window.renderTissueProgressiveDisclosure ?
                    window.renderTissueProgressiveDisclosure(null, tt, rt) :
                    '<p class="gaip-note">Tissue results available. Progressive disclosure not loaded.</p>';
                (console.log("[Hub] Tissue HTML length:", nt ? nt.length : 0), (y.innerHTML = nt));
            } else
                y.innerHTML =
                '<p class="gaip-note">Run tissue interpretation in the Tissue Testing card above to see results here.</p>';
        else
            y &&
            (y.innerHTML = '<p class="gaip-note">Tissue Testing analysis disabled. Enable the module to see results.</p>');
        (v && (v.innerHTML = X),
            b && (b.innerHTML = ve),
            x &&
            (x.innerHTML = p ?
                be :
                '<p class="gaip-note">Recovery calendar requires Traffic/Wear analysis to be enabled.</p>'),
            g ?
            ((h.innerHTML = Te + Ce),
                console.log("GAIP: Checking shade chart render..."),
                console.log("GAIP: ShadeForecast available:", void 0 !== window.ShadeForecast),
                console.log("GAIP: shade object exists:", !!l),
                console.log("GAIP: seasonalTrajectory exists:", !(!l || !l.seasonalTrajectory)),
                void 0 !== window.ShadeForecast &&
                l &&
                l.seasonalTrajectory &&
                setTimeout(function() {
                    var e = document.getElementById("gaip-shade-forecast-chart");
                    if ((console.log("GAIP: Shade chart container found:", !!e), e))
                        try {
                            (window.ShadeForecast.render(e, l), console.log("GAIP: Shade chart render called successfully"));
                        } catch (e) {
                            console.error("GAIP: Shade chart render error:", e);
                        }
                }, 100)) :
            (h.innerHTML = '<p class="gaip-note">Shade analysis disabled. Enable the module to see results.</p>'),
            console.log("GAIP: Starting PGR rendering..."));
        var it = document.querySelector(".gaip-pgr-body");
        if ((console.log("GAIP: panePGR element:", it), console.log("GAIP: state.pgr:", e.pgr), it))
            try {
                if (e.pgr && e.pgr.productType && "" !== e.pgr.productType ||
                        // b35fix232: fall back to GAIP_LAST_PGR when hidden inputs are empty
                        (window.GAIP_LAST_PGR && window.GAIP_LAST_PGR.product_key &&
                         (!e.pgr || !e.pgr.productType) &&
                         (e.pgr = e.pgr || {},
                          e.pgr.productType = window.GAIP_LAST_PGR.product_key,
                          e.pgr.applicationDate = window.GAIP_LAST_PGR.application_date,
                          e.pgr.rateLperHa = window.GAIP_LAST_PGR.rate || 0, true)))
                    if ((console.log("GAIP: PGR product selected:", e.pgr.productType), e.pgr.applicationDate))
                        if (
                            (console.log("GAIP: PGR date set:", e.pgr.applicationDate),
                                // b35fix218a: GSSH pages export gssh_pgr_calculate; GAIP pages export gaip_pgr_calculate.
                                // Resolve whichever is present so PGR renders on both page types.
                                (window._gilba_pgr_fn = window.gaip_pgr_calculate || window.gssh_pgr_calculate || null),
                                "function" == typeof window._gilba_pgr_fn)
                        ) {
                            var at = window._gilba_pgr_fn(e);
                            (console.log("GAIP: PGR status result:", at), (window.GAIP_PGR_RESULT = at));
                            var ot = null,
                                st = null;
                            if (
                                e.dmi &&
                                e.dmi.product &&
                                e.dmi.applicationDate &&
                                "function" == typeof window.gaip_dmi_calculate &&
                                (console.log("GAIP: Tracking DMI application..."),
                                    (ot = window.gaip_dmi_calculate(e)),
                                    console.log("GAIP: DMI status:", ot),
                                    (window.GAIP_DMI_RESULT = ot),
                                    ot && !ot.error && at && !at.error && void 0 !== window.GAIP_DMI)
                            ) {
                                var lt = at.effect.suppression || 0;
                                ((st = window.GAIP_DMI.assessCombinedRisk(lt, ot)),
                                    console.log("GAIP: Combined risk assessment:", st),
                                    (window.GAIP_COMBINED_SUPPRESSION = st));
                                // Compute adjusted suppression incorporating DMI interaction
                                if (window.GAIP_DMI.calcAdjustedSuppression) {
                                    var adjSupp = window.GAIP_DMI.calcAdjustedSuppression(lt, st);
                                    if (adjSupp && adjSupp.addedPct > 0 && at.effect) {
                                        at.effect.adjustedSuppression = adjSupp;
                                        if (window.GAIP_PGR_RESULT && window.GAIP_PGR_RESULT.effect) {
                                            window.GAIP_PGR_RESULT.effect.adjustedSuppression = adjSupp;
                                        }
                                    }
                                }
                            }
                            if (at && !at.error) {
                                ((at.applicationDate = e.pgr.applicationDate),
                                    (at.product.name = e.pgr.productType || at.product.type));
                                var dt = new Date(e.pgr.applicationDate),
                                    ct = new Date(),
                                    pt = Math.floor((ct - dt) / 864e5);
                                ((at.daysSinceApplication = pt >= 0 ? pt : 0),
                                    (at.product.activeIngredient = at.product.type || "TE"),
                                    (at.gdd.baseTemp = at.gdd.base || at.species?.gddBase || 0),
                                    (at.gdd.progressPct = Math.round(100 * (at.gdd.progress || 0))),
                                    (at.gdd.days = pt >= 0 ? pt : 0),
                                    (at.gdd.isOverdue = at.gdd.progress >= 1),
                                    (at.gdd.overdue = at.gdd.isOverdue ? Math.abs(at.gdd.remaining) : 0));
                                var gt = at.gdd.progress || 0;
                                ((at.effect.reapplicationStatus = gt >= 0.75 ? "due" : gt >= 0.6 ? "approaching" : "active"),
                                    (at.baseTempConfig = {
                                        base: at.gdd?.base || at.species?.gddBase || 0,
                                    }),
                                    (at.mowingHeight = {
                                        category: at.surface?.type || "greens",
                                        categoryLabel: at.surface?.type || "greens",
                                        thresholdMultiplier: 1,
                                    }));
                                var ut = 10;
                                if (window.rawWeatherData && window.rawWeatherData.hourly) {
                                    var mt = window.rawWeatherData.hourly.temperature_2m || [];
                                    if (mt.length >= 24) {
                                        var ft =
                                            mt.slice(0, 24).reduce(function(e, t) {
                                                return e + t;
                                            }, 0) / 24,
                                            yt = at.gdd?.base || 0;
                                        ut = Math.max(0, ft - yt);
                                    }
                                }
                                if (
                                    ((at.projection = {
                                            dailyGDDRate: ut,
                                            daysToThreshold: at.gdd?.remaining ? Math.ceil(at.gdd.remaining / ut) : 0,
                                        }),
                                        (at.sinewaveModel = {
                                            raw: {
                                                amplitude: 0.4,
                                                period: at.gdd?.threshold ? 2 * at.gdd.threshold : 400,
                                            },
                                        }),
                                        void 0 !== window.GAIP_PGRUI && window.GAIP_PGRUI.render)
                                ) {
                                    if (
                                        (console.log("GAIP: Rendering PGR UI..."),
                                            window.GAIP_PGRUI.render(it, at, {
                                                showConfig: !1,
                                            }),
                                            ot && !ot.error && ot.hasActiveApplication)
                                    ) {
                                        var ht = ot.gdd.estimated ? " (est.)" : "",
                                            vt =
                                            "high" === ot.risk.overall ? "#dc2626" : "moderate" === ot.risk.overall ? "#f59e0b" : "#22c55e",
                                            bt =
                                            '<div style="margin-top:12px;padding:12px;background:' +
                                            ("high" === ot.risk.overall ?
                                                "var(--gaip-critical-bg)" :
                                                "moderate" === ot.risk.overall ?
                                                "var(--gaip-warning-bg)" :
                                                "var(--gaip-good-bg)") +
                                            ";border-radius:8px;border-left:4px solid " +
                                            vt +
                                            ';">';
                                        if (
                                            ((bt +=
                                                    '<div style="font-weight:600;color:#1e40af;margin-bottom:8px;">💊 Active DMI Fungicide</div>'),
                                                (bt += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">'),
                                                (bt += "<div><strong>" + ot.product.name.split("(")[0].trim() + "</strong></div>"),
                                                (bt +=
                                                    '<div style="text-align:right;color:' +
                                                    vt +
                                                    ';">' +
                                                    ot.risk.overall.toUpperCase() +
                                                    " risk</div>"),
                                                (bt +=
                                                    '<div style="color:var(--gaip-text);">GDD' +
                                                    (ot.gdd.baseTemp > 0 ? "<sub>" + ot.gdd.baseTemp + "</sub>" : "₀") +
                                                    ": " +
                                                    ot.gdd.accumulated +
                                                    " / " +
                                                    ot.gdd.typicalDuration +
                                                    ht +
                                                    "</div>"),
                                                (bt +=
                                                    '<div style="text-align:right;color:var(--gaip-text);">~' +
                                                    ot.status.daysRemaining +
                                                    " days remaining</div>"),
                                                (bt += "</div>"),
                                                "high" === ot.risk.species &&
                                                ((bt +=
                                                        '<div style="margin-top:8px;padding:6px;background:rgba(220,38,38,0.1);border-radius:4px;font-size:11px;color:#991b1b;">'),
                                                    (bt += "⚠️ " + ot.risk.speciesName + " has HIGH sensitivity to DMI phytotoxicity"),
                                                    (bt += "</div>")),
                                                (bt += "</div>"),
                                                st && st.hasCombinedRisk)
                                        ) {
                                            var xt =
                                                "danger" === st.warningLevel ?
                                                "#dc2626" :
                                                "warning" === st.warningLevel ?
                                                "#f59e0b" :
                                                "#eab308";
                                            ((bt +=
                                                    '<div style="margin-top:12px;padding:12px;background:' +
                                                    ("danger" === st.warningLevel ?
                                                        "var(--gaip-critical-bg)" :
                                                        "warning" === st.warningLevel ?
                                                        "var(--gaip-warning-bg)" :
                                                        "var(--gaip-warning-bg)") +
                                                    ";border-radius:8px;border:1px solid " +
                                                    xt +
                                                    ';">'),
                                                (bt += '<div style="font-weight:600;color:' + xt + ';margin-bottom:6px;">'),
                                                (bt += ("danger" === st.warningLevel ? "⛔" : "⚠️") + " PGR + DMI Interaction Risk</div>"),
                                                (bt += '<div style="font-size:12px;color:var(--gaip-text);">'),
                                                (bt +=
                                                    "PGR: " + st.pgrSuppression + "% suppression | DMI: " + st.dmiRiskCategory + " risk</div>"),
                                                (bt += '<div style="font-size:12px;margin-top:6px;">' + st.message + "</div>"),
                                                st.recommendation &&
                                                ((bt +=
                                                        '<div style="font-size:11px;margin-top:6px;padding:6px;background:var(--gaip-surface);border-radius:4px;">'),
                                                    (bt += "💡 " + st.recommendation + "</div>")),
                                                (bt += "</div>"));
                                        } else
                                            ot.hasActiveApplication &&
                                            ((bt +=
                                                    '<div style="margin-top:8px;padding:8px;background:var(--gaip-good-bg);border-radius:6px;font-size:12px;color:#166534;">'),
                                                (bt += "✓ Low interaction risk with current PGR program"),
                                                (bt += "</div>"));
                                        it.innerHTML += bt;
                                    }
                                } else {
                                    var wt =
                                        "due" === at.effect.reapplicationStatus ?
                                        "#dc2626" :
                                        "approaching" === at.effect.reapplicationStatus ?
                                        "#f59e0b" :
                                        "#22c55e";
                                    it.innerHTML =
                                        '<div style="padding:16px;background:var(--gaip-info-bg);border-radius:8px;border-left:4px solid ' +
                                        wt +
                                        '"><strong>' +
                                        at.product.name +
                                        "</strong><br>GDD: " +
                                        at.gdd.accumulated +
                                        " / " +
                                        at.gdd.threshold +
                                        " (" +
                                        at.gdd.progressPct +
                                        "%)<br>Status: " +
                                        at.effect.reapplicationStatus +
                                        "<br>Suppression: " +
                                        at.effect.suppressionPct +
                                        "%" +
                                        ("ok" !== at.shade.warning.status ?
                                            '<br><span style="color:#dc2626;">⚠️ ' + at.shade.warning.action + "</span>" :
                                            "") +
                                        "</div>";
                                }
                            } else
                                (console.log("GAIP: PGR status error:", at?.message),
                                    (it.innerHTML =
                                        '<p class="gaip-note" style="color:#dc2626;">' +
                                        (at?.message || "PGR calculation error") +
                                        "</p>"));
                        } else
                            (console.log("GAIP: gaip_pgr_calculate function not found"),
                                (it.innerHTML = '<p class="gaip-note">PGR module not loaded. Check browser console.</p>'));
                else if (
                    (console.log("GAIP: No PGR application date"),
                        e.dmi && e.dmi.product && e.dmi.applicationDate && "function" == typeof window.gaip_dmi_calculate)
                ) {
                    var St = window.gaip_dmi_calculate(e);
                    if (St && !St.error) {
                        var Ct = '<p class="gaip-note">No PGR program configured.</p>';
                        ((Ct +=
                                '<div style="margin-top:12px;padding:12px;background:var(--gaip-info-bg);border-radius:8px;border-left:4px solid #2563eb;">'),
                            (Ct +=
                                '<div style="font-weight:600;color:#1e40af;margin-bottom:8px;">💊 DMI Fungicide Effect (no PGR)</div>'),
                            (Ct += '<div style="font-size:13px;"><strong>' + St.product.name + "</strong></div>"),
                            (Ct += '<div style="font-size:13px;">Growth suppression: ' + St.suppression.currentPct + "%</div>"),
                            (Ct +=
                                '<div style="font-size:12px;color:var(--gaip-text);">GDD: ' +
                                St.gdd.accumulated +
                                " / " +
                                St.gdd.threshold +
                                "</div>"),
                            (Ct +=
                                '<div style="font-size:12px;color:var(--gaip-text);">Effect ends: ~' +
                                St.projection.effectEndsDate +
                                "</div>"),
                            (Ct += "</div>"),
                            (it.innerHTML = Ct));
                    } else it.innerHTML = '<p class="gaip-note">Enter PGR application date to see GDD tracking.</p>';
                } else it.innerHTML = '<p class="gaip-note">Enter PGR application date to see GDD tracking.</p>';
                else
                    (console.log("GAIP: No PGR product selected"),
                        (it.innerHTML =
                            '<p class="gaip-note">No PGR program configured. Select a product and application date in Turf System inputs.</p>'));
            } catch (e) {
                (console.error("PGR rendering error:", e),
                    (it.innerHTML = '<p class="gaip-note" style="color:#dc2626;">PGR module error: ' + e.message + "</p>"));
            }
        else console.warn("GAIP: .gaip-pgr-body container not found in DOM");
        if (e.climate && e.climate.manual && !e.climate.useLiveWeather) {
            var Mt = e.climate.manual.temperature || {},
                It = e.climate.manual.moisture || {},
                kt = Mt.max || Mt.min,
                At = It.humidity;
            if (kt || At) {
                var Et = Mt.max || 25,
                    Nt = Mt.min || 15,
                    Tt = ((ft = (Et + Nt) / 2), Mt.soil),
                    Pt = !1;
                if (!Tt && kt) {
                    var Rt = ft > 20 ? -1.5 : 1;
                    ((Tt = Math.round(10 * (0.85 * ft + 0.1 * (Et - Nt) + Rt)) / 10),
                        (Pt = !0),
                        console.log("📊 Soil temp estimated from air temps:", Tt + "°C (estimated)"));
                }
                var $t = e.climate.manual.et0 || null;
                !$t && kt && ($t = Math.max(1, Math.round(10 * (0.15 * (Et - Nt) + 0.1 * ft - 1)) / 10));
                var Ft = {
                    temperature: {
                        mean: ft,
                        max: Et,
                        min: Nt,
                        soil: Tt,
                        soilEstimated: Pt,
                    },
                    stress: {},
                    growth: {
                        c3: calcC3GrowthPotential(ft),
                        c4: calcC4GrowthPotential(ft),
                        weighted: (calcC3GrowthPotential(ft) + calcC4GrowthPotential(ft)) / 2,
                    },
                    moisture: {
                        // b35fix345: null-passthrough when manual humidity not entered.
                        // Pre-fix `It.humidity || 70` planted literal 70 into
                        // window.climateMetrics.moisture.humidity.mean — picked up by
                        // hub-orchestrator's getAuthoritativeClimate as if real data,
                        // dispatched to disease-engine-pure where Smith-Kerns and
                        // Fidanza Brown Patch logged `MEANRH 70.00 (period mean)`
                        // and `meanRH 70.0% (period mean (fallback))` on every Kew
                        // first-paint analysis after site-switch, before live weather
                        // fetch returned. Production log gilbasolutions_com-1777182748764
                        // 2026-04-26 lines 1798-1810, 1854-1866. Emit null with a
                        // dataSource tag so downstream engines degrade explicitly.
                        humidity: {
                            mean: It.humidity != null ? It.humidity : null,
                            night: It.humidity != null ? It.humidity : null,
                            dataSource: It.humidity != null ? 'manual' : 'no-data',
                        },
                        rainfall: It.rainfall || 0,
                        et0: $t,
                        leafWetness: 0,
                    },
                    _source: "manual",
                };
                ((window.climateMetrics = validateClimateMetrics(Ft)),
                    console.log("✅ Manual climateMetrics created & validated:", window.climateMetrics),
                    console.log("   Temperature: " + Nt + "°C - " + Et + "°C (avg " + ft.toFixed(1) + "°C)"),
                    Tt && console.log("   Soil temp: " + Tt + "°C" + (Pt ? " (estimated)" : " (entered)")),
                    $t && console.log("   ET₀: " + $t + " mm/day" + (e.climate.manual.et0 ? "" : " (estimated)")));
                N = e.turf?.grassSpecies || "";
                var _t = generateClimateStatusSummary(window.climateMetrics, N, e);
                (console.log("   Status: " + _t.icon + " " + _t.text), (window.climateStatusSummary = _t));
            }
        }
        var Dt = document.querySelector(".gaip-sensor-body"),
            Gt = document.getElementById("gaip-sensor-results-section");
        // b35fix297: Show sensor results for ANY source (CSV, Hydrosight live, SpecConnect).
        // Previous _csvOnly guard excluded live Hydrosight data from this section entirely.
        // Now uses SensorBridge.hasData() which checks all sources, falling back to
        // GAIP_Sensor.hasData() if bridge is not loaded.
        var _hasSensorData = window.GAIP_SensorBridge ?
            window.GAIP_SensorBridge.hasData() :
            window.GAIP_Sensor && window.GAIP_Sensor.hasData();
        if (Dt && _hasSensorData) {
            try {
                Gt && (Gt.style.display = "block");
                // b35fix297: Read zone summaries from bridge (normalised array from all sources)
                // Falls back to GAIP_Sensor.getZoneSummaries() if bridge unavailable
                var Lt = window.GAIP_SensorBridge && window.GAIP_SensorBridge.getZoneSummaries
                    ? window.GAIP_SensorBridge.getZoneSummaries()
                    : (window.GAIP_Sensor && window.GAIP_Sensor.getZoneSummaries ? window.GAIP_Sensor.getZoneSummaries() : null);
                var _readingCount = window.GAIP_SensorBridge && window.GAIP_SensorBridge.getReadingCount
                    ? window.GAIP_SensorBridge.getReadingCount()
                    : 0;
                var Ot = window.GAIP_Sensor && window.GAIP_Sensor.getData ? window.GAIP_Sensor.getData() : [];
                var zt =
                    '<div style="padding: 16px; background: linear-gradient(135deg, var(--gaip-good-bg) 0%, var(--gaip-good-bg) 100%); border-radius: 8px; border-left: 4px solid #10b981;">';
                if (Lt && Array.isArray(Lt) && Lt.length > 0)
                    ((zt += '<div style="font-weight: 600; color: #166534; margin-bottom: 12px;">📊 Zone Summary</div>'),
                        (zt +=
                            '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">'),
                        Lt.forEach(function(e) {
                            if (e.name && "Unlabelled" !== e.name) {
                                var t = e.avg;
                                if (null != t) {
                                    var r = t < 15 ? "#dc2626" : t < 20 ? "#f59e0b" : t > 35 ? "#3b82f6" : "#16a34a",
                                        n = t < 15 ? "Dry" : t < 20 ? "Low" : t > 35 ? "Wet" : "Optimal";
                                    ((zt +=
                                            '<div style="background: var(--gaip-surface); padding: 12px; border-radius: 6px; border: 1px solid var(--gaip-good-bg);">'),
                                        (zt += '<div style="font-weight: 600; color: #065f46; font-size: 13px;">' + e.name + "</div>"),
                                        (zt +=
                                            '<div style="font-size: 24px; font-weight: 700; color: ' + r + ';">' + t.toFixed(1) + "%</div>"),
                                        (zt +=
                                            '<div style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">VWC (' + n + ")</div>"),
                                        (zt += '<div style="font-size: 11px;  margin-top: 4px;">' + e.count + " readings</div>"),
                                        (zt += "</div>"));
                                }
                            }
                        }),
                        (zt += "</div>"));
                else if (Ot.readings && Ot.readings.length > 0) {
                    var Ht = Ot.readings,
                        qt = Ht.reduce(function(e, t) {
                            return e + (t.vwc || 0);
                        }, 0),
                        Wt = qt / Ht.length;
                    ((zt += '<div style="font-weight: 600; color: #166534; margin-bottom: 8px;">📊 Sensor Overview</div>'),
                        (zt += '<div style="font-size: 14px;"><strong>' + Ht.length + "</strong> readings imported</div>"),
                        (zt += '<div style="font-size: 14px;">Average VWC: <strong>' + Wt.toFixed(1) + "%</strong></div>"),
                        (zt +=
                            '<div style="font-size: 12px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin-top: 8px;">💡 Label zones in the Sensor Import section for detailed zone analysis</div>'));
                }
                ((zt += "</div>"),
                    (Dt.innerHTML = zt),
                    (window.GAIP_STATE = window.GAIP_STATE || {}),
                    (window.GAIP_STATE.sensorData = {
                        zones: Lt,
                        readings: _readingCount || (Ot.readings ? Ot.readings.length : 0),
                    }));
            } catch (e) {
                (console.error("Sensor rendering error:", e),
                    (Dt.innerHTML = '<p class="gaip-note" style="color:#dc2626;">Sensor data error: ' + e.message + "</p>"));
            }
        } else(Gt && (Gt.style.display = "none"), console.log("GAIP: No sensor data available"));
        var Ut = document.querySelector(".gaip-irrigation-body");
        if (
            (console.log("GAIP: paneIrrigation element:", Ut),
                console.log("GAIP: GAIP_IrrigationScheduler exists:", typeof window.GAIP_IrrigationScheduler),
                Ut)
        )
            try {
                if (void 0 !== window.GAIP_IrrigationScheduler) {
                    // v9.8.0: Transform weather data for irrigation scheduler using climate engine helper
                    var irrigationWeather = t;
                    if (window.gaip_climate_get_irrigation_forecast && t) {
                        irrigationWeather = window.gaip_climate_get_irrigation_forecast(t, window.climateMetrics);
                        console.log("GAIP: Transformed weather for irrigation:", irrigationWeather);
                    }
                    var Bt = window.GAIP_IrrigationScheduler.schedule(
                        (function() {
                            // Inject sensor VWC into legacy irrigation state.
                            // hub-tissue reads soilVWC from DOM only; override with sensor mean
                            // VWC when TDR data is available and soilVWC wasn't manually entered.
                            if (
                                window.GAIP_Sensor &&
                                typeof window.GAIP_Sensor.hasData === "function" &&
                                window.GAIP_Sensor.hasData()
                            ) {
                                try {
                                    // Verify sensor data belongs to the active site —
                                    // during site switch, sensor memory may hold the outgoing site's data.
                                    // b35fix272: GAIP_SiteContext is the single source of truth
                                    var _activeSiteId = window.GAIP_SiteContext
                                        ? window.GAIP_SiteContext.getSiteId()
                                        : (window.GAIP_SampleManager && typeof GAIP_SampleManager.getActiveSiteId === "function" ? GAIP_SampleManager.getActiveSiteId() : null);
                                    var _sensorSiteId = typeof GAIP_Sensor.getSiteId === "function" ? GAIP_Sensor.getSiteId() : null;
                                    if (_activeSiteId && _sensorSiteId && _activeSiteId !== _sensorSiteId) {} else {
                                        var sd = window.GAIP_Sensor.getIrrigationData();
                                        if (sd && sd.vwc != null && (e.irrigation.soilVWC == null || e.irrigation.soilVWC === 0)) {
                                            e = Object.assign({}, e, {
                                                irrigation: Object.assign({}, e.irrigation, {
                                                    soilVWC: sd.vwc
                                                }),
                                            });
                                        }
                                    }
                                } catch (_) {}
                            }
                            return e;
                        })(),
                        irrigationWeather,
                    );
                    if ((console.log("GAIP: Schedule result:", Bt), (window.GAIP_IRRIGATION_RESULT = Bt), Bt && !Bt.error))
                        if (void 0 !== window.GAIP_IrrigationUI)
                            (console.log("GAIP: Rendering Irrigation UI..."),
                                (Ut.innerHTML = window.GAIP_IrrigationUI.renderSchedule(Bt)),
                                setTimeout(function() {
                                    "function" == typeof window.GAIP_IrrigationUI.renderForecastChart &&
                                        window.GAIP_IrrigationUI.renderForecastChart(Bt);
                                }, 100));
                        else {
                            P = Bt.summary || {};
                            Ut.innerHTML =
                                '<div style="padding:16px;background:var(--gaip-info-bg);border-radius:8px;border-left:4px solid #3b82f6;"><strong>💧 Irrigation Summary</strong><br>Total ET: ' +
                                (P.totalET || 0).toFixed(1) +
                                " mm<br>Effective Rain: " +
                                (P.effectiveRain || 0).toFixed(1) +
                                " mm<br>Irrigation Needed: " +
                                (P.irrigationNeeded || 0).toFixed(1) +
                                " mm<br>Events: " +
                                (P.irrigationEvents || 0) +
                                "</div>";
                        }
                    else
                        (console.log("GAIP: Schedule error:", Bt?.error),
                            (Ut.innerHTML = '<p class="gaip-note">' + (Bt?.error || "Irrigation calculation unavailable") + "</p>"));
                } else if (t && t.daily) {
                    console.log("GAIP: No IrrigationScheduler, using basic water balance");
                    var jt = 0,
                        Vt = 0;
                    (t.daily.forEach(function(e) {
                            ((jt += e.et0_fao_evapotranspiration || e.et0 || 0), (Vt += e.precipitation_sum || e.rain || 0));
                        }),
                        (Ut.innerHTML =
                            '<div style="padding:16px;background:var(--gaip-info-bg);border-radius:8px;border-left:4px solid #3b82f6;"><strong>💧 Basic Water Balance</strong><br>Period ET₀: ' +
                            jt.toFixed(1) +
                            " mm<br>Period Rainfall: " +
                            Vt.toFixed(1) +
                            " mm<br>Balance: " +
                            (Vt - jt).toFixed(1) +
                            " mm" +
                            (Vt < jt ? '<br><span style="color:#f59e0b;">⚠️ Irrigation likely needed</span>' : "") +
                            "</div>"));
                } else
                    (console.log("GAIP: No scheduler and no weather data"),
                        (Ut.innerHTML = '<p class="gaip-note">Irrigation scheduler requires weather data.</p>'));
            } catch (e) {
                (console.error("Irrigation rendering error:", e),
                    (Ut.innerHTML =
                        '<p class="gaip-note" style="color:#dc2626;">Irrigation module error: ' + e.message + "</p>"));
            }
        else console.warn("GAIP: .gaip-irrigation-body container not found in DOM");
        var Kt = document.querySelector(".gaip-climate-body");
        if (Kt)
            try {
                if (
                    (t &&
                        ((t.daily && t.daily.length > 0) ||
                            (t.forecast && t.forecast.hourly) ||
                            (t.forecast && t.forecast.daily) ||
                            t.manual)) ||
                    window.climateMetrics
                )
                    if (void 0 !== window.GAIP_ClimateV2 && window.GAIP_ClimateV2.analyze) {
                        var Yt = window.GAIP_ClimateV2.analyze(e, t);
                        if ((console.log("GAIP: Climate v2 result:", Yt), Yt && !Yt.error)) {
                            if (
                                (void 0 !== window.GAIP_ClimateV2UI && window.GAIP_ClimateV2UI.render ?
                                    (Kt.innerHTML = window.GAIP_ClimateV2UI.render(Yt)) :
                                    (console.log("GAIP: ClimateV2UI not available, using fallback"), renderBasicClimateInfo(Kt, t, e)),
                                    window.climateMetrics && window.climateMetrics.growth)
                            ) {
                                var Zt = Yt.drought,
                                    Jt = Yt.growthPotential,
                                    Qt = null,
                                    Xt = null,
                                    er = null;
                                if (
                                    (Jt && "number" == typeof Jt.adjustedGrowthPotential ?
                                        ((Qt = Jt.adjustedGrowthPotential),
                                            (Xt = Zt ? Zt.gpC3 : Jt.isC4 ? 0 : Jt.baseGrowthPotential),
                                            (er = Zt ? Zt.gpC4 : Jt.isC4 ? Jt.baseGrowthPotential : 0)) :
                                        Zt &&
                                        "number" == typeof Zt.growthPotential &&
                                        ((Qt = Zt.growthPotential), (Xt = Zt.gpC3), (er = Zt.gpC4)),
                                        null !== Qt)
                                ) {
                                    var tr = window.climateMetrics.growth.weighted;
                                    ((window.climateMetrics.growth.weighted = Qt),
                                        // Zero out C4 GP for pure C3 grasses — drought path sets gpC4 from
                                        // the hypothetical C4 curve even for bentgrass/ryegrass.
                                        // v10.9.9b: Mirror Path B logic — use speciesFractions (not dead .species),
                                        // set null (not 0) so display hides the irrelevant species.
                                        (function() {
                                            var _c4f = e?.turf?.speciesFractions?.c4Fraction ?? 1;
                                            var _c3f = e?.turf?.speciesFractions?.c3Fraction ?? 1;
                                            if (_c4f === 0) {
                                                er = null;
                                                console.log("[C4 FIX Path-A] Pure C3 grass — gpC4 set to null");
                                            }
                                            if (_c3f === 0) {
                                                Xt = null;
                                                console.log("[C3 FIX Path-A] Pure C4 grass — gpC3 set to null");
                                            }
                                        })(),
                                        er !== null ? (window.climateMetrics.growth.c4 = er) : (window.climateMetrics.growth.c4 = null),
                                        Xt !== null ? (window.climateMetrics.growth.c3 = Xt) : (window.climateMetrics.growth.c3 = null),
                                        (window.GAIP_CLIMATE_V2_RESULT = Yt),
                                        console.log(
                                            "✅ Climate V2 GP synced to climateMetrics: " +
                                            tr +
                                            "% -> " +
                                            Qt +
                                            "% (C3=" +
                                            Xt +
                                            "%, C4=" +
                                            er +
                                            "%)",
                                        ));
                                } else console.warn("⚠️ Climate V2 GP sync failed - no valid GP data found in result");
                            }
                        } else(console.log("GAIP: Climate v2 returned error:", Yt?.error), renderBasicClimateInfo(Kt, t, e));
                    } else(console.log("GAIP: Climate v2 not available, using fallback"), renderBasicClimateInfo(Kt, t, e));
                else Kt.innerHTML = '<p class="gaip-note">Climate data not available. Check location and weather settings.</p>';
            } catch (e) {
                (console.error("Climate rendering error:", e),
                    (Kt.innerHTML = '<p class="gaip-note" style="color:#dc2626;">Climate module error: ' + e.message + "</p>"));
            }
        else console.warn("GAIP: .gaip-climate-body container not found");
        var rr = `\n    <div style="margin: 30px 0; padding: 20px; background: var(--gaip-surface-muted); border: 2px solid var(--gaip-border); border-radius: 8px;">\n        <h3 style="margin: 0 0 15px 0; color: var(--gaip-text);">📋 Forensic Decision Record</h3>\n        <p style="font-size: 13px; color: var(--gaip-text-muted, var(--gaip-text-secondary)); margin: 0 0 15px 0;">\n            <strong>Run ID:</strong> ${FORENSIC_RECORD.runID}<br>\n            <strong>Timestamp:</strong> ${new Date(FORENSIC_RECORD.timestamp).toLocaleString()}\n        </p>\n        <button onclick="if(window.GAIP_PDFExport){GAIP_PDFExport.export()}else{exportForensicRecordPDF()}" style="\n            background: #2e7d32;\n            color: var(--gaip-surface);\n            border: none;\n            padding: 10px 20px;\n            border-radius: 6px;\n            cursor: pointer;\n            font-size: 14px;\n            font-weight: 600;\n        ">📄 Export Full Report (PDF)</button>\n        <p style="font-size: 11px;  margin: 10px 0 0 0;">\n            Comprehensive A4 report with all analysis sections, charts, and forensic decision record.\n        </p>\n    </div>\n    `,
            nr = document.querySelector(".gaip-results");
        (nr && nr.insertAdjacentHTML("beforeend", rr),
            setTimeout(function() {
                document.querySelectorAll(".gaip-collapsible-btn").forEach(function(e) {
                    var t = e.nextElementSibling;
                    (t && t.classList.contains("gaip-collapsible-content") && (t.style.maxHeight = null),
                        e.addEventListener("click", function() {
                            this.classList.toggle("active");
                            var e = this.nextElementSibling;
                            e.style.maxHeight && "0px" !== e.style.maxHeight ?
                                (e.style.maxHeight = null) :
                                (e.style.maxHeight = e.scrollHeight + "px");
                        }));
                });
            }, 30));
    } else console.warn("GAIP: result panes missing in DOM");

    function ir(e, t) {
        return `\n        <div class="gaip-collapsible">\n            <button class="gaip-collapsible-btn">${e}</button>\n            <div class="gaip-collapsible-content">\n                ${t}\n            </div>\n        </div>`;
    }
}

function initSurfaceTypeMode() {
    var e = document.querySelector(".gaip-subcategory-option.selected"),
        t = e?.dataset?.surface || window.gaipTurfProfile?.state?.subCategory || "",
        r = document.querySelector(".gaip-grass-species")?.value || "",
        n = "greens" === t || r.toLowerCase().includes("greens") || r.toLowerCase().includes("putting"),
        i = document.querySelector(".gaip-stratified-om-section");
    i && (i.style.display = n ? "block" : "none");
}

function initTurfTypeMode() {
    var e = document.querySelector(".gaip-turf-type")?.value || "sports",
        t = document.querySelector('[data-section="calendar"]'),
        r = document.querySelectorAll(".gaip-golf-grasses"),
        n = document.querySelectorAll(".gaip-sports-grasses"),
        i = document.querySelectorAll(".gaip-golf-only");
    if ("golf" === e) {
        (t && (t.style.display = "none"),
            r.forEach(function(e) {
                e.style.display = "";
            }),
            n.forEach(function(e) {
                e.style.display = "none";
            }),
            i.forEach(function(e) {
                e.style.display = "";
            }));
        var a = document.querySelector(".gaip-warm-base"),
            o = document.querySelector(".gaip-cool-overseed");
        (a && a.value && !a.value.includes("Greens") && (a.value = ""),
            o && o.value && !o.value.includes("Greens") && (o.value = ""));
        var s = document.querySelector('[data-section="traffic"]');
        if (s)
            if (!s.querySelector(".gaip-golf-mode-note")) {
                var l = s.querySelector(".gaip-result-body");
                if (l)
                    (((d = document.createElement("div")).className = "gaip-golf-mode-note"),
                        (d.style.cssText =
                            "padding: 10px; background: var(--gaip-info-bg); border-left: 3px solid #3b82f6; margin-bottom: 15px; border-radius: 4px; font-size: 12px;"),
                        (d.innerHTML =
                            "\n                        <strong>⛳ Golf Course Mode:</strong><br>\n                        Traffic analysis adapted for golf (continuous daily play vs event-based recovery).\n                        Recovery calendar hidden - not applicable for golf course traffic patterns.\n                    "),
                        l.insertBefore(d, l.firstChild));
            }
    } else {
        (t && (t.style.display = "block"),
            n.forEach(function(e) {
                e.style.display = "";
            }),
            r.forEach(function(e) {
                e.style.display = "none";
            }),
            i.forEach(function(e) {
                e.style.display = "none";
            }));
        var d;
        ((a = document.querySelector(".gaip-warm-base")), (o = document.querySelector(".gaip-cool-overseed")));
        (a && a.value && a.value.includes("Greens") && (a.value = ""),
            o && o.value && o.value.includes("Greens") && (o.value = ""),
            (d = document.querySelector(".gaip-golf-mode-note")) && d.remove());
    }
}
(document.addEventListener("DOMContentLoaded", function() {
        var e = document.querySelector(".gaip-run-btn");
        // PATCH: Re-entry guard + cooldown to prevent triple-run on page load.
        // gilba-hub-v2.js re-triggers analysis when ambient-dli:ready or state:saved fire
        // during the first run, causing 2-3 redundant full analysis cycles.
        var _analysisRunning = false;
        var _lastRunAt = 0;
        var _COOLDOWN_MS = 3000; // minimum 3s between analysis runs
        e
            ?
            (console.log("✓ GAIP: Run button found, attaching event listener"),
                e.addEventListener("click", async function() {
                    // PATCH: Skip if already running or within cooldown
                    var now = Date.now();
                    if (_analysisRunning) {
                        console.log("[GAIP] Analysis already in progress — skipping re-entry");
                        return;
                    }
                    if (now - _lastRunAt < _COOLDOWN_MS) {
                        console.log(
                            "[GAIP] Analysis cooldown active (" +
                            Math.round((_COOLDOWN_MS - (now - _lastRunAt)) / 1000) +
                            "s remaining) — skipping",
                        );
                        return;
                    }
                    _analysisRunning = true;
                    _lastRunAt = now;

                    var e = document.querySelector("#gaip-hub");
                    if (e) {
                        try {
                            var t = gaip_build_state(e);
                            if ((console.log("State:", t), t.pgr && t.pgr.applicationDate)) {
                                var r = new Date(t.pgr.applicationDate);
                                r.setHours(0, 0, 0, 0);
                                var n = new Date();
                                if ((n.setHours(0, 0, 0, 0), r < n)) {
                                    var i = Math.ceil((n - r) / 864e5);
                                    (console.log("GAIP: PGR application date is", i, "days ago - enabling historical weather fetch"),
                                        t.climate.historical || (t.climate.historical = {}),
                                        (t.climate.historical.enabled = !0),
                                        (t.climate.historical.lookbackDays = Math.min(i + 7, 90)),
                                        (t.climate.historical.startDate = t.pgr.applicationDate));
                                }
                            }
                            var a = await gaip_fetch_weather(t);
                            if (
                                ((window.currentState = t),
                                    a && (window.rawWeatherData = a), // only overwrite on successful fetch — preserve last good data on failure
                                    // Dispatch weather-ready so StressTrajectory and disease modules
                                    // can re-run if they previously fired on fallback data (cold-start race).
                                    a &&
                                    document.dispatchEvent(
                                        new CustomEvent("gaip:weather-ready", {
                                            detail: {
                                                hasHourly: !!(a.forecast && a.forecast.hourly),
                                                hasDaily: !!(a.daily || (a.forecast && a.forecast.daily)),
                                            },
                                            bubbles: true,
                                        }),
                                    ),
                                    a &&
                                    (a.forecast &&
                                        (a.forecast.hourly && !a.hourly && (a.hourly = a.forecast.hourly),
                                            a.forecast.daily && !a.daily && (a.daily = a.forecast.daily)),
                                        t.climate.lat && (a.latitude = t.climate.lat),
                                        t.climate.lon && (a.longitude = t.climate.lon)),
                                    void 0 !== window.AmbientDLIEngine && a)
                            )
                                try {
                                    var o = {};
                                    (a.forecast &&
                                        (a.forecast.hourly && (o.hourly = a.forecast.hourly),
                                            a.forecast.daily && (o.daily = a.forecast.daily)),
                                        a.historical && a.historical.daily && (o.daily || (o.daily = a.historical.daily)));
                                    var s = window.AmbientDLIEngine.calculate(o, t);
                                    s &&
                                        s.current > 0 &&
                                        ((t.ambientDLI = s),
                                            (t.turf = t.turf || {}),
                                            (t.turf.ambientDLI = s.current),
                                            (t.turf.ambientDLISource = s.source),
                                            (window.gaip_currentAmbientDLI = s),
                                            // Sync ambient DLI into climateMetrics.solar.dli so the C&W card and
                                            // the Shade/Stress card both show the same canonical DLI value.
                                            // ambient-dli-engine uses historical api_daily sums which are more
                                            // accurate than the forecast hourly average used by climate-engine.
                                            window.climateMetrics &&
                                            window.climateMetrics.solar &&
                                            (window.climateMetrics.solar.dli = Math.round(s.current * 10) / 10),
                                            // Update the ambient DLI UI banner directly
                                            window.AmbientDLIIntegration &&
                                            window.AmbientDLIIntegration.updateUI &&
                                            window.AmbientDLIIntegration.updateUI(s),
                                            document.dispatchEvent(new CustomEvent("gaip:ambient-dli-ready", {
                                                detail: s
                                            })),
                                            console.log(
                                                "[Hub] Ambient DLI calculated:",
                                                s.current,
                                                "mol/m²/day (" + s.source + ") — synced to climateMetrics.solar.dli",
                                            ));
                                } catch (e) {
                                    console.warn("[Hub] Ambient DLI calculation failed:", e);
                                }
                            var l,
                                d,
                                c = a && a.forecast && a.forecast.hourly && a.forecast.hourly.temperature_2m,
                                p = a && a.historical && a.historical.hourly && a.historical.hourly.temperature_2m;
                            a && a.manual && t.climate && t.climate.manual;
                            
                            // b35fix374: Initialize fallback P object for failed weather fetch.
                            // When gaip_fetch_weather() fails or returns unexpected structure,
                            // c=null && p=null so the if(c||p) block never executes, leaving
                            // P undefined. This causes validateClimateMetrics(P) to fail and
                            // window.climateMetrics=null, breaking disease models.
                            // Default P provides basic temperature structure from location-based
                            // estimates, ensuring disease models always get valid temperature data.
                            var _lat = Math.abs(t.climate?.lat || t.climate?.latitude || -33);
                            var _fallbackTemp = _lat < 25 ? 22 : _lat < 35 ? 20 : 18; // Warmer closer to equator
                            var P = {
                                temperature: {
                                    mean: _fallbackTemp,
                                    max: _fallbackTemp + 5,
                                    min: _fallbackTemp - 5,
                                    todayMean: _fallbackTemp
                                },
                                moisture: { humidity: {}, dailyPattern: null },
                                stress: {},
                                growth: { c3: null, c4: null, weighted: null },
                                _source: 'fallback_weather_fetch_failed'
                            };
                            
                            if (c || p) {
                                console.log('[b35fix374] Weather data available - processing temperature arrays');
                            } else {
                                console.warn('[b35fix374] Weather fetch failed or incomplete - using fallback climate metrics (temp=' + _fallbackTemp + '°C, lat=' + _lat + ')');
                            }
                            
                            if (c || p)
                                try {
                                    var g = [],
                                        u = [];
                                    (p && ((g = g.concat(a.historical.hourly.temperature_2m)), (u = u.concat(a.historical.hourly.time))),
                                        c && ((g = g.concat(a.forecast.hourly.temperature_2m)), (u = u.concat(a.forecast.hourly.time))));
                                    for (var m = {}, f = 0; f < g.length; f++) {
                                        var y = u[f] ? u[f].substring(0, 10) : "";
                                        m[y] ||
                                            (m[y] = {
                                                temps: [],
                                                min: 100,
                                                max: -100,
                                            });
                                        var h = g[f];
                                        null != h && (m[y].temps.push(h), h < m[y].min && (m[y].min = h), h > m[y].max && (m[y].max = h));
                                    }
                                    for (var v = Object.keys(m).sort(), b = [], x = [], w = [], S = 0; S < v.length; S++) {
                                        var C = m[v[S]];
                                        if (C.temps.length > 0) {
                                            for (var M = 0, I = 0; I < C.temps.length; I++) M += C.temps[I];
                                            (b.push(M / C.temps.length), x.push(C.min), w.push(C.max));
                                        }
                                    }
                                    for (var k = 0, A = 0; A < b.length; A++) k += b[A];
                                    var E = b.length > 0 ? k / b.length : 20,
                                        N = w.length > 0 ? Math.max.apply(null, w) : 25,
                                        T = x.length > 0 ? Math.min.apply(null, x) : 10;
                                    // ===========================================================
                                    // b35fix356 Edit 1 — humidity extraction from raw weather hourly RH.
                                    // ===========================================================
                                    // Pre-fix this P-builder only populated P.temperature, P.stress,
                                    // P.growth from a.forecast.hourly.temperature_2m. Humidity arrays
                                    // present at a.forecast.hourly.relative_humidity_2m (and
                                    // a.historical.hourly.relative_humidity_2m) were ignored entirely
                                    // — zero references in this file pre-fix. Then validateClimateMetrics
                                    // at line ~770 only writes r.moisture.humidity if e.moisture is
                                    // truthy. P had no .moisture key, so the validated output emitted
                                    // r.moisture = {} (empty), which then overwrote whatever the v2
                                    // climate engine's legacy shim had previously written to
                                    // window.climateMetrics. Net effect (production log
                                    // gilbasolutions_com-1777253122159, 10/10 forecast invocations):
                                    // moisture.humidity.mean=undefined | humidity.mean=undefined |
                                    // hourly.humidity[len]=n/a | hourlyData.relative_humidity_2m[len]=
                                    // sometimes 192 — every humidity field on state.climateMetrics
                                    // came back undefined while the orchestrator's primary call (which
                                    // routes through getAuthoritativeClimate's adapter) saw real
                                    // hourly RH on the same run. The two writers to window.climateMetrics
                                    // (the v2 shim and this P builder) were producing strictly different
                                    // shapes, with the P builder's overwrite stripping humidity to nothing.
                                    //
                                    // Post-fix the P builder mirrors the temperature aggregation pattern
                                    // for relative humidity:
                                    //   - rhVals: concat historical + forecast hourly RH arrays
                                    //   - rhTimes: matching time array (used for per-day grouping)
                                    //   - rhCurrent: index by current hour (open-meteo arrays start at
                                    //     hour 0 of start_date local time, so getHours() is the index)
                                    //   - rhDailyPattern: per-day mean from the same time-bucket map
                                    //     used for temperature, so disease-forecast.buildDailyClimate's
                                    //     moistureDaily[i].humidity 'per-day' rung resolves on every
                                    //     forecast day, not just the period mean fallback
                                    // Strict numeric guard (typeof === 'number' && !isNaN) on every
                                    // entry so synthetic null arrays don't fabricate; same guard pattern
                                    // as get5DayMeanRH (b35fix335).
                                    var _rhForecast = c && a.forecast.hourly.relative_humidity_2m,
                                        _rhHistorical = p && a.historical.hourly.relative_humidity_2m,
                                        _rhVals = [],
                                        _rhTimes = [];
                                    (_rhHistorical && Array.isArray(_rhHistorical) &&
                                        ((_rhVals = _rhVals.concat(_rhHistorical)), (_rhTimes = _rhTimes.concat(a.historical.hourly.time))),
                                        _rhForecast && Array.isArray(_rhForecast) &&
                                        ((_rhVals = _rhVals.concat(_rhForecast)), (_rhTimes = _rhTimes.concat(a.forecast.hourly.time))));
                                    var _rhSum = 0,
                                        _rhCount = 0,
                                        _rhMin = 100,
                                        _rhMax = 0,
                                        _rhMean = null,
                                        _rhCurrent = null,
                                        _rhMinOut = null,
                                        _rhMaxOut = null,
                                        _rhDailyPattern = null,
                                        _rhDailyMap = {};
                                    for (var _ri = 0; _ri < _rhVals.length; _ri++) {
                                        var _rv = _rhVals[_ri];
                                        if (typeof _rv === 'number' && !isNaN(_rv)) {
                                            _rhSum += _rv;
                                            _rhCount++;
                                            if (_rv < _rhMin) _rhMin = _rv;
                                            if (_rv > _rhMax) _rhMax = _rv;
                                            var _rd = _rhTimes[_ri] ? _rhTimes[_ri].substring(0, 10) : "";
                                            _rhDailyMap[_rd] || (_rhDailyMap[_rd] = { vals: [], min: 100, max: 0 });
                                            _rhDailyMap[_rd].vals.push(_rv);
                                            if (_rv < _rhDailyMap[_rd].min) _rhDailyMap[_rd].min = _rv;
                                            if (_rv > _rhDailyMap[_rd].max) _rhDailyMap[_rd].max = _rv;
                                        }
                                    }
                                    if (_rhCount > 0) {
                                        _rhMean = Math.round(10 * (_rhSum / _rhCount)) / 10;
                                        _rhMinOut = Math.round(10 * _rhMin) / 10;
                                        _rhMaxOut = Math.round(10 * _rhMax) / 10;
                                        // Current hour: index forecast array by getHours() (open-meteo
                                        // forecast hourly starts at hour 0 of start_date local time).
                                        // Falls back to the most recent numeric entry in the combined
                                        // array if the current-hour index is missing or non-numeric.
                                        if (_rhForecast && Array.isArray(_rhForecast)) {
                                            var _rhHour = new Date().getHours();
                                            if (_rhHour < _rhForecast.length &&
                                                typeof _rhForecast[_rhHour] === 'number' && !isNaN(_rhForecast[_rhHour])) {
                                                _rhCurrent = Math.round(10 * _rhForecast[_rhHour]) / 10;
                                            }
                                        }
                                        if (_rhCurrent == null) {
                                            for (var _rj = _rhVals.length - 1; _rj >= 0; _rj--) {
                                                var _rvL = _rhVals[_rj];
                                                if (typeof _rvL === 'number' && !isNaN(_rvL)) {
                                                    _rhCurrent = Math.round(10 * _rvL) / 10;
                                                    break;
                                                }
                                            }
                                        }
                                        // Per-day pattern in date order — mirrors disease-forecast.js
                                        // buildDailyClimate's moistureDaily[i].humidity 'per-day' rung.
                                        var _rhDates = Object.keys(_rhDailyMap).sort();
                                        if (_rhDates.length > 0) {
                                            _rhDailyPattern = [];
                                            for (var _rk = 0; _rk < _rhDates.length; _rk++) {
                                                var _rdEntry = _rhDailyMap[_rhDates[_rk]];
                                                if (_rdEntry.vals.length > 0) {
                                                    var _rdSum = 0;
                                                    for (var _rl = 0; _rl < _rdEntry.vals.length; _rl++) _rdSum += _rdEntry.vals[_rl];
                                                    _rhDailyPattern.push({
                                                        date: _rhDates[_rk],
                                                        humidity: Math.round(10 * (_rdSum / _rdEntry.vals.length)) / 10,
                                                        min: Math.round(10 * _rdEntry.min) / 10,
                                                        max: Math.round(10 * _rdEntry.max) / 10,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                    var P = {
                                            temperature: {
                                                mean: Math.round(10 * E) / 10,
                                                max: Math.round(10 * N) / 10,
                                                min: Math.round(10 * T) / 10,
                                                // todayMean: current-hour temp from forecast array.
                                                // open-meteo arrays start at hour 0 of start_date (local time),
                                                // so getHours() is the direct index. Used by getAverageTemperature()
                                                // for GP calculation instead of the multi-day mean.
                                                todayMean: (function() {
                                                    var _h = new Date().getHours();
                                                    if (c && _h < c.length && c[_h] != null) return Math.round(10 * c[_h]) / 10;
                                                    if (c && c.length > 0) return Math.round(10 * c[0]) / 10;
                                                    return Math.round(10 * E) / 10;
                                                })(),
                                            },
                                            // b35fix356: moisture key always present so validateClimateMetrics
                                            // executes its `e.moisture && ...` branch and propagates
                                            // r.moisture.humidity. When _rhCount === 0 (no numeric RH
                                            // entries in either forecast or historical hourly arrays),
                                            // moisture.humidity is the empty object — same shape
                                            // validateClimateMetrics emits today, but now reachable.
                                            moisture: {
                                                humidity: _rhCount > 0
                                                    ? { mean: _rhMean, current: _rhCurrent, min: _rhMinOut, max: _rhMaxOut }
                                                    : {},
                                                dailyPattern: _rhDailyPattern,
                                            },
                                            stress: {},
                                            growth: {},
                                        };
                                    if (b.length > 0) {
                                        for (var R = [], $ = 0; $ < b.length; $++) {
                                            var F = b[$],
                                                _ = x[$],
                                                D = w[$],
                                                G = 0;
                                            ((G =
                                                    F <= -5 ?
                                                    0 :
                                                    F < 0 ?
                                                    0.05 + 0.0083 * (F + 5) :
                                                    F < 10 ?
                                                    0.09166667 * F + 0.0916667 :
                                                    F < 15 ?
                                                    0.08333333 * F + 0.175 :
                                                    F < 25 ?
                                                    -0.025 * F * F + 1.125 * F - 11.625 :
                                                    F < 30 ?
                                                    -0.15 * F + 4.75 :
                                                    F < 40 ?
                                                    -0.075 * F + 2.5 :
                                                    0),
                                                (G = Math.max(0, Math.min(100, 100 * G))));
                                            var L = 0;
                                            ((L =
                                                    F <= 0 ?
                                                    0 :
                                                    F < 15 ?
                                                    0.04 * F :
                                                    F < 30 ?
                                                    0.04 * F + 0.012 * (F - 15) * (F - 15) :
                                                    F < 40 ?
                                                    -0.1 * F + 4 :
                                                    0),
                                                (L = Math.max(0, Math.min(100, 100 * L))),
                                                R.push({
                                                    date: v[$] || "",
                                                    temp: Math.round(10 * F) / 10,
                                                    tempMin: Math.round(10 * _) / 10,
                                                    tempMax: Math.round(10 * D) / 10,
                                                    c3: Math.round(G),
                                                    c4: Math.round(L),
                                                    weighted: Math.round((G + L) / 2),
                                                }));
                                        }
                                        P.growth.dailyPattern = R;
                                        for (var O = 0, z = 0, H = 0; H < R.length; H++)((O += R[H].c3), (z += R[H].c4));
                                        var q = Math.round(O / R.length),
                                            W = Math.round(z / R.length);
                                        if (
                                            ((P.growth.c3 = q),
                                                (P.growth.c4 = W),
                                                (P.growth.weighted = Math.round((q + W) / 2)),
                                                "function" == typeof window.gaip_climate_get_growth_data && a && t)
                                        )
                                            try {
                                                var U = window.gaip_climate_get_growth_data(a, t);
                                                if (U && "number" == typeof U.c3 && "number" == typeof U.c4) {
                                                    var B = Math.round(100 * U.c3),
                                                        j = Math.round(100 * U.c4),
                                                        V = Math.round(100 * U.weighted);
                                                    (console.log(
                                                            "✅ Using climate engine growth values: C3=" + B + "%, C4=" + j + "% (weighted=" + V + "%)",
                                                        ),
                                                        (P.growth.c3 = B),
                                                        (P.growth.c4 = j),
                                                        (P.growth.weighted = V));
                                                }
                                            } catch (e) {
                                                console.warn("Could not get climate engine growth values:", e);
                                            }
                                    }
                                    if (P.temperature.max >= 30) {
                                        for (var K = 0, Y = 0; Y < w.length; Y++) w[Y] >= 30 && K++;
                                        P.stress.heat = {
                                            days: K,
                                            maxTemp: P.temperature.max,
                                            threshold: 30,
                                            recommendation: K > 3 ?
                                                "Urgent: Increase irrigation frequency, apply wetting agents, raise mowing height" :
                                                "Monitor closely: Consider light syringing during peak heat",
                                        };
                                    }
                                    if (P.temperature.min <= 10) {
                                        for (var Z = 0, J = 0, Q = 0; Q < x.length; Q++)(x[Q] <= 10 && Z++, x[Q] <= 2 && J++);
                                        P.stress.cold = {
                                            days: Z,
                                            frostDays: J,
                                            minTemp: P.temperature.min,
                                            threshold: 10,
                                            recommendation: J > 0 ?
                                                "Avoid traffic on frosted turf, delay irrigation until frost melts" :
                                                "Reduce nitrogen applications, monitor for dormancy",
                                        };
                                    }
                                    (console.log("Climate metrics created:", P),
                                        // PATCH: Run V2 GP override BEFORE publishing to window.climateMetrics.
                                        // Previously, the dashboard read weighted=0% from the initial assignment,
                                        // then only saw the correct 99% on the second render cycle.
                                        // Now we fix P.growth in-place before it becomes window.climateMetrics.
                                        (function _applyV2GPOverride() {
                                            if (void 0 === window.GAIP_ClimateV2 || !window.GAIP_ClimateV2.analyze) return;
                                            try {
                                                var ee = window.GAIP_ClimateV2.analyze(t, a);
                                                if (!ee || ee.error) return;
                                                window.GAIP_CLIMATE_V2_RESULT = ee;
                                                var te = ee.drought;
                                                var gp = ee.growthPotential;
                                                var gpWeighted =
                                                    gp && "number" == typeof gp.adjustedGrowthPotential ?
                                                    gp.adjustedGrowthPotential :
                                                    te ?
                                                    te.growthPotential :
                                                    null;
                                                if (gpWeighted === null) return;
                                                var re = P.growth.weighted;
                                                var gpC3 = te ? te.gpC3 : gp && !gp.isC4 ? gp.baseGrowthPotential : null;
                                                var gpC4 = te ? te.gpC4 : gp && gp.isC4 ? gp.baseGrowthPotential : null;
                                                var _c4frac = t.turf?.speciesFractions?.c4Fraction ?? 1;
                                                var _c3frac = t.turf?.speciesFractions?.c3Fraction ?? 1;
                                                if (_c4frac === 0) {
                                                    gpC4 = null;
                                                    console.log(
                                                        "[C4 FIX] Pure C3 grass detected — gpC4 set to null (hidden). species=" +
                                                        // b35fix218b: t.turf.grassSpecies empty in V2 IIFE on GSSH; fall back to GAIP_STATE
                                                        (t.turf?.grassSpecies || window.GAIP_STATE?.turf?.grassSpecies || "unknown") +
                                                        " c4Fraction=" +
                                                        _c4frac,
                                                    );
                                                }
                                                if (_c3frac === 0) {
                                                    gpC3 = null;
                                                    console.log(
                                                        "[C3 FIX] Pure C4 grass detected — gpC3 set to null (hidden). species=" +
                                                        (t.turf?.grassSpecies || "?") +
                                                        " c3Fraction=" +
                                                        _c3frac,
                                                    );
                                                }
                                                P.growth.weighted = gpWeighted;
                                                P.growth.c3 = gpC3;
                                                P.growth.c4 = gpC4;
                                                console.log(
                                                    "✅ Climate V2 GP override (pre-publish): " +
                                                    re +
                                                    "% -> " +
                                                    gpWeighted +
                                                    "% (C3=" +
                                                    gpC3 +
                                                    "%, C4=" +
                                                    gpC4 +
                                                    "%)",
                                                );
                                            } catch (e) {
                                                console.warn("Climate V2 pre-publish GP override failed:", e);
                                            }
                                        })(),
                                        (window.climateMetrics = validateClimateMetrics(P)),
                                        (window.lastClimateMetrics = window.climateMetrics));
                                    var X = t.turf?.grassSpecies || "";
                                    ((window.climateStatusSummary = generateClimateStatusSummary(window.climateMetrics, X, t)),
                                        console.log(
                                            "   Status: " + window.climateStatusSummary.icon + " " + window.climateStatusSummary.text,
                                        ));
                                } catch (e) {
                                    console.warn("Climate metrics calculation failed:", e);
                                }

                            // =============================================================================
                            // ENGINE EXECUTION - SINGLE SOURCE OF TRUTH (SSOT)
                            // =============================================================================
                            // All engine execution routes through GilbaCascadeOrchestrator.
                            // The cascade handles dependency ordering, error handling, and state management.
                            // Legacy engine calls have been removed - this is the only code path.
                            // =============================================================================

                            var ne,
                                ie,
                                ae,
                                oe,
                                se,
                                le,
                                de = null,
                                me,
                                fe = null;

                            // Verify cascade orchestrator is available
                            if (typeof GilbaCascadeOrchestrator === "undefined") {
                                console.error("❌ CRITICAL: GilbaCascadeOrchestrator not loaded.");
                                console.error("   Ensure hub-cascade-adapter.js is loaded BEFORE hub-tissue-v3.js");
                                throw new Error("GilbaCascadeOrchestrator is required for SSOT operation");
                            }

                            try {
                                // Build cascade state from DOM state (t) and weather (a)
                                var cascadeState = gaip_transformToCascadeFormat(t, a);
                                console.log("📦 Cascade state prepared:", Object.keys(cascadeState.inputs));

                                // Execute cascade with all required engines
                                var cascadeResult = GilbaCascadeOrchestrator.runCascade(
                                    cascadeState, {}, {
                                        fullRecompute: true,
                                        hubRoot: e, // Pass DOM root for tissue data reading
                                        includeEngines: [
                                            "mlsn-engine",
                                            "water-engine",
                                            "climate-engine",
                                            "firmness-engine",
                                            "nopt-engine",
                                            "traffic-engine",
                                            "shade-engine",
                                            "salinity-penalty-engine",
                                            "soil-structure-engine",
                                            "phytotoxicity-engine",
                                            "wear-recovery-engine",
                                            "turf-manager-engine",
                                            "tissue-engine",
                                        ],
                                    },
                                );

                                if (cascadeResult.success) {
                                    console.log("✅ Cascade completed in " + cascadeResult.duration + "ms");
                                    console.log("   Engines: " + cascadeResult.executionOrder.join(", "));

                                    // Extract results to legacy variable format for render compatibility
                                    var extracted = gaip_extractCascadeResults(cascadeResult, t, a);

                                    // Map to legacy variables (required by gaip_render_results)
                                    l = extracted.l; // MLSN results
                                    d = extracted.d; // Water quality results
                                    ne = extracted.ne; // Firmness results
                                    ae = extracted.ae; // Nitrogen status
                                    oe = extracted.oe; // Traffic results
                                    se = extracted.se; // Shade results
                                    le = extracted.le; // Wear/recovery results
                                    me = extracted.me; // Turf manager results
                                    de = extracted.de; // Tissue results
                                    fe = extracted.fe; // Salinity penalty

                                    // Update window.climateMetrics if cascade provided it
                                    if (extracted.climateMetrics) {
                                        window.climateMetrics = extracted.climateMetrics;
                                    }

                                    // Expose phytotoxicity results globally for console access and exports
                                    if (extracted.pe) {
                                        window.GAIP_PHYTOTOXICITY_RESULT = extracted.pe;
                                    }
                                } else {
                                    // Cascade failed - this is a hard error in SSOT mode
                                    console.error("❌ Cascade failed:", cascadeResult.error);
                                    throw new Error(cascadeResult.error || "Cascade execution failed");
                                }
                            } catch (cascadeErr) {
                                console.error("❌ Cascade error:", cascadeErr);
                                alert("Analysis failed: " + cascadeErr.message);
                                throw cascadeErr;
                            }

                            // =============================================================================
                            // END ENGINE EXECUTION
                            // =============================================================================

                            gaip_render_results(t, a, l, d, oe, ne, ae, me, se, le);
                            var xe = document.querySelector(".gaip-results");
                            // b35fix391: prevent stale-snapshot clobber of routed turf writes.
                            // The local `t.turf` is built at run-start from a snapshot of GAIP_STATE.
                            // If a routed write to inputs.turf happened DURING the run (e.g. cotula
                            // bowls activation via cotula-bowling-green.js:571 routed write per b35fix388),
                            // `t.turf` here is stale. Writing it back through the proxy setter's
                            // e.turf branch (gilba-hub-v2.js:1415) replaces inputs.turf wholesale —
                            // reverts the routed write. Symptom: live-UI chips/SiteSelector/Prebble
                            // preview read TPC.state and show 'bowls' correctly, but Word export's
                            // collectData (word-export.js:5957–5959) reads window.GAIP_STATE.turf
                            // and gets the post-run-clobbered 'sports' value.
                            //
                            // Fix: merge fresh inputs.turf (post any in-run routed writes) over the
                            // stale snapshot. The setter still runs c.set("inputs.turf", merged, ...)
                            // so any field the run engines computed and assigned to t.turf
                            // (effectiveSpecies, ambientDLI, etc.) still propagates, but cotula keys
                            // and any other fresh routed-write keys are preserved.
                            //
                            // Verified by DevTools probe (b35fix391 diagnostic): with mock t.turf =
                            // {turfType:'sports'} writing back over inputs.turf = {turfType:'bowls',
                            // cotula:true, speciesKey:'cotula', ...} the unfixed setter produces
                            // {turfType:'sports', cotula:undefined}. With this merge, fresh inputs.turf
                            // wins on the cotula keys and t.turf wins on engine-computed extras.
                            var _b35fix391_freshTurf = (window.GAIP_STATE && window.GAIP_STATE.inputs && window.GAIP_STATE.inputs.turf) || null;
                            var _b35fix391_mergedTurf = _b35fix391_freshTurf
                                ? Object.assign({}, t.turf || {}, _b35fix391_freshTurf)
                                : t.turf;
                            (xe ? (xe.style.display = "block") : console.warn("GAIP: .gaip-results container not found"),
                                console.log("GAIP: Preparing state dispatch..."),
                                (window.GAIP_STATE = {
                                    soil: t.soil,
                                    tissue: t.tissue,
                                    water: t.water,
                                    turf: _b35fix391_mergedTurf,
                                    traffic: t.traffic,
                                    climate: t.climate,
                                    variety: t.variety,
                                    siteHistory: t.siteHistory,
                                    climateMetrics: window.climateMetrics || null,
                                    shadeMetrics: se || null,
                                    wearMetrics: le || null,
                                    region: (function() {
                                        var lat = t.climate?.lat || t.climate?.latitude;
                                        var lon = t.climate?.lon || t.climate?.longitude;
                                        if (lat === undefined || lon === undefined) return "AU";
                                        if (lat < 0 && lon > 110 && lon < 180) return lon > 165 ? "NZ" : "AU";
                                        if (lat > 24 && lat < 46 && lon > 123 && lon < 146) return "JP";
                                        if (lat > 35 && lat < 72 && lon > -12 && lon < 45) {
                                            if (lon < 2 && lat > 50 && lat < 61) return lon < -5.5 ? "IE" : "GB";
                                            if (lat > 55 && lon > 11 && lon < 24) return "SE";
                                            if (lat > 58 && lon > 4 && lon < 11) return "NO";
                                            if (lat > 54.5 && lat < 58 && lon > 8 && lon < 15) return "DK";
                                            if (lat > 60 && lon > 20 && lon < 32) return "FI";
                                            if (lat > 47 && lat < 55 && lon > 6 && lon < 15) return "DE";
                                            if (lat > 42 && lat < 51 && lon > -5 && lon < 8) return "FR";
                                            if (lat > 36 && lat < 44 && lon > -9 && lon < 4) return "ES";
                                            if (lat > 36 && lat < 47 && lon > 6 && lon < 19) return "IT";
                                            if (lat > 50 && lat < 54 && lon > 3 && lon < 7) return "NL";
                                            if (lat > 46 && lat < 48.5 && lon > 6 && lon < 17) return lon < 10 ? "CH" : "AT";
                                            return "EU";
                                        }
                                        if (lat > 24 && lat < 72 && lon > -170 && lon < -50) return lat > 49 ? "CA" : "US";
                                        if (lat < -22 && lat > -35 && lon > 16 && lon < 33) return "ZA";
                                        return "AU";
                                    })(),
                                    salinityPenalty: fe ?
                                        {
                                            active: fe.growthPenaltyPct > 0,
                                            growthModifier: fe.relativeYieldPct / 100,
                                            penaltyPct: fe.growthPenaltyPct,
                                            ecw: fe.ecwInput,
                                            status: fe.status,
                                            species: fe.species,
                                        } :
                                        null,
                                    nitrogenStatus: ae || null,
                                    varietyTraits: window.selectedVarietyTraits || null,
                                    mlsnResults: l,
                                    tissueResults: oe,
                                    waterResults: d,
                                    fertiliserIndex: ne,
                                    sprayContext: null, // b35fix237b: always null here — cascade re-injects via gaip:spray-context-loaded
                                }),
                                document.dispatchEvent(
                                    new CustomEvent("gaip:hub-state-update", {
                                        detail: {
                                            state: window.GAIP_STATE,
                                        },
                                    }),
                                ),
                                // b35fix237c: re-inject cached spray context synchronously
                                // after GAIP_STATE replacement so it's available before any
                                // event handlers read it. No async, no timing dependency.
                                (function() {
                                    var _sc = window.GAIP_SprayCascade && typeof window.GAIP_SprayCascade.getCachedContext === 'function'
                                        ? window.GAIP_SprayCascade.getCachedContext() : null;
                                    if (_sc && window.GAIP_STATE) window.GAIP_STATE.sprayContext = _sc;
                                })(),
                                console.log("✅ Hub state dispatched for integrated modules"),
                                document.dispatchEvent(
                                    new CustomEvent("gaip:analysis-complete", {
                                        detail: {
                                            state: window.GAIP_STATE,
                                        },
                                    }),
                                ),
                                (window._gilbaAnalysisRunCount = (window._gilbaAnalysisRunCount || 0) + 1),
                                (_analysisRunning = false), // PATCH: release re-entry lock
                                console.log("✅ Analysis complete event dispatched (run #" + window._gilbaAnalysisRunCount + ")"),
                                window.GaipTurfProfile &&
                                "function" == typeof window.GaipTurfProfile.markAnalysisRun &&
                                window.GaipTurfProfile.markAnalysisRun());
                        } catch (e) {
                            _analysisRunning = false; // PATCH: release re-entry lock on error
                            document.dispatchEvent(new CustomEvent("gaip:analysis-complete", {
                                detail: {
                                    error: true
                                }
                            }));
                            (console.error("❌ CRITICAL ERROR:", e), alert("Analysis failed: " + e.message));
                        }
                    } else {
                        _analysisRunning = false;
                        console.error("GAIP: #gaip-hub root not found");
                    }
                })) :
            console.warn("GAIP: Run button not found in DOM");

        // Expose a force-run function that bypasses the cooldown.
        // Used by gssh:venue-profile-restored — a deliberate re-run after venue
        // species restore, not spam. The cooldown exists to prevent page-load
        // cascade spam, not to block intentional external triggers.
        window.GAIP_ForceRun = function() {
            if (_analysisRunning) {
                console.log("[GAIP] ForceRun: analysis in progress, queuing for after completion");
                var onDone = function() {
                    document.removeEventListener("gaip:analysis-complete", onDone);
                    _lastRunAt = 0; // reset cooldown
                    // Use setTimeout(0) so _analysisRunning = false has executed before we click.
                    // gaip:analysis-complete fires just before _analysisRunning is cleared in the
                    // async handler, so a synchronous click here still hits the re-entry guard.
                    setTimeout(function() {
                        var btn = document.querySelector(".gaip-run-btn");
                        if (btn) btn.click();
                    }, 0);
                };
                document.addEventListener("gaip:analysis-complete", onDone);
                return;
            }
            _lastRunAt = 0; // reset cooldown so the click handler proceeds
            var btn = document.querySelector(".gaip-run-btn");
            if (btn) {
                console.log("[GAIP] ForceRun: bypassing cooldown");
                btn.click();
            }
        };
    }),
    document.addEventListener("DOMContentLoaded", function() {
        (document.querySelectorAll(".gaip-card-header").forEach(function(e) {
                e.addEventListener("click", function(e) {
                    "checkbox" === e.target.type ||
                        e.target.closest(".gaip-module-toggle") ||
                        e.target.closest(".gaip-header-controls") ||
                        this.closest(".gaip-card").classList.toggle("collapsed");
                });
            }),
            document.querySelectorAll(".gaip-module-toggle").forEach(function(e) {
                e.addEventListener("click", function(e) {
                    e.stopPropagation();
                });
            }));
        var e = document.querySelector(".gaip-use-live-weather"),
            t = document.querySelector(".gaip-manual-weather");
        if (
            (console.log("🔍 Manual weather toggle check:"),
                console.log("  - Checkbox found:", !!e),
                console.log("  - Manual div found:", !!t),
                e && t)
        ) {
            var r = e.checked;
            ((t.style.display = r ? "none" : "block"),
                console.log("  - Live weather checked:", r),
                console.log("  - Manual div display:", t.style.display),
                e.addEventListener("change", function() {
                    var e = !this.checked;
                    ((t.style.display = e ? "block" : "none"), console.log("✓ Weather toggle changed - show manual:", e));
                }),
                e.addEventListener("click", function(e) {
                    e.stopPropagation();
                }),
                console.log("✓ Manual weather toggle initialized"));
        } else console.warn("⚠ Manual weather toggle elements not found!");
        var n = document.querySelector(".gaip-species"),
            i = document.querySelector(".gaip-variety");
        if (n && i) {
            var a = {
                Couch: "Couch / Bermuda",
                Kikuyu: "Kikuyu",
                Zoysia: null,
                Buffalograss: null,
                "Perennial Ryegrass": "Perennial Ryegrass",
                "Tall Fescue": "Tall Fescue",
                "Kentucky Bluegrass": null,
                "Annual Bluegrass (Fairway)": null,
                "Fine Fescue": null,
                "Creeping Bentgrass": "Bentgrass",
                "Creeping Bentgrass (Greens)": "Bentgrass",
                "Annual Bluegrass (Greens)": null,
                "Velvet Bentgrass (Greens)": null,
            };

            function u() {
                var e = n.value,
                    t = a[e],
                    r = i.querySelectorAll("optgroup"),
                    o = !1;
                if (
                    (r.forEach(function(e) {
                            var t = e.getAttribute("label") || "";
                            ("Individual Cultivars" !== t && "Professional Blends" !== t) || (o = !0);
                        }),
                        o || (0 === r.length && i.options.length > 2))
                )
                    console.log("✓ Variety dropdown managed by TurfProfileController for species:", e);
                else {
                    var s = !1;
                    r.forEach(function(e) {
                        var r = e.getAttribute("label");
                        t && r === t ? ((e.style.display = ""), (s = !0)) : (e.style.display = "none");
                    });
                    var l = i.options[i.selectedIndex];
                    l &&
                        l.parentElement &&
                        l.parentElement.style &&
                        "none" === l.parentElement.style.display &&
                        (i.value = "generic");
                    var d = i.querySelector('option[value="generic"]');
                    (d && (d.textContent = s ? "Generic / Unknown" : "Generic (no specific varieties for " + e + ")"),
                        console.log("✓ Variety dropdown filtered for species:", e));
                }
            }
            (u(),
                n.addEventListener("change", u),
                n.addEventListener("change", o),
                n.addEventListener("change", s),
                o(),
                s(),
                console.log("✓ Variety dropdown filtering initialized"));
        }

        function o() {
            var e = document.querySelector(".gaip-species"),
                t = document.querySelector(".gaip-overseed-section");
            if (e && t) {
                var r = e.value || "";
                if (
                    ["Couch", "Kikuyu", "Zoysia", "Buffalograss", "Bermuda", "St Augustine"].some(function(e) {
                        return -1 !== r.toLowerCase().indexOf(e.toLowerCase());
                    })
                )
                    t.style.display = "block";
                else {
                    t.style.display = "none";
                    var n = document.querySelector(".gaip-cool-overseed");
                    n && (n.value = "");
                }
            }
        }

        function s() {
            var e = document.querySelector(".gaip-species"),
                t = document.querySelector(".gaip-poa-section");
            if (e && t) {
                var r = e.value || "",
                    n = -1 !== r.toLowerCase().indexOf("poa") || -1 !== r.toLowerCase().indexOf("annual bluegrass");
                if (r && !n) t.style.display = "block";
                else {
                    t.style.display = "none";
                    var i = document.querySelector(".gaip-poa-percent");
                    i && (i.value = "0");
                }
            }
        }
        initTurfTypeMode();
        var l = document.querySelector(".gaip-turf-type");
        (l && l.addEventListener("change", initTurfTypeMode),
            initSurfaceTypeMode(),
            document.querySelectorAll(".gaip-subcategory-option").forEach(function(e) {
                e.addEventListener("click", function() {
                    setTimeout(initSurfaceTypeMode, 50);
                });
            }),
            document.addEventListener("gaip:turf-profile-change", function() {
                initSurfaceTypeMode();
            }));
        var d = document.querySelector(".gaip-soil-methodology"),
            c = document.querySelector(".gaip-soil-method-label"),
            p = document.querySelector(".gaip-soil-method-note"),
            g = document.querySelector(".gaip-soil-result-title");
        d &&
            d.addEventListener("change", function() {
                var e = this.value;
                (c &&
                    (c.textContent =
                        "slan" === e ?
                        "SLAN soil test (ppm)" :
                        "ammonium_acetate" === e ?
                        "Ammonium Acetate soil test (ppm)" :
                        "MLSN soil test (ppm)"),
                    p &&
                    (p.textContent =
                        "slan" === e ?
                        "Mehlich 3 extractant (Olsen for P). Thresholds vary by soil type." :
                        "ammonium_acetate" === e ?
                        "Olsen P + NH₄OAc extraction — calibrated for NZ soils" :
                        "Mehlich 3 extractant (Olsen for P)"),
                    g &&
                    (g.textContent =
                        "slan" === e ?
                        "Soil nutrient sufficiency (SLAN)" :
                        "ammonium_acetate" === e ?
                        "Soil nutrient sufficiency (Ammonium Acetate)" :
                        "Soil nutrient sufficiency (MLSN)"));
            });
    }));

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE DATE PICKERS — default to today
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", function() {
    var today = new Date().toISOString().split("T")[0];
    [".gaip-soil-date", ".gaip-water-date", ".gaip-tissue-date"].forEach(function(sel) {
        var el = document.querySelector(sel);
        if (el && !el.value) {
            el.value = today;
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-RUN ON LOGIN / PAGE LOAD
// ═══════════════════════════════════════════════════════════════════════════════
// When persistence restores saved state, automatically trigger the Run button
// so the dashboard, disease module, and orchestrator all update without the
// user needing to click Run manually.
// Fires after gaip:state-restored (dispatched by hub-persistence after restore).
// Falls back to a timed trigger if no saved state exists (first-time users).
// ═══════════════════════════════════════════════════════════════════════════════
(function() {
    var _autoRunFired = false;
    var _siteConfigApplied = false;
    var _stateRestored = false;

    function triggerAutoRun() {
        if (_autoRunFired) return;
        // Both conditions must be met: persistence restored AND site-config applied.
        // This ensures gaip_build_state() reads the correct species/turfType from
        // the DOM (not the TurfProfile default) on cold-start and incognito loads.
        if (!_stateRestored || !_siteConfigApplied) return;
        // Defer to AutoRefresh if it already handled the run (returning users).
        // AutoRefresh is the primary auto-run mechanism; this gate is backup for
        // first-time/incognito users where AutoRefresh's wizard check may skip.
        if (window.GilbaAutoRefresh && window.GilbaAutoRefresh.hasFired()) return;
        _autoRunFired = true;
        var btn = document.querySelector(".gaip-run-btn");
        if (btn) {
            console.log("[GAIP] Auto-running analysis on page load...");
            btn.click();
        } else {
            console.warn("[GAIP] Auto-run: run button not found");
        }
    }

    // Primary trigger: persistence has restored all inputs.
    document.addEventListener("gaip:state-restored", function() {
        setTimeout(function() {
            _stateRestored = true;
            triggerAutoRun();
        }, 400);
    });

    // Trigger 2: site-config has applied saved turf type / species to DOM.
    // If state-restored hasn't fired yet, wait up to 1200ms for it before
    // proceeding — handles the case where SiteConfig boots faster than persistence.
    document.addEventListener("gaip:site-config-applied", function() {
        _siteConfigApplied = true;
        if (_stateRestored) {
            triggerAutoRun();
        } else {
            // Persistence hasn't confirmed yet — poll briefly then unblock.
            var waited = 0;
            var poll = setInterval(function() {
                waited += 100;
                if (_stateRestored || waited >= 1200) {
                    clearInterval(poll);
                    _stateRestored = true; // unblock if persistence never fires
                    triggerAutoRun();
                }
            }, 100);
        }
    });

    // Safety fallback: if gaip:site-config-applied never fires (e.g. SampleManager
    // unavailable, first visit with no saved config), unblock after 4.5s.
    // site-config-persistence boots at DOMContentLoaded+500ms, inits after
    // SampleManager check, then fires at 3000ms+450ms = ~4s. Give 500ms headroom.
    document.addEventListener("DOMContentLoaded", function() {
        setTimeout(function() {
            if (!_autoRunFired) {
                console.warn("[GAIP] Auto-run safety fallback: site-config-applied not received — running now");
                _siteConfigApplied = true;
                _stateRestored = true;
                triggerAutoRun();
            }
        }, 4500);
    });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// Site-switch auto-rerun
// Waits for the current analysis to complete, then re-runs once for the new site.
// This avoids fighting the cooldown/lock — we simply queue behind it.
// ═══════════════════════════════════════════════════════════════════════════════
(function() {
    var _pendingSiteRun = false;
    var _fallbackTimer = null;

    document.addEventListener("gaip:site-changed", function() {
        _pendingSiteRun = true;
        console.log("[GAIP] Site switch queued — waiting for current analysis to finish");
        // Fallback: if analysis-complete never fires (e.g. no analysis was running),
        // run after 1s — BUT only if page-load config restore is already complete.
        // On page load, gaip:site-changed fires from SiteSelector sample restore at
        // ~200ms, while site-config-applied doesn't dispatch until ~2400ms (800ms
        // restoreDelay + 1600ms TurfProfile cascade). Firing btn.click() at 1000ms
        // hits a TIER 0 identity failure because species is not yet restored.
        // If GAIP_SITE_CONFIG_PENDING is true we defer to the site-config-applied
        // listener below rather than racing it.
        if (_fallbackTimer) clearTimeout(_fallbackTimer);
        _fallbackTimer = setTimeout(function() {
            if (!_pendingSiteRun) return;
            // Guard against page-load config restore still in flight.
            // Note: this IIFE has no 'global' param — use window directly
            if (window.GAIP_SITE_CONFIG_PENDING) {
                console.log("[GAIP] Site switch fallback deferred — config restore pending, delegating to site-config-applied");
                return; // site-config-applied listener will handle it
            }
            _pendingSiteRun = false;
            var btn = document.querySelector(".gaip-run-btn");
            if (btn) {
                console.log("[GAIP] Site switched — re-running analysis (fallback timer)");
                btn.click();
            }
        }, 1000);
    });

    // site-config-applied means config is restored and tissue auto-run will fire
    // via its own listener. Cancel the fallback regardless of source.
    // Also handles the page-load case where the 1000ms fallback deferred
    // because GAIP_SITE_CONFIG_PENDING was still true.
    document.addEventListener("gaip:site-config-applied", function(e) {
        if (_fallbackTimer) {
            clearTimeout(_fallbackTimer);
            _fallbackTimer = null;
        }
        if (_pendingSiteRun) {
            _pendingSiteRun = false;
            console.log("[GAIP] Site config applied — auto-run delegated to tissue listener");
        }
    });

    document.addEventListener("gaip:analysis-complete", function() {
        if (_fallbackTimer) {
            clearTimeout(_fallbackTimer);
            _fallbackTimer = null;
        }
        if (!_pendingSiteRun) return;
        _pendingSiteRun = false;
        var btn = document.querySelector(".gaip-run-btn");
        if (btn) {
            console.log("[GAIP] Site switched — re-running analysis");
            btn.click();
        }
    });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// GSSH venue profile restore — re-run analysis after venue species/turf is set.
// gaip:site-changed is not dispatched in the GSSH venue-switch flow, so the
// site-switch re-run above never fires. gssh:venue-profile-restored fires after
// the full turfType → species → variety cascade completes (~350ms post-select).
// Uses GAIP_ForceRun to bypass the 3s cooldown — this is a deliberate re-run,
// not spam.
// ═══════════════════════════════════════════════════════════════════════════════
(function() {
    document.addEventListener("gssh:venue-profile-restored", function() {
        console.log("[GAIP] Venue profile restored — re-running analysis with correct species");
        if (typeof window.GAIP_ForceRun === "function") {
            window.GAIP_ForceRun();
        } else {
            // GAIP_ForceRun not yet available (race on page load) — fall back
            var btn = document.querySelector(".gaip-run-btn");
            if (btn) btn.click();
        }
    });
})();

// ═══════════════════════════════════════════════════════════════════════════════
// Soil Ratio Warnings Banner
// Listens for gaip:tissue-corrective-complete and renders soilRatioWarnings
// into a banner above the tissue body if any ratio antagonisms are detected.
// ═══════════════════════════════════════════════════════════════════════════════
(function() {
    var BANNER_ID = "gaip-soil-ratio-warnings-banner";

    function severityColor(severity) {
        return severity === "HIGH" ? "#dc2626" : "#d97706";
    }

    function severityBg(severity) {
        return severity === "HIGH" ? "var(--gaip-critical-bg)" : "var(--gaip-warning-bg)";
    }

    function renderBanner(warnings) {
        var existing = document.getElementById(BANNER_ID);
        if (existing) existing.parentNode.removeChild(existing);

        if (!warnings || warnings.length === 0) return;

        var tissueBody = document.querySelector(".gaip-tissue-body");
        if (!tissueBody) return;

        var html = '<div id="' + BANNER_ID + '" style="margin-bottom:12px;">';
        for (var i = 0; i < warnings.length; i++) {
            var w = warnings[i];
            var col = severityColor(w.severity);
            var bg = severityBg(w.severity);
            html +=
                '<div style="' +
                "background:" +
                bg +
                ";" +
                "border-left:4px solid " +
                col +
                ";" +
                "border-radius:4px;" +
                "padding:10px 12px;" +
                "margin-bottom:6px;" +
                "font-size:12px;" +
                "line-height:1.5;" +
                '">' +
                '<strong style="color:' +
                col +
                ';">' +
                w.severity +
                " — Soil " +
                w.ratioLabel +
                " ratio: " +
                w.ratio +
                ":1" +
                "</strong><br>" +
                '<span style="color:var(--gaip-text);">' +
                w.mechanism +
                "</span><br>" +
                '<span style="color:var(--gaip-text);"><strong>Action:</strong> ' +
                w.correction +
                "</span>" +
                (w.reference ? '<br><span style="color:var(--gaip-text-secondary);font-size:10px;">' + w.reference + "</span>" : "") +
                "</div>";
        }
        html += "</div>";

        tissueBody.insertAdjacentHTML("beforebegin", html);
    }

    document.addEventListener("gaip:tissue-corrective-complete", function(e) {
        var result = e.detail || {};
        renderBanner(result.soilRatioWarnings || []);
    });

    // Clear banner on site switch
    document.addEventListener("gaip:site-changed", function() {
        var existing = document.getElementById(BANNER_ID);
        if (existing) existing.parentNode.removeChild(existing);
    });
})();

// ==========================================================================
// b35fix298: Re-render sensor pane when Hydrosight (or any live source)
// delivers data AFTER the initial hub-tissue render pass.
// Without this, the sensor section shows "No sensor data available" until
// page reload because fetchLiveData completes after hub-tissue renders.
// ==========================================================================
(function() {
    'use strict';

    function rerenderSensorPane() {
        var Dt = document.querySelector('.gaip-sensor-body');
        var Gt = document.getElementById('gaip-sensor-results-section');
        if (!Dt) return; // DOM element not present

        var _hasSensorData = window.GAIP_SensorBridge ?
            window.GAIP_SensorBridge.hasData() :
            window.GAIP_Sensor && window.GAIP_Sensor.hasData();

        if (!_hasSensorData) return; // still no data — nothing to render

        try {
            Gt && (Gt.style.display = 'block');

            var Lt = window.GAIP_SensorBridge && window.GAIP_SensorBridge.getZoneSummaries
                ? window.GAIP_SensorBridge.getZoneSummaries()
                : (window.GAIP_Sensor && window.GAIP_Sensor.getZoneSummaries ? window.GAIP_Sensor.getZoneSummaries() : null);
            var _readingCount = window.GAIP_SensorBridge && window.GAIP_SensorBridge.getReadingCount
                ? window.GAIP_SensorBridge.getReadingCount()
                : 0;

            var zt = '<div style="padding: 16px; background: linear-gradient(135deg, var(--gaip-good-bg) 0%, var(--gaip-good-bg) 100%); border-radius: 8px; border-left: 4px solid #10b981;">';

            if (Lt && Array.isArray(Lt) && Lt.length > 0) {
                zt += '<div style="font-weight: 600; color: #166534; margin-bottom: 12px;">📊 Zone Summary</div>';
                zt += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">';
                Lt.forEach(function(e) {
                    if (e.name && 'Unlabelled' !== e.name) {
                        var t = e.avg;
                        if (null != t) {
                            var r = t < 15 ? '#dc2626' : t < 20 ? '#f59e0b' : t > 35 ? '#3b82f6' : '#16a34a';
                            var n = t < 15 ? 'Dry' : t < 20 ? 'Low' : t > 35 ? 'Wet' : 'Optimal';
                            zt += '<div style="background: var(--gaip-surface); padding: 12px; border-radius: 6px; border: 1px solid var(--gaip-good-bg);">';
                            zt += '<div style="font-weight: 600; color: #065f46; font-size: 13px;">' + e.name + '</div>';
                            zt += '<div style="font-size: 24px; font-weight: 700; color: ' + r + ';">' + t.toFixed(1) + '%</div>';
                            zt += '<div style="font-size: 11px; color: var(--gaip-text-muted, var(--gaip-text-secondary));">VWC (' + n + ')</div>';
                            zt += '<div style="font-size: 11px; margin-top: 4px;">' + e.count + ' readings</div>';
                            if (e._isLive) {
                                zt += '<div style="font-size: 10px; color: #10b981; margin-top: 2px;">🛰️ Live</div>';
                            }
                            zt += '</div>';
                        }
                    }
                });
                zt += '</div>';
            } else if (_readingCount > 0) {
                zt += '<div style="font-weight: 600; color: #166534; margin-bottom: 8px;">📊 Sensor Overview</div>';
                zt += '<div style="font-size: 14px;"><strong>' + _readingCount + '</strong> readings</div>';
            }

            zt += '</div>';
            Dt.innerHTML = zt;

            window.GAIP_STATE = window.GAIP_STATE || {};
            window.GAIP_STATE.sensorData = {
                zones: Lt,
                readings: _readingCount
            };

            console.log('[SensorPane] Re-rendered after live data arrived —', 
                Lt ? Lt.length + ' zones' : 'overview only');

        } catch (err) {
            console.error('[SensorPane] Re-render error:', err);
        }
    }

    // Listen for the bridge's unified sensor update event
    document.addEventListener('gaip:sensor:updated', function() {
        rerenderSensorPane();
    });

    // Also listen for direct Hydrosight updates (in case bridge isn't loaded)
    document.addEventListener('gaip:hydrosight:updated', function() {
        if (!window.GAIP_SensorBridge) {
            rerenderSensorPane();
        }
        // If bridge IS loaded, gaip:sensor:updated will fire — avoid double render
    });
})();
