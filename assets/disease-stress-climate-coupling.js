/**
 * =============================================================================
 * GILBA DISEASE ↔ STRESS/CLIMATE COUPLING v1.0.0
 * =============================================================================
 *
 * Reduces false positives in disease predictions by factoring stress state
 * and climate context into risk calculations. Acts as a post-processing
 * modifier layer: the raw disease model scores are adjusted up or down
 * based on environmental conditions that either enable or suppress disease.
 *
 * PROBLEM SOLVED:
 * The disease engine calculates risk per-pathogen from climate inputs
 * (temp, humidity, precipitation). But it ignores:
 *   1. Plant stress state — stressed turf is more susceptible
 *   2. Climate context — extreme heat suppresses some cool-season pathogens
 *   3. Recovery capacity — low growth potential means slower recovery
 *   4. Compound interactions — drought + heat suppresses Pythium (needs water)
 *
 * Without coupling, the engine produces false positives: e.g., Dollar Spot
 * flagged at 60% during a drought when the pathogen can't thrive without
 * moisture; Brown Patch flagged when turf is heat-dormant and the pathogen
 * is also suppressed above 35°C.
 *
 * SCIENTIFIC BASIS:
 * - Couch (1995): Diseases of Turfgrasses — stress predisposition theory
 * - Vargas (2005): Management of Turfgrass Diseases — environmental drivers
 * - Turgeon (2012): Turfgrass Management — abiotic-biotic interaction
 * - Dernoeden (2012): Creeping Bentgrass Management — stress-disease complex
 * - Xu & Huang (2009): Heat stress physiology in C3 turf (Rutgers)
 *
 * ARCHITECTURE:
 * Called by hub-orchestrator AFTER DiseaseEngine.analyse() returns raw scores.
 * Modifies adjustedRisk on each disease result. Does not touch the raw model
 * scores (riskScore), so the original model logic is preserved for audit.
 *
 * @requires disease-engine.js (provides raw disease results)
 * @requires hub-orchestrator.js (provides stress aggregates + climate data)
 * @version 1.0.0
 * @date February 2026
 * @author Gilba Solutions
 * =============================================================================
 */

(function(global) {
    'use strict';

    var VERSION = '1.0.0';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    var CONFIG = {
        /**
         * Maximum suppression — we never reduce a disease score by more than
         * this fraction. A 60% raw score can drop to 60 × (1 - 0.45) = 33%.
         * This prevents over-suppression that hides genuine risk.
         */
        maxSuppression: 0.45,

        /**
         * Maximum amplification — stress can increase disease risk by at most
         * this fraction. A 40% raw score can rise to 40 × (1 + 0.40) = 56%.
         * Cap prevents runaway amplification from compound stressors.
         */
        maxAmplification: 0.40,

        /**
         * Minimum stress index (0-100) before any amplification kicks in.
         * Below this, stress is too low to meaningfully increase disease risk.
         */
        stressAmplificationThreshold: 25,

        /**
         * Minimum growth potential (%) before growth-limited suppression
         * kicks in. Below this, turf simply cannot sustain many pathogens.
         */
        growthSuppressionThreshold: 15,

        /**
         * Soil moisture level (%) below which moisture-dependent pathogens
         * are suppressed. Pythium, Brown Patch need free water.
         */
        droughtSuppressionSoilMoisture: 20,

        /**
         * Temperature (°C) above which cool-season pathogens are hard-gated.
         * Fusarium ceases at ~18°C. Dollar Spot slows above 30°C.
         */
        coolSeasonPathogenCutoff: 18,

        /**
         * Night temperature (°C) below which warm-season pathogens can't
         * establish. Brown Patch needs nights > 16°C, Pythium > 20°C.
         */
        warmSeasonPathogenNightMin: 16,

        /**
         * Enable console logging for debugging modifier application
         */
        debug: false
    };

    // =========================================================================
    // DISEASE-SPECIFIC SUPPRESSION/AMPLIFICATION RULES
    // =========================================================================
    // Each rule defines when a disease risk should be modified based on
    // environmental context. Rules are applied in order; modifiers stack
    // multiplicatively.
    //
    // Research citations are inline. All suppressions have a biological
    // mechanism — we're not just curve-fitting, we're encoding known
    // pathogen ecology.
    // =========================================================================

    var DISEASE_RULES = {

        /**
         * DOLLAR SPOT (Clarireedia jacksonii)
         * - Needs dew/leaf wetness and moderate temperatures (15-30°C)
         * - SUPPRESSED by drought (no moisture for mycelial growth)
         * - SUPPRESSED by extreme heat (>32°C reduces pathogen viability)
         * - AMPLIFIED by N deficiency (well established — Couch 1995)
         * - AMPLIFIED by shade stress (extended leaf wetness + weak turf)
         */
        dollarSpot: {
            suppressors: [
                {
                    name: 'drought',
                    condition: function(ctx) {
                        return ctx.stressFactors.drought && ctx.stressFactors.drought.severity > 0.3;
                    },
                    modifier: function(ctx) {
                        // Drought severity 0.3–1.0 maps to 0.70–0.55 multiplier
                        var severity = Math.min(1, ctx.stressFactors.drought.severity);
                        return 1 - (severity - 0.3) * 0.22;
                    },
                    reason: 'Drought suppresses mycelial growth, C. jacksonii requires dew/moisture',
                    source: 'Couch 1995; Walsh et al. 1999'
                },
                {
                    name: 'extreme_heat',
                    condition: function(ctx) {
                        return ctx.climate.temperature && ctx.climate.temperature.max > 32;
                    },
                    modifier: function(ctx) {
                        var excess = ctx.climate.temperature.max - 32;
                        return Math.max(0.65, 1 - excess * 0.05); // -5% per °C above 32
                    },
                    reason: 'Dollar Spot pathogen viability declines above 32°C',
                    source: 'Smiley et al. 2005'
                }
            ],
            amplifiers: [
                {
                    name: 'shade_stress',
                    condition: function(ctx) {
                        // b35fix132: only fire when physical obstruction is present.
                        // Time-of-day DLI accumulation (e.g. morning low DLI) is not
                        // the same risk as structural shade from trees or buildings.
                        // Without this gate, an analysis run at 7am produces a different
                        // Dollar Spot recommendation than the same run at 9am.
                        return ctx.stressFactors.shade &&
                               ctx.stressFactors.shade.hasStructuralShade &&
                               ctx.stressFactors.shade.severity > 0.2;
                    },
                    modifier: function(ctx) {
                        // Shade extends leaf wetness duration and weakens turf
                        return 1 + ctx.stressFactors.shade.severity * 0.20;
                    },
                    reason: 'Shade extends dew duration and reduces turf vigour',
                    source: 'Vargas 2005'
                }
            ]
        },

        /**
         * BROWN PATCH (Rhizoctonia solani)
         * - Needs warm nights (>16°C) and high humidity/leaf wetness
         * - SUPPRESSED by drought (needs prolonged leaf wetness)
         * - SUPPRESSED by cool nights (<14°C night temps = pathogen inactive)
         * - AMPLIFIED by excessive N (lush, soft growth)
         * - AMPLIFIED by waterlogging (extended moisture + weakened roots)
         */
        brownPatch: {
            suppressors: [
                {
                    name: 'drought',
                    condition: function(ctx) {
                        return ctx.stressFactors.drought && ctx.stressFactors.drought.severity > 0.3;
                    },
                    modifier: function(ctx) {
                        var severity = Math.min(1, ctx.stressFactors.drought.severity);
                        return 1 - (severity - 0.3) * 0.30;
                    },
                    reason: 'Drought reduces leaf wetness duration below infection threshold',
                    source: 'Smiley et al. 2005; Vargas 2005'
                },
                {
                    name: 'extreme_heat_suppression',
                    condition: function(ctx) {
                        // Brown patch R. solani actually declines above ~35°C
                        return ctx.climate.temperature && ctx.climate.temperature.max > 35;
                    },
                    modifier: function(ctx) {
                        var excess = ctx.climate.temperature.max - 35;
                        return Math.max(0.60, 1 - excess * 0.08);
                    },
                    reason: 'R. solani growth rate declines above 35°C',
                    source: 'Smiley et al. 2005'
                }
            ],
            amplifiers: [
                {
                    name: 'waterlogging',
                    condition: function(ctx) {
                        return ctx.stressFactors.waterlogging && ctx.stressFactors.waterlogging.severity > 0.2;
                    },
                    modifier: function(ctx) {
                        return 1 + ctx.stressFactors.waterlogging.severity * 0.25;
                    },
                    reason: 'Saturated conditions extend leaf wetness and weaken root zone',
                    source: 'Turgeon 2012'
                },
                {
                    name: 'heat_stress_predisposition',
                    condition: function(ctx) {
                        // Heat-stressed C3 turf is more susceptible in the
                        // 25-35°C sweet spot where the pathogen is still active
                        return ctx.stressFactors.temperature &&
                               ctx.stressFactors.temperature.severity > 0.3 &&
                               ctx.climate.temperature &&
                               ctx.climate.temperature.max <= 35 &&
                               ctx.climate.temperature.max >= 25;
                    },
                    modifier: function(ctx) {
                        return 1 + ctx.stressFactors.temperature.severity * 0.15;
                    },
                    reason: 'Heat-stressed C3 turf has compromised defense responses',
                    source: 'Xu & Huang 2009; Dernoeden 2012'
                }
            ]
        },

        /**
         * PYTHIUM BLIGHT (Pythium aphanidermatum)
         * - Water mold — REQUIRES free water or near-saturation
         * - STRONGLY SUPPRESSED by drought (organism cannot survive)
         * - SUPPRESSED if nights stay cool (<20°C)
         * - AMPLIFIED by waterlogging (standing water = zoospore paradise)
         * - AMPLIFIED by poor drainage + heat (classic Pythium conditions)
         */
        pythiumBlight: {
            suppressors: [
                {
                    name: 'drought',
                    condition: function(ctx) {
                        return ctx.stressFactors.drought && ctx.stressFactors.drought.severity > 0.15;
                    },
                    modifier: function(ctx) {
                        // Pythium is extremely moisture-dependent — even mild
                        // drought significantly reduces risk
                        var severity = Math.min(1, ctx.stressFactors.drought.severity);
                        return Math.max(0.55, 1 - severity * 0.45);
                    },
                    reason: 'Water mold requires free water, drought eliminates zoospore activity',
                    source: 'Nutter & Shane 1983; Smiley et al. 2005'
                },
                {
                    name: 'low_humidity_dry_air',
                    condition: function(ctx) {
                        return ctx.climate.humidity && ctx.climate.humidity.mean < 65;
                    },
                    modifier: function(ctx) {
                        var deficit = 65 - ctx.climate.humidity.mean;
                        return Math.max(0.60, 1 - deficit * 0.015);
                    },
                    reason: 'Low ambient humidity prevents sustained leaf wetness for zoospores',
                    source: 'Nutter & Shane 1983'
                }
            ],
            amplifiers: [
                {
                    name: 'waterlogging',
                    condition: function(ctx) {
                        return ctx.stressFactors.waterlogging && ctx.stressFactors.waterlogging.severity > 0.1;
                    },
                    modifier: function(ctx) {
                        return 1 + ctx.stressFactors.waterlogging.severity * 0.35;
                    },
                    reason: 'Standing water provides ideal medium for zoospore release and spread',
                    source: 'Smiley et al. 2005'
                }
            ]
        },

        /**
         * ANTHRACNOSE (Colletotrichum cereale)
         * - Fundamentally a STRESS disease — pathogen is opportunistic
         * - AMPLIFIED by heat + drought compound (classic summer stress)
         * - AMPLIFIED by low mowing + compaction (mechanical stress)
         * - SUPPRESSED when plant is vigorous (high GP, good nutrition)
         * - N status already handled by disease model, so we focus on
         *   compound stress amplification here
         */
        anthracnose: {
            suppressors: [
                {
                    name: 'vigorous_growth',
                    condition: function(ctx) {
                        // If GP is high and stress is low, turf can outgrow infection
                        return ctx.growthPotential > 70 &&
                               ctx.environmentalStressIndex < 15;
                    },
                    modifier: function() {
                        return 0.80; // 20% suppression for vigorous, unstressed turf
                    },
                    reason: 'Vigorous turf outgrows C. cereale infection courts',
                    source: 'Inguagiato et al. 2009; Dernoeden 2012'
                }
            ],
            amplifiers: [
                {
                    name: 'compound_heat_drought',
                    condition: function(ctx) {
                        // Heat + drought is THE classic anthracnose trigger
                        return ctx.stressFactors.temperature &&
                               ctx.stressFactors.temperature.severity > 0.3 &&
                               ctx.stressFactors.drought &&
                               ctx.stressFactors.drought.severity > 0.2;
                    },
                    modifier: function(ctx) {
                        var combined = ctx.stressFactors.temperature.severity +
                                       ctx.stressFactors.drought.severity;
                        return 1 + Math.min(0.35, combined * 0.20);
                    },
                    reason: 'Heat + drought compound is the primary anthracnose trigger in Poa/bent',
                    source: 'Inguagiato et al. 2009; Murphy et al. 2008'
                },
                {
                    name: 'multi_stressor',
                    condition: function(ctx) {
                        // 3+ active stressors = highly compromised turf
                        return ctx.activeStressorCount >= 3;
                    },
                    modifier: function(ctx) {
                        return 1 + (ctx.activeStressorCount - 2) * 0.10;
                    },
                    reason: 'Multiple concurrent stressors overwhelm plant defenses',
                    source: 'Dernoeden 2012'
                }
            ]
        },

        /**
         * FUSARIUM PATCH (Microdochium nivale)
         * - Strictly cool-season (0-12°C optimal)
         * - Already has hard temp gate in disease model at 18°C
         * - SUPPRESSED by drought (needs moist/wet conditions)
         * - AMPLIFIED by low growth potential (turf can't recover)
         * - Temperature gate is handled by disease model, so coupling
         *   focuses on moisture and growth modifiers
         */
        fusarium: {
            suppressors: [
                {
                    name: 'drought',
                    condition: function(ctx) {
                        return ctx.stressFactors.drought && ctx.stressFactors.drought.severity > 0.2;
                    },
                    modifier: function(ctx) {
                        var severity = Math.min(1, ctx.stressFactors.drought.severity);
                        return Math.max(0.65, 1 - severity * 0.30);
                    },
                    reason: 'M. nivale requires moist conditions for spore germination',
                    source: 'Smith et al. 1989; Smiley et al. 2005'
                }
            ],
            amplifiers: [
                {
                    name: 'low_growth_potential',
                    condition: function(ctx) {
                        // In cold conditions with low GP, turf can't recover
                        // from Fusarium lesions
                        return ctx.growthPotential < 25 &&
                               ctx.climate.temperature &&
                               ctx.climate.temperature.mean < 10;
                    },
                    modifier: function(ctx) {
                        var gpDeficit = (25 - ctx.growthPotential) / 25;
                        return 1 + gpDeficit * 0.20;
                    },
                    reason: 'Low GP prevents recovery from lesions, damage accumulates',
                    source: 'Vargas 2005'
                },
                {
                    name: 'waterlogging_cold',
                    condition: function(ctx) {
                        return ctx.stressFactors.waterlogging &&
                               ctx.stressFactors.waterlogging.severity > 0.2 &&
                               ctx.climate.temperature &&
                               ctx.climate.temperature.mean < 12;
                    },
                    modifier: function(ctx) {
                        return 1 + ctx.stressFactors.waterlogging.severity * 0.20;
                    },
                    reason: 'Waterlogged cold conditions ideal for M. nivale establishment',
                    source: 'Smith et al. 1989'
                }
            ]
        },

        /**
         * TAKE-ALL PATCH (Gaeumannomyces graminis)
         * - Root pathogen — soil-borne, not directly moisture-dependent
         * - AMPLIFIED by high soil pH (reduces Mn availability)
         * - SUPPRESSED by vigorous root growth / high GP
         * - Soil pH modifier already in disease engine, so coupling
         *   focuses on growth-capacity and compound stress
         */
        takeAll: {
            suppressors: [
                {
                    name: 'active_root_growth',
                    condition: function(ctx) {
                        return ctx.growthPotential > 60 &&
                               ctx.environmentalStressIndex < 20;
                    },
                    modifier: function() {
                        return 0.85; // Active root growth can outpace infection
                    },
                    reason: 'Active root growth outpaces G. graminis hyphal advance',
                    source: 'Dernoeden 2012'
                }
            ],
            amplifiers: [
                {
                    name: 'drought_root_stress',
                    condition: function(ctx) {
                        // Drought weakens root system — take-all exploits this
                        return ctx.stressFactors.drought &&
                               ctx.stressFactors.drought.severity > 0.3;
                    },
                    modifier: function(ctx) {
                        return 1 + ctx.stressFactors.drought.severity * 0.15;
                    },
                    reason: 'Drought-stressed roots less able to resist hyphal colonisation',
                    source: 'Dernoeden 2012'
                }
            ]
        },

        /**
         * GRAY LEAF SPOT (Pyricularia grisea)
         * - Warm, humid conditions (26-30°C with leaf wetness)
         * - SUPPRESSED by drought (needs prolonged leaf wetness)
         * - AMPLIFIED by excessive N (soft succulent tissue)
         * - AMPLIFIED by heat stress in susceptible species
         */
        grayLeafSpot: {
            suppressors: [
                {
                    name: 'drought',
                    condition: function(ctx) {
                        return ctx.stressFactors.drought && ctx.stressFactors.drought.severity > 0.2;
                    },
                    modifier: function(ctx) {
                        var severity = Math.min(1, ctx.stressFactors.drought.severity);
                        return Math.max(0.60, 1 - severity * 0.35);
                    },
                    reason: 'P. grisea conidia require sustained leaf wetness for germination',
                    source: 'Uddin et al. 2003'
                }
            ],
            amplifiers: [
                {
                    name: 'shade_humidity_trap',
                    condition: function(ctx) {
                        // b35fix132: same structural shade gate as shade_stress above.
                        return ctx.stressFactors.shade &&
                               ctx.stressFactors.shade.hasStructuralShade &&
                               ctx.stressFactors.shade.severity > 0.2 &&
                               ctx.climate.humidity &&
                               ctx.climate.humidity.mean > 80;
                    },
                    modifier: function(ctx) {
                        return 1 + ctx.stressFactors.shade.severity * 0.20;
                    },
                    reason: 'Shade creates humidity microclimate extending infection period',
                    source: 'Uddin et al. 2003; Vargas 2005'
                }
            ]
        },

        /**
         * SPRING DEAD SPOT (Ophiosphaerella spp.)
         * - Root/crown disease of C4 grasses
         * - Infection occurs in autumn, symptoms in spring
         * - AMPLIFIED by cold stress (weakens C4 dormancy survival)
         * - SUPPRESSED by mild winters (turf doesn't go fully dormant)
         */
        springDeadSpot: {
            suppressors: [
                {
                    name: 'mild_winter',
                    condition: function(ctx) {
                        // If soil temp stays above dormancy threshold, less SDS
                        return ctx.climate.temperature &&
                               ctx.climate.temperature.min > 5;
                    },
                    modifier: function() {
                        return 0.80;
                    },
                    reason: 'Mild winters reduce freeze damage to crowns, limiting SDS expression',
                    source: 'Smiley et al. 2005'
                }
            ],
            amplifiers: [
                {
                    name: 'cold_stress_compound',
                    condition: function(ctx) {
                        return ctx.stressFactors.temperature &&
                               ctx.stressFactors.temperature.severity > 0.3 &&
                               ctx.climate.temperature &&
                               ctx.climate.temperature.min < 0;
                    },
                    modifier: function(ctx) {
                        return 1 + ctx.stressFactors.temperature.severity * 0.25;
                    },
                    reason: 'Freeze-damaged crowns more susceptible to Ophiosphaerella',
                    source: 'Smiley et al. 2005; Dernoeden 2012'
                }
            ]
        },

        /**
         * HELMINTHOSPORIUM (Bipolaris/Drechslera leaf spots)
         * - Broad group — stress and drought predispose
         * - AMPLIFIED by heat + drought (common summer leaf spot trigger)
         * - AMPLIFIED by low N
         * - SUPPRESSED by cool, moist conditions (plant vigorous)
         */
        helminthosporium: {
            suppressors: [
                {
                    name: 'cool_moist_vigorous',
                    condition: function(ctx) {
                        return ctx.growthPotential > 65 &&
                               ctx.environmentalStressIndex < 15;
                    },
                    modifier: function() {
                        return 0.80;
                    },
                    reason: 'Vigorous turf in optimal conditions resists Helminthosporium spp.',
                    source: 'Smiley et al. 2005'
                }
            ],
            amplifiers: [
                {
                    name: 'heat_drought_stress',
                    condition: function(ctx) {
                        return ctx.stressFactors.temperature &&
                               ctx.stressFactors.temperature.severity > 0.2 &&
                               ctx.stressFactors.drought &&
                               ctx.stressFactors.drought.severity > 0.2;
                    },
                    modifier: function(ctx) {
                        var combined = ctx.stressFactors.temperature.severity +
                                       ctx.stressFactors.drought.severity;
                        return 1 + Math.min(0.30, combined * 0.18);
                    },
                    reason: 'Heat + drought is the classic Helminthosporium trigger',
                    source: 'Smiley et al. 2005; Turgeon 2012'
                }
            ]
        },

        /**
         * LARGE PATCH (Rhizoctonia solani AG 2-2 LP)
         * - C4 turf only — attacks during dormancy transition
         * - AMPLIFIED by slow spring greenup (extended vulnerability)
         * - SUPPRESSED by rapid greenup / warm spring
         */
        largePatch: {
            suppressors: [
                {
                    name: 'rapid_greenup',
                    condition: function(ctx) {
                        return ctx.growthPotential > 50 && ctx.isC4;
                    },
                    modifier: function() {
                        return 0.80;
                    },
                    reason: 'Rapid greenup shortens the vulnerable dormancy transition window',
                    source: 'Smiley et al. 2005'
                }
            ],
            amplifiers: [
                {
                    name: 'slow_dormancy_transition',
                    condition: function(ctx) {
                        // C4 in transition with low GP = extended vulnerability
                        return ctx.isC4 && ctx.growthPotential < 30 &&
                               ctx.growthPotential > 5;
                    },
                    modifier: function(ctx) {
                        var gpDeficit = (30 - ctx.growthPotential) / 30;
                        return 1 + gpDeficit * 0.25;
                    },
                    reason: 'Slow transition extends pathogen access to weakened tissue',
                    source: 'Smiley et al. 2005'
                }
            ]
        }
    };

    // =========================================================================
    // GLOBAL STRESS MODIFIERS
    // =========================================================================
    // Applied to ALL diseases when conditions are extreme enough.
    // These capture the general principle that heavily stressed turf
    // is more susceptible to disease across the board.
    // =========================================================================

    var GLOBAL_RULES = {
        /**
         * Very high combined stress → general amplification
         * When ESI > 50, turf defences are broadly compromised
         */
        highStress: {
            condition: function(ctx) {
                return ctx.environmentalStressIndex > 50;
            },
            modifier: function(ctx) {
                var excess = (ctx.environmentalStressIndex - 50) / 50;
                return 1 + excess * 0.15; // Up to +15% at ESI=100
            },
            reason: 'Broadly compromised plant defenses under high environmental stress'
        },

        /**
         * Very low growth potential → general amplification
         * Turf can't grow/repair, so disease damage accumulates
         */
        lowGrowthRecovery: {
            condition: function(ctx) {
                return ctx.growthPotential < CONFIG.growthSuppressionThreshold;
            },
            modifier: function(ctx) {
                var deficit = (CONFIG.growthSuppressionThreshold - ctx.growthPotential) /
                              CONFIG.growthSuppressionThreshold;
                return 1 + deficit * 0.15;
            },
            reason: 'Low growth potential prevents recovery from disease damage'
        },

        /**
         * Salinity stress → mild general amplification
         * Salt-stressed turf has reduced vigor and compromised defenses
         */
        salinityStress: {
            condition: function(ctx) {
                return ctx.stressFactors.salinity && ctx.stressFactors.salinity.severity > 0.2;
            },
            modifier: function(ctx) {
                return 1 + ctx.stressFactors.salinity.severity * 0.10;
            },
            reason: 'Salinity stress reduces plant vigor and disease resistance'
        }
    };

    // =========================================================================
    // CONTEXT BUILDER
    // =========================================================================

    /**
     * Build a normalized context object from hub state data.
     * This extracts all the information disease rules need to evaluate
     * conditions, so individual rules don't need to navigate the full
     * hub state structure.
     *
     * @param {Object} stressAggregates - From hub-orchestrator calculateStressAggregates()
     * @param {Object} climate - Authoritative climate data from hub-orchestrator
     * @param {Object} climateV2 - Optional GAIP_ClimateV2 analysis results
     * @param {string} species - Normalized species key
     * @returns {Object} Normalized context for rule evaluation
     */
    function buildContext(stressAggregates, climate, climateV2, species) {
        var ctx = {
            // Stress state
            environmentalStressIndex: 0,
            combinedGrowthModifier: 1.0,
            stressFactors: {},
            activeStressorCount: 0,

            // Climate
            climate: {
                temperature: null,
                humidity: null,
                precipitation: null,
                soilMoisture: null
            },

            // Growth
            growthPotential: 50,

            // Species context
            isC4: false,
            isC3: true,
            species: species || 'perennialRyegrass'
        };

        // Extract stress aggregates
        if (stressAggregates) {
            ctx.environmentalStressIndex = stressAggregates.environmentalStressIndex || 0;
            ctx.combinedGrowthModifier = stressAggregates.combinedGrowthModifier || 1.0;

            // Index stress factors by type for easy lookup
            // b35fix132: preserve hasStructuralShade on shade factor so coupling
            // rules can gate on physical obstruction vs time-of-day DLI shortfall.
            var factors = stressAggregates.factors || [];
            for (var i = 0; i < factors.length; i++) {
                var f = factors[i];
                ctx.stressFactors[f.type] = {
                    severity: f.severity || 0,
                    impact: f.impact || '',
                    note: f.note || '',
                    hasStructuralShade: f.hasStructuralShade || false
                };
            }
            ctx.activeStressorCount = factors.filter(function(f) {
                return f.severity > 0.15;
            }).length;
        }

        // Extract climate data
        if (climate) {
            ctx.climate.temperature = climate.temperature || null;
            ctx.climate.humidity = climate.humidity || climate.moisture?.humidity || null;
            ctx.climate.precipitation = climate.precipitation || null;
            ctx.climate.soilMoisture = climate.soilMoisture || null;
        }

        // Extract growth potential
        if (typeof global.climateMetrics !== 'undefined' && global.climateMetrics) {
            var gm = global.climateMetrics;
            ctx.growthPotential = gm.growth?.weighted || gm.growth?.c3 || 50;
        }
        if (climateV2 && climateV2.growthPotential) {
            ctx.growthPotential = climateV2.growthPotential.enhanced ||
                                  climateV2.growthPotential.weighted ||
                                  ctx.growthPotential;
        }

        // Determine C3/C4
        var c4Species = ['couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo',
                         'buffalograss', 'paspalum', 'seashore_paspalum'];
        ctx.isC4 = c4Species.indexOf(ctx.species) >= 0;
        ctx.isC3 = !ctx.isC4;

        return ctx;
    }

    // =========================================================================
    // CORE COUPLING ENGINE
    // =========================================================================

    /**
     * Apply stress/climate coupling to disease results.
     *
     * @param {Object} diseaseResult - Raw result from DiseaseEngine.analyse()
     * @param {Object} stressAggregates - From hub-orchestrator stress computation
     * @param {Object} climate - Authoritative climate data
     * @param {Object} options - Optional: { climateV2, species }
     * @returns {Object} Modified disease result with coupling annotations
     */
    function applyDiseaseStressCoupling(diseaseResult, stressAggregates, climate, options) {
        if (!diseaseResult || !diseaseResult.diseases) {
            return diseaseResult;
        }

        options = options || {};
        var species = options.species || diseaseResult.species || 'perennialRyegrass';
        var climateV2 = options.climateV2 || null;

        // Build evaluation context
        var ctx = buildContext(stressAggregates, climate, climateV2, species);

        console.log('[b35debug-diseaseRace] buildContext result', {
            growthPotential: ctx.growthPotential,
            stressFactorTypes: Object.keys(ctx.stressFactors),
            salinityFactor: ctx.stressFactors.salinity || null,
            environmentalStressIndex: ctx.environmentalStressIndex,
            globalClimateMetricsGrowth: (typeof global.climateMetrics !== 'undefined' && global.climateMetrics && global.climateMetrics.growth) || null,
            t: Date.now()
        });

        if (CONFIG.debug) {
        }

        // Track modifications for the summary
        var modifications = [];
        var totalSuppression = 0;
        var totalAmplification = 0;

        // Process each disease
        for (var d = 0; d < diseaseResult.diseases.length; d++) {
            var disease = diseaseResult.diseases[d];
            var diseaseKey = disease.disease;
            var originalRisk = disease.adjustedRisk;
            var couplingModifier = 1.0;
            var appliedRules = [];

            // 1. Apply disease-specific rules
            var rules = DISEASE_RULES[diseaseKey];
            if (rules) {
                // Suppressors
                if (rules.suppressors) {
                    for (var s = 0; s < rules.suppressors.length; s++) {
                        var rule = rules.suppressors[s];
                        if (rule.condition(ctx)) {
                            var mod = rule.modifier(ctx);
                            couplingModifier *= mod;
                            appliedRules.push({
                                type: 'suppress',
                                name: rule.name,
                                modifier: mod,
                                reason: rule.reason
                            });
                        }
                    }
                }

                // Amplifiers
                if (rules.amplifiers) {
                    for (var a = 0; a < rules.amplifiers.length; a++) {
                        var rule = rules.amplifiers[a];
                        if (rule.condition(ctx)) {
                            var mod = rule.modifier(ctx);
                            couplingModifier *= mod;
                            appliedRules.push({
                                type: 'amplify',
                                name: rule.name,
                                modifier: mod,
                                reason: rule.reason
                            });
                        }
                    }
                }
            }

            // 2. Apply global rules
            var globalKeys = Object.keys(GLOBAL_RULES);
            for (var g = 0; g < globalKeys.length; g++) {
                var globalRule = GLOBAL_RULES[globalKeys[g]];
                if (globalRule.condition(ctx)) {
                    var mod = globalRule.modifier(ctx);
                    couplingModifier *= mod;
                    appliedRules.push({
                        type: mod > 1 ? 'amplify' : 'suppress',
                        name: globalKeys[g],
                        modifier: mod,
                        reason: globalRule.reason,
                        global: true
                    });
                }
            }

            // 3. Enforce caps
            if (couplingModifier < (1 - CONFIG.maxSuppression)) {
                couplingModifier = 1 - CONFIG.maxSuppression;
            }
            if (couplingModifier > (1 + CONFIG.maxAmplification)) {
                couplingModifier = 1 + CONFIG.maxAmplification;
            }

            // 4. Apply modifier
            var newRisk = Math.min(100, Math.max(0, Math.round(originalRisk * couplingModifier)));

            // Only apply if modifier is meaningful (>2% change)
            if (Math.abs(newRisk - originalRisk) >= 2) {
                disease.preCouplingRisk = originalRisk;
                disease.adjustedRisk = newRisk;
                disease.riskLevel = classifyRisk(newRisk);
                disease.couplingApplied = true;
                disease.couplingModifier = Math.round(couplingModifier * 1000) / 1000;
                disease.couplingRules = appliedRules;

                var direction = newRisk < originalRisk ? 'suppressed' : 'amplified';
                var delta = newRisk - originalRisk;

                disease.couplingNote = direction === 'suppressed'
                    ? 'Risk reduced ' + Math.abs(delta) + 'pp by environmental context'
                    : 'Risk increased ' + delta + 'pp due to stress predisposition';

                if (direction === 'suppressed') {
                    totalSuppression += Math.abs(delta);
                } else {
                    totalAmplification += delta;
                }

                modifications.push({
                    disease: disease.displayName,
                    from: originalRisk,
                    to: newRisk,
                    direction: direction,
                    rules: appliedRules.map(function(r) { return r.name; })
                });

                if (CONFIG.debug) {
                }
            } else {
                disease.couplingApplied = false;
            }
        }

        // Re-sort diseases by adjusted risk (descending). b35fix353b: defensive
        // `|| 0` coercion on each side — bare `b.adjustedRisk - a.adjustedRisk`
        // propagates NaN if either operand is undefined/NaN, sending the
        // NaN-affected disease to an undefined sort position.
        diseaseResult.diseases.sort(function(a, b) {
            return (b.adjustedRisk || 0) - (a.adjustedRisk || 0);
        });

        // Recalculate overall score using same MAX logic as disease engine.
        // b35fix353b: defensive Number.isFinite guard mirrors the
        // disease-engine-pure.js fix. If any disease's adjustedRisk is NaN or
        // undefined post-coupling, Math.max returns NaN and surfaces as
        // `Disease Pressure: MINIMAL NaN%`. Coerce non-finite values to 0 at
        // the read point — same shape as the engine's overallScore guard.
        // #91: Fusarium is tagged 'unvalidated' (not 'beta'), so the beta
        // filter alone doesn't catch it. Client asked specifically for
        // Fusarium, not every unvalidated model, so this excludes by key.
        var validatedDiseases = diseaseResult.diseases.filter(function(d) {
            return d.validationStatus !== 'beta' &&
                   !(d.validationBadge && d.validationBadge.indexOf('BETA') >= 0) &&
                   d.disease !== 'fusarium';
        });
        var _safeAdjRisk = function(d) {
            return (typeof d.adjustedRisk === 'number' && isFinite(d.adjustedRisk)) ? d.adjustedRisk : 0;
        };
        var newOverallScore = validatedDiseases.length > 0
            ? Math.max.apply(null, validatedDiseases.map(_safeAdjRisk))
            : (diseaseResult.diseases.length > 0
                ? Math.max.apply(null, diseaseResult.diseases.map(_safeAdjRisk))
                : 0);

        diseaseResult.overallScore = newOverallScore;
        diseaseResult.overallRisk = classifyRisk(newOverallScore);

        // Recalculate top threats
        diseaseResult.topThreats = (validatedDiseases.length > 0 ? validatedDiseases : diseaseResult.diseases).slice(0, 3).map(function(d) {
            return {
                disease: d.displayName,
                risk: d.adjustedRisk,
                level: d.riskLevel,
                primaryDriver: d.primaryDriver || Object.keys(d.drivers || {})[0],
                regionalMultiplier: d.regionalMultiplier,
                nutrientNote: d.nutrientNote || null,
                couplingNote: d.couplingNote || null
            };
        });

        // Recalculate alerts
        diseaseResult.alerts = diseaseResult.diseases
            .filter(function(d) { return d.riskLevel === 'severe' || d.riskLevel === 'high'; })
            .map(function(d) {
                return {
                    disease: d.displayName,
                    urgency: d.riskLevel === 'severe' ? 'critical' : 'high',
                    message: d.displayName + ' risk ' + d.riskLevel.toUpperCase() + ' (' + d.adjustedRisk + '%)',
                    action: d.interventions?.timing || 'Action recommended',
                    type: d.alertType || d.riskLevel.toUpperCase() + '_RISK'
                };
            });

        // Attach coupling summary
        diseaseResult.coupling = {
            version: VERSION,
            applied: modifications.length > 0,
            modifications: modifications,
            totalSuppression: totalSuppression,
            totalAmplification: totalAmplification,
            context: {
                environmentalStressIndex: ctx.environmentalStressIndex,
                growthPotential: ctx.growthPotential,
                activeStressors: Object.keys(ctx.stressFactors),
                isC4: ctx.isC4
            }
        };

        // ─── ALWAYS LOG OUTCOME ─── visible proof it ran ───
        if (modifications.length > 0) {
            console.group('%c[DiseaseStressCoupling] ✅ Applied', 'color: #059669; font-weight: bold');
            console.table(modifications.map(function(m) {
                return {
                    Disease: m.disease,
                    Before: m.from + '%',
                    After: m.to + '%',
                    Change: (m.direction === 'suppressed' ? '↓' : '↑') + Math.abs(m.to - m.from) + 'pp',
                    Rules: m.rules.join(', ')
                };
            }));
            console.groupEnd();
        } else {
        }

        return diseaseResult;
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    function classifyRisk(score) {
        if (score >= 85) return 'severe';
        if (score >= 70) return 'high';
        if (score >= 50) return 'moderate';
        if (score >= 25) return 'low';
        return 'minimal';
    }

    // =========================================================================
    // FORECAST COUPLING
    // =========================================================================

    /**
     * Apply coupling to the daily disease forecast.
     * Uses the same rules but applied per-day using forecast climate data.
     *
     * @param {Object} forecastResult - From DiseaseForecast.generateForecast()
     * @param {Object} stressAggregates - Current stress state
     * @param {Array} dailyClimate - Array of daily climate objects
     * @param {string} species - Normalized species key
     * @returns {Object} Modified forecast with coupling applied
     */
    function applyForecastCoupling(forecastResult, stressAggregates, dailyClimate, species) {
        if (!forecastResult || !forecastResult.diseases || !dailyClimate) {
            return forecastResult;
        }

        // For forecast, we apply a simplified version:
        // Use current stress state (it won't change much over 7 days)
        // but adjust per-day based on that day's climate
        for (var d = 0; d < forecastResult.diseases.length; d++) {
            var disease = forecastResult.diseases[d];
            var diseaseKey = disease.key;
            var rules = DISEASE_RULES[diseaseKey];

            if (!rules || !disease.forecast) continue;

            for (var day = 0; day < disease.forecast.length; day++) {
                var dayClimate = dailyClimate[day];
                if (!dayClimate) continue;

                // Build a lightweight daily context
                var dayCtx = buildContext(stressAggregates, {
                    temperature: {
                        mean: dayClimate.mean,
                        min: dayClimate.min,
                        max: dayClimate.max
                    },
                    humidity: { mean: dayClimate.humidity },
                    precipitation: { total: dayClimate.precipitation }
                }, null, species);

                var mod = 1.0;

                // Apply suppressors
                if (rules.suppressors) {
                    for (var s = 0; s < rules.suppressors.length; s++) {
                        if (rules.suppressors[s].condition(dayCtx)) {
                            mod *= rules.suppressors[s].modifier(dayCtx);
                        }
                    }
                }

                // Apply amplifiers
                if (rules.amplifiers) {
                    for (var a = 0; a < rules.amplifiers.length; a++) {
                        if (rules.amplifiers[a].condition(dayCtx)) {
                            mod *= rules.amplifiers[a].modifier(dayCtx);
                        }
                    }
                }

                // Cap
                mod = Math.max(1 - CONFIG.maxSuppression, Math.min(1 + CONFIG.maxAmplification, mod));

                // Apply
                var originalRisk = disease.forecast[day].risk;
                var newRisk = Math.min(100, Math.max(0, Math.round(originalRisk * mod)));
                if (Math.abs(newRisk - originalRisk) >= 2) {
                    disease.forecast[day].preCouplingRisk = originalRisk;
                    disease.forecast[day].risk = newRisk;
                }
            }
        }

        forecastResult.couplingApplied = true;
        return forecastResult;
    }

    // =========================================================================
    // CONSOLE VERIFICATION
    // =========================================================================

    /**
     * Quick verification — call from browser console:
     *   GAIP_DiseaseStressCoupling.verify()
     *
     * Shows: module loaded, last coupling result, current stress context
     */
    function verify() {
        console.group('%c[DiseaseStressCoupling] Verification', 'color: #2563eb; font-weight: bold; font-size: 13px');
        
        // Check if disease result has coupling data
        var dr = global.GAIP_DISEASE_RESULT;
        if (dr && dr.coupling) {
            if (dr.coupling.modifications && dr.coupling.modifications.length > 0) {
                console.table(dr.coupling.modifications.map(function(m) {
                    return {
                        Disease: m.disease,
                        Before: m.from + '%',
                        After: m.to + '%',
                        Change: (m.direction === 'suppressed' ? '↓' : '↑') + Math.abs(m.to - m.from) + 'pp',
                        Rules: m.rules.join(', ')
                    };
                }));
            }
            // Show per-disease detail
            if (dr.diseases) {
                dr.diseases.forEach(function(d) {
                    if (d.couplingApplied) {
                        d.couplingRules.forEach(function(r) {
                        });
                    } else {
                    }
                });
            }
        } else if (dr) {
        } else {
        }
        
        // Check stress data availability
        var stress = global._hubState?.computed?.stress || global.GAIP_STATE?.computed?.stress;
        if (stress) {
        } else {
        }
        
        console.groupEnd();
    }

    // =========================================================================
    // EXPORTS
    // =========================================================================

    var DiseaseStressClimateCoupling = {
        VERSION: VERSION,

        // Main entry points
        apply: applyDiseaseStressCoupling,
        applyForecast: applyForecastCoupling,

        // Console verification
        verify: verify,

        // For testing / inspection
        buildContext: buildContext,
        DISEASE_RULES: DISEASE_RULES,
        GLOBAL_RULES: GLOBAL_RULES,
        CONFIG: CONFIG
    };

    // Export to global
    global.GAIP_DiseaseStressCoupling = DiseaseStressClimateCoupling;

    // Alias for hub-orchestrator
    global.gaip_disease_stress_coupling = applyDiseaseStressCoupling;


})(typeof window !== 'undefined' ? window : this);
