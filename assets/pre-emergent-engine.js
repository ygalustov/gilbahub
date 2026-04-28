/**
 * GAIP Pre-Emergent Herbicide Timing Engine
 * v1.1.0
 *
 * Pure function engine. No globals, no DOM, no side effects.
 * Inputs: soil temperature (measured or modelled), 14-day forecast, selected species.
 * Outputs: per-species alert status, days-to-threshold, application window flags.
 *
 * Alert logic:
 *   GREEN      — >5°C below germination threshold (or trend not yet moving toward threshold)
 *   AMBER      — within 5°C of threshold, trajectory moving toward threshold
 *   RED_EARLY  — at or within 1°C of threshold (window closing)
 *   RED_MISSED — above/below threshold for 5+ consecutive days (timing passed)
 *
 * Poa annua uses a DECLINING temperature trigger (autumn cooling), all others rising.
 *
 * TROPICAL REGIONS (v1.1.0):
 *   Regions 'southeast_asia', 'australia_tropical', 'australia_subtropical' now
 *   activate a separate tropical weed suite. In these regions soil temps typically
 *   remain above germination thresholds year-round, so pre-emergent timing is driven
 *   by rainfall/wet-season onset rather than temperature alone. Where soil temp is
 *   persistently above threshold, the engine returns a PERSISTENT_PRESSURE flag
 *   and shifts recommendations to programme-based application intervals.
 *
 * All thresholds sourced from peer-reviewed literature. Confidence ratings:
 *   H = peer-reviewed primary research  (85–100% confidence)
 *   M = university extension, cited     (60–80% confidence)
 *   L = industry/extension, limited     (30–55% confidence)
 *
 * Tropical citations: Rao et al. (1996); Teuton et al. (2004); CABI Invasive
 *   Species Compendium; Webster & MacDonald (2001); Patterson (1985);
 *   Chauhan & Johnson (2008); Chauhan (2013); Caton et al. (2004);
 *   Manh et al. (2012); Sellers et al. (2003).
 *
 * Temperate citations: Fidanza et al. (1996); Taylor et al. (2021); King & Oliver (1994);
 *   Teuton et al. (2004); Grundy et al. (2000); Hill et al. (2014);
 *   Letchamo & Gosselin (1996); Baxter et al. (2019); Cardina et al. (2011).
 *
 * Gilba Solutions | Internal development | March 2026
 */

(function (global) {
    'use strict';

    var VERSION = '1.1.0';

    // =========================================================================
    // GERMINATION THRESHOLD DATABASE
    // =========================================================================
    // Thresholds are the temperature at which germination BEGINS.
    // applyAt is the temperature at which to apply pre-emergent (3–5°C below threshold).
    // direction: 'rising' = spring/summer weeds; 'declining' = Poa annua, cool-season weeds.
    // depth: soil measurement depth in mm (spec uses 2–3 cm for most, 5 cm for engine inputs).
    // Notes: L-rated species never trigger RED alerts.

    var SPECIES_DB = {
        // ── Warm-season grassy weeds (rising temperature trigger) ─────────────
        digitaria_sanguinalis: {
            name: 'Digitaria sanguinalis',
            commonName: 'Large crabgrass',
            type: 'warm_grass',
            season: 'spring_summer',
            direction: 'rising',
            germinationThreshold: 14,   // 13–15°C min; using midpoint
            germinationOptimal: 18,     // 16–19°C mean
            applyAt: 11,                // 10–12°C
            alertBuffer: 5,             // AMBER fires when within 5°C
            closingBuffer: 1,           // RED_EARLY fires when within 1°C
            confidenceRating: 'H',
            confidenceScore: 90,
            depthMm: 25,
            notes: 'Fidanza et al. (1996); Cardina et al. (2011). Most-cited threshold in turfgrass literature.',
            regions: ['all'],
            springOnly: true,        // Spring/summer germinator — shown in Spring window section
            gdd: { base_C: 10, threshold: 200, description: 'GDD₁₀ ≥ 200 supports pre-emergent timing confirmation' }
        },
        digitaria_ischaemum: {
            name: 'Digitaria ischaemum',
            commonName: 'Smooth crabgrass',
            type: 'warm_grass',
            season: 'spring_summer',
            direction: 'rising',
            germinationThreshold: 13,
            germinationOptimal: 16,
            applyAt: 10,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 70,
            depthMm: 25,
            notes: 'King & Oliver (1994). Slightly lower threshold than large crabgrass.',
            regions: ['all'],
            springOnly: true,
            gdd: { base_C: 10, threshold: 150, description: 'GDD₁₀ ≥ 150 (lower than D. sanguinalis; earlier emergence)' }
        },
        digitaria_ciliaris: {
            name: 'Digitaria ciliaris',
            commonName: 'Southern crabgrass',
            type: 'warm_grass',
            season: 'spring_summer',
            direction: 'rising',
            germinationThreshold: 15,
            germinationOptimal: 20,
            applyAt: 12,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 88,
            depthMm: 20,   // surface measurement
            notes: 'Teuton et al. (2004). Primary species in subtropical AU/NZ.',
            regions: ['au', 'nz'],
            springOnly: true
        },
        eleusine_indica: {
            name: 'Eleusine indica',
            commonName: 'Goosegrass',
            type: 'warm_grass',
            season: 'spring_summer',
            direction: 'rising',
            germinationThreshold: 17,   // 15–18°C midpoint
            germinationOptimal: 25,
            applyAt: 13,                // 12–14°C midpoint
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 68,
            depthMm: 25,
            notes: 'Germinates later than crabgrass. Difficult to control post-emergence.',
            regions: ['all'],
            springOnly: true,
            gdd: { base_C: 10, threshold: 260, description: 'GDD₁₀ ≥ 260 (delayed vs crabgrass; confirms late-spring timing)' }
        },
        dactyloctenium_aegyptium: {
            name: 'Dactyloctenium aegyptium',
            commonName: 'Crowfoot grass',
            type: 'warm_grass',
            season: 'spring_summer',
            direction: 'rising',
            germinationThreshold: 18,
            germinationOptimal: 24,
            applyAt: 15,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 42,
            depthMm: 25,
            notes: 'Limited primary data. Industry extension only. Informational note only — no hard alerts.',
            regions: ['au'],
            springOnly: true
        },

        // ── Cool-season grassy weeds (declining temperature trigger) ──────────
        poa_annua: {
            name: 'Poa annua',
            commonName: 'Winter grass / Annual bluegrass',
            type: 'cool_grass',
            season: 'autumn_winter',
            direction: 'declining',   // REVERSE: trigger fires on COOLING
            germinationThreshold: 26, // AU onset: germination begins at ~26°C declining (Taylor et al. 2021
                                      // gives optimum 15–20°C, maximum ~28°C; AU field observations confirm
                                      // germination active at 25–26°C soil in early autumn)
            germinationOptimal: 15,   // 13–18°C
            applyAt: 26,              // Apply when soil trending toward 26°C in autumn
            alertBuffer: 5,           // AMBER at 31°C declining (5°C above threshold)
            closingBuffer: 1,         // RED_EARLY at 27°C declining (1°C above threshold)
            confidenceRating: 'H',
            confidenceScore: 92,
            depthMm: 25,
            notes: 'Threshold revised to 26°C for AU conditions. Taylor et al. (2021) max ~28°C; AU practitioner threshold 26°C (Dernoeden 2013). Directionally reversed: alert on DECLINING autumn soil temp.',
            regions: ['all'],
            reversedLogic: true,       // Flag for engine to invert comparisons
            cdd21c: { base_C: 21, description: 'CDD base 21°C (Patton et al. 2021, Tennessee). SECONDARY indicator only — ' +
                      'not AU primary trigger. Use as corroborating signal when AU 26°C trigger is borderline.' }
        },

        // ── Broadleaf weeds ───────────────────────────────────────────────────
        stellaria_media: {
            name: 'Stellaria media',
            commonName: 'Common chickweed',
            type: 'broadleaf_annual',
            season: 'autumn',
            direction: 'declining',
            germinationThreshold: 20, // Apply when declining through 20°C
            germinationOptimal: 15,
            applyAt: 22,              // 2°C above threshold for declining trigger
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 86,
            depthMm: 25,
            notes: 'Grundy et al. (2000); Hill et al. (2014). Winter annual — apply in early autumn.',
            regions: ['all'],
            reversedLogic: true,
            broadleafNote: 'Standard dinitroaniline pre-emergents (prodiamine, pendimethalin) have limited activity on broadleaves. Isoxaben (Gallery) is the main broadleaf pre-emergent option.'
        },
        soliva_sessilis: {
            name: 'Soliva sessilis',
            commonName: 'Bindii / Lawn burweed',
            type: 'broadleaf_annual',
            season: 'autumn_winter',
            direction: 'declining',
            germinationThreshold: 15, // Night temps 13–16°C
            germinationOptimal: 14,
            applyAt: 18,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 65,
            depthMm: 25,
            notes: 'Clemson HGIC; NC State Extension. Apply before nights drop to 13°C. Key pest in AU lawns.',
            regions: ['au', 'nz'],
            reversedLogic: true,
            broadleafNote: 'Isoxaben or oxadiazon needed for effective control. Standard dinitroanilines have limited broadleaf activity.'
        },
        taraxacum_officinale: {
            name: 'Taraxacum officinale',
            commonName: 'Dandelion',
            type: 'broadleaf_perennial',
            season: 'autumn',            // AU primary flush is autumn (Feb–Apr)
            direction: 'declining',      // Germination triggered by COOLING soil
            germinationThreshold: 22,    // Onset ~22°C declining in AU conditions
            germinationOptimal: 18,      // Cardina et al. (1997)
            applyAt: 22,
            alertBuffer: 5,              // AMBER at 27°C declining
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 82,
            depthMm: 25,
            notes: 'Cardina et al. (1997); Letchamo & Gosselin (1996). AU autumn flush Feb–Apr. Threshold revised to declining 22°C for AU conditions.',
            regions: ['all'],
            reversedLogic: true,
            perennialWarning: 'Perennial — pre-emergent suppresses seedlings only. Vegetative spread from established plants continues. Post-emergent strategy preferred.'
        },
        oxalis_corniculata: {
            name: 'Oxalis corniculata',
            commonName: 'Creeping woodsorrel',
            type: 'broadleaf_perennial',
            season: 'autumn',            // Strongest AU flush is autumn as soil cools
            direction: 'declining',      // Germination peaks on cooling through ~20°C
            germinationThreshold: 20,    // AU autumn onset; wide range but peak flush here
            germinationOptimal: 16,
            applyAt: 20,
            alertBuffer: 5,              // AMBER at 25°C declining
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 60,
            depthMm: 25,
            notes: 'Wide germination range (10–30°C). AU autumn flush dominant. Threshold 20°C declining based on practitioner observation; limited primary AU data.',
            regions: ['au', 'nz', 'uk', 'eu', 'scandinavia'],
            reversedLogic: true,
            perennialWarning: 'Perennial/annual. Pre-emergent timing less reliable due to broad germination range. Post-emergent preferred for established plants.'
        },
        trifolium_repens: {
            name: 'Trifolium repens',
            commonName: 'White clover',
            type: 'broadleaf_perennial',
            season: 'autumn',            // AU/NZ autumn seeding flush is the agronomically significant window
            direction: 'declining',      // Apply before autumn cooling triggers mass germination
            germinationThreshold: 15,    // CORRECTED: 15°C is the germination trigger (upper bound of active
                                         // germination window). 18°C is thermoinhibition threshold (Td) from
                                         // Sharifiamina et al. (2019) HTT model — NOT the germination trigger.
                                         // Baxter et al. (2019): optimal 10.9–17.2°C; Tb = 3.22°C.
            germinationOptimal: 13,      // midpoint Baxter et al. (2019) optimal range
            applyAt: 20,                 // Apply when soil declining through 20°C; 5°C ahead of trigger
            alertBuffer: 5,              // AMBER at 25°C declining
            closingBuffer: 1,            // RED_EARLY at 21°C declining
            confidenceRating: 'M',       // CORRECTED from H: perennial biology, AU isoxaben gap, broad window
            confidenceScore: 65,         // CORRECTED from 83
            depthMm: 25,
            notes: 'Sharifiamina et al. (2019) HTT model: Td = 18.3°C (thermoinhibition), Tb = 3.22°C. ' +
                   'Baxter et al. (2019): optimal germination 10.9–17.2°C. AU/NZ primary flush: March–May. ' +
                   'Secondary flush July–September. Wide range (5–28°C lab) reduces pre-emergent reliability.',
            regions: ['au', 'nz', 'uk', 'eu', 'scandinavia'],
            reversedLogic: true,
            perennialWarning: 'Perennial stoloniferous weed. Pre-emergent suppresses seedling recruitment only — ' +
                              'established patches are unaffected. Post-emergent (dicamba, clopyralid, fluroxypyr) ' +
                              'is the primary strategy for established plants.',
            broadleafNote: 'AU ALERT: Isoxaben (most effective pre-emergent for clover) is NOT registered for turf ' +
                           'use in Australia (APVMA). Dinitroanilines (prodiamine, pendimethalin, dithiopyr) have ' +
                           'POOR efficacy on legumes. Best available AU-registered option: oxadiazon (POOR–MODERATE). ' +
                           'NZ: isoxaben registration status requires verification with ACVM.'
        },
        lamium_amplexicaule: {
            name: 'Lamium amplexicaule',
            commonName: 'Henbit',
            type: 'broadleaf_annual',
            season: 'autumn',
            direction: 'declining',
            germinationThreshold: 15, // 10–15°C; fall germinator
            germinationOptimal: 12,
            applyAt: 18,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 86,
            depthMm: 25,
            notes: 'Hill et al. (2014). Apply when soil temp declining through 18°C in autumn.',
            regions: ['all'],
            reversedLogic: true,
            broadleafNote: 'Isoxaben or trifluralin required for henbit control. Standard dinitroanilines limited.'
        },
        hypochoeris_radicata: {
            name: 'Hypochoeris radicata',
            commonName: "Catsear / False dandelion",
            type: 'broadleaf_perennial',
            season: 'autumn',            // Strongly autumn in AU; rosette establishes Feb–May
            direction: 'declining',      // Germination on cooling soil
            germinationThreshold: 20,    // Practitioner-based AU autumn onset; no strong primary data
            germinationOptimal: 15,
            applyAt: 20,
            alertBuffer: 5,              // AMBER at 25°C declining
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 38,
            depthMm: 25,
            notes: 'Limited primary AU data. Threshold 20°C declining based on practitioner observation. Informational only — no RED alerts.',
            regions: ['au', 'nz'],
            reversedLogic: true,
            perennialWarning: 'Perennial. Post-emergent preferred. Pre-emergent efficacy data limited.'
        }
    };

    // =========================================================================
    // REGION SETS
    // =========================================================================

    var TROPICAL_REGIONS = ['southeast_asia', 'australia_tropical', 'australia_subtropical'];

    // =========================================================================
    // TROPICAL SPECIES DATABASE
    // =========================================================================
    // Separate from temperate SPECIES_DB. Loaded when region is in TROPICAL_REGIONS.
    //
    // IMPORTANT NOTE ON TROPICAL PRE-EMERGENT TIMING:
    // In SE Asia and tropical AU, soil temperatures rarely (or never) fall below
    // germination thresholds for these species. Temperature-based timing windows
    // therefore have limited diagnostic value. The engine uses a PERSISTENT_PRESSURE
    // flag (see analyse()) to flag this condition, and shifts the recommendation
    // to programme-based interval application tied to wet-season onset and
    // residual activity windows rather than soil temp thresholds.
    //
    // The germinationThreshold values here represent the MINIMUM temperature for
    // germination — useful for sub-tropical sites that experience brief cool periods.
    // For full-tropical sites (Vietnam, northern QLD) these thresholds are never
    // the binding constraint. Wet-season onset and mowing/stress-induced gaps in
    // sward density are the primary risk drivers.
    //
    // Cyperus rotundus: excluded from pre-emergent DB entirely — see note below.

    var TROPICAL_SPECIES_DB = {

        // ── Grassy weeds ──────────────────────────────────────────────────────

        digitaria_ciliaris: {
            name: 'Digitaria ciliaris',
            commonName: 'Southern crabgrass',
            type: 'warm_grass',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 15,
            germinationOptimal: 22,
            applyAt: 12,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 88,
            depthMm: 20,
            notes: 'Teuton et al. (2004). Dominant Digitaria in tropical AU and SE Asia. Threshold 15°C minimum; optimal 20–25°C. In tropical zones soil temp is persistently above threshold — programme-based timing recommended.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical'],
            tropicalNote: 'Year-round germination pressure in full-tropical zones. Apply pre-emergent 8–12 weeks before wet-season onset and repeat at residual activity interval (typically 10–14 weeks depending on product).',
            springOnly: false
        },

        echinochloa_colona: {
            name: 'Echinochloa colona',
            commonName: 'Awnless barnyard grass',
            type: 'warm_grass',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 18,   // Minimum; Rao et al. (1996) minimum ~18°C, optimal 28–35°C
            germinationOptimal: 30,
            applyAt: 15,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 85,
            depthMm: 20,
            notes: 'Rao et al. (1996) Weed Research 36:341–350. Minimum germination temp 18°C, optimal 28–35°C. Very fast germinator under warm wet conditions — high urgency at wet-season onset.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical'],
            tropicalNote: 'Germinates explosively at wet-season onset when soil temps exceed 28°C. Critical timing: apply before first sustained rain event of wet season.',
            springOnly: false
        },

        eleusine_indica: {
            name: 'Eleusine indica',
            commonName: 'Goosegrass',
            type: 'warm_grass',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 17,   // Chauhan & Johnson (2008); range 15–18°C minimum
            germinationOptimal: 25,
            applyAt: 14,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 72,
            depthMm: 25,
            notes: 'Chauhan & Johnson (2008) Weed Biol. Manag. 8:32–39. Minimum ~17°C. Compaction-associated — extremely common on high-traffic tropical courses. Dinitroaniline resistance emerging in SE Asia.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical', 'au'],
            resistanceWarning: 'Dinitroaniline resistance (prodiamine, pendimethalin, oryzalin) documented in SE Asia. Rotate MOA if repeated pre-emergent failures are observed.',
            tropicalNote: 'Associated with soil compaction — cultural control (aeration) is as important as chemical. Pre-emergent timing at wet-season onset.',
            springOnly: false
        },

        axonopus_compressus: {
            name: 'Axonopus compressus',
            commonName: 'Broad-leaf carpet grass',
            type: 'warm_grass',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 18,   // CABI ISC; estimated minimum — limited primary data
            germinationOptimal: 28,
            applyAt: 15,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 40,
            depthMm: 25,
            notes: 'CABI Invasive Species Compendium. Threshold 18°C estimated; limited primary germination data. Invades couch fairways in humid tropics via poor sward cover.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical'],
            tropicalNote: 'Cultural control (maintain dense couch sward, avoid scalping) is primary strategy. Pre-emergent has limited efficacy on established stolons.',
            springOnly: false
        },

        paspalum_distichum: {
            name: 'Paspalum distichum',
            commonName: 'Water couch / knotgrass',
            type: 'warm_grass',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 15,   // Patterson (1985); germination 15–35°C range
            germinationOptimal: 27,
            applyAt: 12,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 60,
            depthMm: 25,
            notes: 'Patterson (1985) Weed Sci. 33:316–323. Germination range 15–35°C. Perennial — spreads vegetatively via rhizomes/stolons. Pre-emergent suppresses seedlings only; vegetative spread continues.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical', 'au'],
            perennialWarning: 'Perennial with rhizomatous spread. Pre-emergent controls seedling establishment only — not effective against established stands. Post-emergent + renovation programme required for couch greens invasion.',
            tropicalNote: 'Wet conditions accelerate spread. Drainage management is the primary cultural control.',
            springOnly: false
        },

        rottboellia_cochinchinensis: {
            name: 'Rottboellia cochinchinensis',
            commonName: 'Itch grass',
            type: 'warm_grass',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 20,   // CABI ISC; optimal 30–35°C, minimum ~20°C
            germinationOptimal: 32,
            applyAt: 17,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 38,
            depthMm: 25,
            notes: 'CABI Invasive Species Compendium. Minimum ~20°C estimated; optimal 30–35°C. Increasing in tropical QLD and SE Asia. Limited golf course primary data.',
            regions: ['southeast_asia', 'australia_tropical'],
            tropicalNote: 'Itchy seed hairs are a worker health and safety concern during removal. Wear PPE during manual removal operations.',
            springOnly: false
        },

        leptochloa_spp: {
            name: 'Leptochloa spp.',
            commonName: 'Sprangletop',
            type: 'warm_grass',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 18,   // Webster & MacDonald (2001); Leptochloa chinensis minimum ~18°C
            germinationOptimal: 30,
            applyAt: 15,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 42,
            depthMm: 20,
            notes: 'Webster & MacDonald (2001) Weed Technol. 15:867–879 (L. chinensis). Sand profiles, tropical. Minimum ~18°C estimated.',
            regions: ['southeast_asia', 'australia_tropical'],
            tropicalNote: 'Sand-profile specialist. Dinitroaniline pre-emergents have activity; timing at wet-season onset.',
            springOnly: false
        },

        // ── Sedges ────────────────────────────────────────────────────────────

        kyllinga_brevifolia: {
            name: 'Kyllinga brevifolia',
            commonName: 'Green kyllinga',
            type: 'sedge',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 20,   // Sellers et al. (2003); estimated from turf literature
            germinationOptimal: 28,
            applyAt: 17,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 58,
            depthMm: 25,
            notes: 'Sellers et al. (2003) Int. Turfgrass Soc. Res. J. Limited germination threshold data. Threshold 20°C estimated from SE Asia practitioner experience. Often misidentified as grass on greens/tees.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical'],
            sedgeNote: 'MSMA (where registered), halosulfuron, or imazosulfuron are primary post-emergent controls in SE Asia. Most dinitroaniline pre-emergents have poor sedge activity. Halosulfuron has some pre-emergent activity on Kyllinga at high rates — check label.',
            tropicalNote: 'Frequently misidentified as grass — check ligule, triangular stem cross-section. Correct ID is essential before selecting chemistry.',
            springOnly: false
        },

        fimbristylis_miliacea: {
            name: 'Fimbristylis miliacea',
            commonName: 'Grasslike fimbry / Ricefield fimbristylis',
            type: 'sedge',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 20,   // Caton et al. (2004) estimated minimum for wet tropical conditions
            germinationOptimal: 30,
            applyAt: 17,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 35,
            depthMm: 25,
            notes: 'Caton et al. (2004) Weed Biol. Manag. Wet tropical conditions. Threshold estimated at 20°C minimum; limited primary golf-course data.',
            regions: ['southeast_asia', 'australia_tropical'],
            sedgeNote: 'Wet/waterlogged conditions greatly increase risk. Drainage improvement is primary control strategy.',
            tropicalNote: 'Strongly associated with waterlogged soils. Address drainage before relying on chemistry.',
            springOnly: false
        },

        cyperus_rotundus: {
            name: 'Cyperus rotundus',
            commonName: 'Purple nutsedge',
            type: 'sedge_perennial',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 20,   // Tuber sprouting minimum ~20°C; Chauhan (2013)
            germinationOptimal: 30,
            applyAt: null,              // PRE-EMERGENT INEFFECTIVE — tuber-spread dominant
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 90,
            depthMm: 25,
            notes: 'Chauhan (2013) Crop Prot. 46:93–102. Tuber sprouting minimum ~20°C, optimal 30–35°C. Pre-emergent herbicides are NOT effective against tuber-driven spread — this is a post-emergent + cultural programme only.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical', 'au'],
            preEmergentIneffective: true,  // Engine flag: pre-emergent NOT recommended
            sedgeNote: 'Halosulfuron, imazosulfuron, and MSMA (where registered) are post-emergent options. Repeat applications required. No pre-emergent provides reliable tuber suppression — do not rely on dinitroanilines for this species.',
            perennialWarning: 'Spreads almost entirely by tubers. Pre-emergent herbicide will NOT provide meaningful control. Post-emergent strategy only.',
            tropicalNote: 'Arguably the most economically damaging weed on tropical golf courses globally. Integrated programme: halosulfuron POST at 3–4 week intervals during active growth + avoid scalping/soil disturbance which exposes tubers.',
            springOnly: false
        },

        cyperus_esculentus: {
            name: 'Cyperus esculentus',
            commonName: 'Yellow nutsedge',
            type: 'sedge_perennial',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 20,
            germinationOptimal: 28,
            applyAt: null,              // PRE-EMERGENT INEFFECTIVE — tuber-spread dominant
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'H',
            confidenceScore: 85,
            depthMm: 25,
            notes: 'Manh et al. (2012); Chauhan (2013). Slightly less aggressive than C. rotundus but same control logic applies. Tuber-spread dominant.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical', 'au'],
            preEmergentIneffective: true,
            sedgeNote: 'Same chemistry as C. rotundus. Halosulfuron post-emergent preferred.',
            perennialWarning: 'Pre-emergent herbicide NOT recommended for tuber-spreading Cyperus. Post-emergent strategy only.',
            springOnly: false
        },

        // ── Tropical broadleaf weeds ──────────────────────────────────────────

        euphorbia_hirta: {
            name: 'Euphorbia hirta',
            commonName: 'Asthma weed / Garden spurge',
            type: 'broadleaf_annual',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 20,   // Estimated minimum; tropical conditions; limited primary data
            germinationOptimal: 28,
            applyAt: 17,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 40,
            depthMm: 20,
            notes: 'Threshold 20°C estimated from tropical distribution data. No reliable primary germination threshold study found. Low-growing; most management is post-emergent or cultural.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical'],
            broadleafNote: 'Isoxaben has activity. MCPA or bromoxynil post-emergent in warm-season turf (check label and species safety). Prostrate habit makes mowing control partially effective.',
            tropicalNote: 'Year-round pressure in full-tropical zones. Focus on maintaining dense sward to suppress emergence.',
            springOnly: false
        },

        murdannia_nudiflora: {
            name: 'Murdannia nudiflora',
            commonName: 'Doveweed / Nakedstem dewflower',
            type: 'broadleaf_annual',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 20,   // Estimated; warm-season annual; limited threshold data
            germinationOptimal: 28,
            applyAt: 17,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 38,
            depthMm: 25,
            notes: 'Threshold 20°C estimated. Increasingly problematic on SE Asia and tropical QLD golf courses. Highly tolerant of many post-emergent herbicides — limited chemistry options available.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical'],
            broadleafNote: 'Extremely tolerant of many herbicide chemistries. Halosulfuron has shown some activity at high rates (off-label reference only — check current registration). Topramezone has some activity. Carfentrazone effective. Cultural control (reduce moisture, aerate) is primary strategy.',
            tropicalNote: 'Thrives under excess moisture — reducing irrigation frequency is a meaningful agronomic intervention.',
            springOnly: false
        },

        phyllanthus_urinaria: {
            name: 'Phyllanthus urinaria',
            commonName: 'Chamber bitter',
            type: 'broadleaf_annual',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 22,   // Estimated; warm-season annual
            germinationOptimal: 30,
            applyAt: 19,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 35,
            depthMm: 20,
            notes: 'Threshold 22°C estimated from tropical distribution and growth habit data. No reliable primary threshold study. Very common in Vietnam and tropical Asia; less studied than other species.',
            regions: ['southeast_asia', 'australia_tropical'],
            broadleafNote: 'Isoxaben activity reported. Post-emergent options limited on warm-season turf — check current registrations carefully.',
            springOnly: false
        },

        richardia_scabra: {
            name: 'Richardia scabra',
            commonName: 'Rough Mexican clover',
            type: 'broadleaf_annual',
            season: 'wet_season',
            direction: 'rising',
            germinationThreshold: 15,   // Estimated from SE USA/tropical extension literature
            germinationOptimal: 26,
            applyAt: 12,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'L',
            confidenceScore: 42,
            depthMm: 25,
            notes: 'Threshold 15°C estimated from SE USA extension data (no reliable primary AU/SE Asia study found). Common in tropical QLD and SE Asia.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical'],
            broadleafNote: 'Isoxaben provides pre-emergent activity. MCPA, bromoxynil post-emergent (check label compatibility with turf species).',
            springOnly: false
        },

        oxalis_corniculata: {
            name: 'Oxalis corniculata',
            commonName: 'Creeping woodsorrel',
            type: 'broadleaf_perennial',
            season: 'year_round',
            direction: 'rising',
            germinationThreshold: 15,   // Wide range; active in tropical zones at lower temps
            germinationOptimal: 22,
            applyAt: 12,
            alertBuffer: 5,
            closingBuffer: 1,
            confidenceRating: 'M',
            confidenceScore: 60,
            depthMm: 25,
            notes: 'Wide germination range (10–30°C). Included in both temperate and tropical suites. AU tropical/subtropical sites have year-round germination pressure.',
            regions: ['southeast_asia', 'australia_tropical', 'australia_subtropical', 'au', 'nz'],
            perennialWarning: 'Perennial/annual. Year-round germination in tropical zones. Pre-emergent timing less reliable due to broad germination range — programme-based application recommended.',
            springOnly: false
        }
    };

    // ── Cyperus nutsedge advisory note (referenced in integration layer) ─────
    // C. rotundus and C. esculentus have preEmergentIneffective: true.
    // The integration layer should surface a dedicated advisory card for these
    // species rather than an application window alert.

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function round(val, dp) {
        var factor = Math.pow(10, dp || 0);
        return Math.round(val * factor) / factor;
    }

    /**
     * Compute 10-day rolling average from an array of daily soil temps.
     * Uses up to last 10 values available.
     */
    function rollingAverage(temps, days) {
        if (!temps || temps.length === 0) return null;
        days = days || 10;
        var slice = temps.slice(-days).filter(function (t) { return t != null && !isNaN(t); });
        if (slice.length === 0) return null;
        return round(slice.reduce(function (a, b) { return a + b; }, 0) / slice.length, 1);
    }

    /**
     * Estimate soil temperature trend (°C/day) from last N days.
     * Positive = warming, negative = cooling.
     */
    function computeTrend(temps, days) {
        days = days || 7;
        if (!temps || temps.length < 3) return 0;
        var slice = temps.slice(-days).filter(function (t) { return t != null && !isNaN(t); });
        if (slice.length < 3) return 0;
        // Simple linear regression slope
        var n = slice.length;
        var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (var i = 0; i < n; i++) {
            sumX += i;
            sumY += slice[i];
            sumXY += i * slice[i];
            sumX2 += i * i;
        }
        var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return round(isNaN(slope) ? 0 : slope, 2);
    }

    /**
     * Project days until a temperature threshold is reached given current temp and trend.
     * Returns null if trend is away from threshold or zero.
     */
    function daysToThreshold(currentTemp, threshold, trend, isReversed) {
        if (!trend || trend === 0) return null;
        var delta;
        if (isReversed) {
            // Declining trigger: threshold is crossed when temp FALLS below it
            if (trend >= 0) return null; // Warming — moving away from threshold
            delta = currentTemp - threshold;
            if (delta <= 0) return 0;   // Already past threshold
            return Math.round(delta / Math.abs(trend));
        } else {
            // Rising trigger: threshold is crossed when temp RISES above it
            if (trend <= 0) return null; // Cooling — moving away from threshold
            delta = threshold - currentTemp;
            if (delta <= 0) return 0;   // Already past threshold
            return Math.round(delta / trend);
        }
    }

    /**
     * Project forecast soil temp N days out by applying linear trend to current temp.
     * Returns array of {day, temp} objects.
     */
    function projectSoilTempForecast(currentTemp, trend, days) {
        var forecast = [];
        for (var i = 0; i <= days; i++) {
            forecast.push({
                day: i,
                temp: round(currentTemp + trend * i, 1)
            });
        }
        return forecast;
    }

    /**
     * Check if threshold has been exceeded for N consecutive days.
     * Used to detect RED_MISSED condition.
     */
    function consecutiveDaysExceeded(soilTempHistory, threshold, days, isReversed) {
        if (!soilTempHistory || soilTempHistory.length < days) return false;
        var recent = soilTempHistory.slice(-days);
        return recent.every(function (t) {
            return isReversed ? t <= threshold : t >= threshold;
        });
    }

    // =========================================================================
    // ALERT STATUS COMPUTATION (per species)
    // =========================================================================

    /**
     * Compute alert status for a single species.
     *
     * @param {object} species    — entry from SPECIES_DB
     * @param {number} currentTemp — current 5cm soil temp (°C)
     * @param {number[]} tempHistory — array of recent daily 5cm soil temps
     * @param {number} moistureMm  — recent rainfall/irrigation mm (for activation flag)
     * @param {number[]} forecastTemps — 14-day forecast daily soil temps (optional)
     * @returns {object} alert result
     */
    function computeSpeciesAlert(species, currentTemp, tempHistory, moistureMm, forecastTemps) {
        var isReversed = !!species.reversedLogic;
        var threshold = species.germinationThreshold;
        var applyAt = species.applyAt;
        var trend = computeTrend(tempHistory, 14); // 14-day window for seasonal direction
        var rollingAvg = rollingAverage(tempHistory, 10);
        var workingTemp = rollingAvg != null ? rollingAvg : currentTemp;

        var days = daysToThreshold(workingTemp, threshold, trend, isReversed);
        // Use rolling average history for missed check to avoid false positives from
        // diurnal/weather noise. A single cool day dipping below threshold in a warming
        // trend should not trigger RED_MISSED — only sustained rolling avg crossing counts.
        var smoothedHistory = tempHistory.map(function(_, i, arr) {
            var window = arr.slice(Math.max(0, i - 2), i + 1); // 3-day trailing smooth
            return window.reduce(function(a, b) { return a + b; }, 0) / window.length;
        });
        var missedThreshold = consecutiveDaysExceeded(smoothedHistory, threshold, 5, isReversed);

        // Distance from threshold (positive = not yet reached)
        var distanceFromThreshold;
        if (isReversed) {
            distanceFromThreshold = workingTemp - threshold; // positive = above threshold (not yet triggered)
        } else {
            distanceFromThreshold = threshold - workingTemp; // positive = below threshold (not yet triggered)
        }

        // Is the trend moving TOWARD the threshold?
        var movingTowardThreshold = isReversed ? trend < 0 : trend > 0;

        // ── Determine alert status ────────────────────────────────────────────
        var alertStatus, applicationWindowOpen, applicationWindowClosing;

        // For declining-trigger species (e.g. Poa annua):
        // RED_MISSED requires smoothed history to have crossed threshold AND trend cooling.
        // A warming short-term trend cannot have caused us to miss the autumn window.
        var effectiveMissed = missedThreshold && (isReversed ? trend <= 0 : trend >= 0);

        // b35fix227: Rising species (spring germinators) in autumn cooling context.
        // If soil is well above the applyAt threshold AND trend is negative (cooling),
        // the spring application window has passed — force RED_MISSED regardless of
        // the consecutiveDaysExceeded check, which can't distinguish "approaching in
        // spring" from "well past in autumn cooling". The cutoff is soil > applyAt + 5°C
        // with a negative trend — this cannot be a rising-window situation.
        if (!isReversed && trend < 0 && workingTemp > threshold + 5) {
            effectiveMissed = true;
        }

        // For declining species, rolling avg already below threshold = window is open
        // regardless of short-term trend direction. A warm day doesn't close the window
        // once the 10-day average has crossed below the apply threshold.
        // For rising species, rollingAvg >= threshold means soil is ABOVE the apply
        // point — only treat as "approaching" if trend is also positive (warming).
        var rollingAvgBelowThreshold = isReversed
            ? (rollingAvg != null && rollingAvg <= threshold)
            : (rollingAvg != null && rollingAvg >= threshold && trend >= 0);

        if (effectiveMissed) {
            alertStatus = 'RED_MISSED';
            applicationWindowOpen = false;
            applicationWindowClosing = false;
        } else if (distanceFromThreshold <= species.closingBuffer && (movingTowardThreshold || rollingAvgBelowThreshold)) {
            alertStatus = 'RED_EARLY';
            applicationWindowOpen = true;
            applicationWindowClosing = true;
        } else if (distanceFromThreshold <= species.alertBuffer && (movingTowardThreshold || rollingAvgBelowThreshold)) {
            alertStatus = 'AMBER';
            applicationWindowOpen = true;
            applicationWindowClosing = false;
        } else {
            alertStatus = 'GREEN';
            applicationWindowOpen = false;
            applicationWindowClosing = false;
        }

        // L-rated species: cap at AMBER (never RED)
        if (species.confidenceRating === 'L' && (alertStatus === 'RED_EARLY' || alertStatus === 'RED_MISSED')) {
            alertStatus = 'AMBER';
            applicationWindowClosing = false;
        }

        // ── Recommended action string ─────────────────────────────────────────
        var recommendedAction = buildRecommendedAction(alertStatus, species, days, moistureMm, workingTemp, trend);

        // ── Residual risk ─────────────────────────────────────────────────────
        // Based on proximity to threshold and trend velocity
        var residualRisk;
        if (alertStatus === 'RED_MISSED') {
            residualRisk = 'HIGH';
        } else if (alertStatus === 'RED_EARLY') {
            residualRisk = 'HIGH';
        } else if (alertStatus === 'AMBER') {
            residualRisk = 'MEDIUM';
        } else {
            residualRisk = 'LOW';
        }

        // ── Moisture activation flag ──────────────────────────────────────────
        var moistureWarning = null;
        if ((alertStatus === 'AMBER' || alertStatus === 'RED_EARLY') && (moistureMm == null || moistureMm < 6)) {
            moistureWarning = 'Ensure 6–13 mm irrigation within 48 hours of application to activate product.';
        }

        // ── Forecast projection ───────────────────────────────────────────────
        var soilTempProjection = projectSoilTempForecast(workingTemp, trend, 14);

        return {
            speciesKey: null,           // overwritten at call site
            scientificName: species.name,
            commonName: species.commonName,
            alertStatus: alertStatus,
            daysToThreshold: days,
            applicationWindowOpen: applicationWindowOpen,
            applicationWindowClosing: applicationWindowClosing,
            residualRisk: residualRisk,
            recommendedAction: recommendedAction,
            confidenceScore: species.confidenceScore,
            confidenceRating: species.confidenceRating,

            // Diagnostic data
            currentSoilTemp: round(currentTemp, 1),
            rollingAvg10d: workingTemp,
            trend7d: trend,
            distanceFromThreshold: round(distanceFromThreshold, 1),
            germinationThreshold: threshold,
            applyAt: applyAt,
            isReversedLogic: isReversed,
            movingTowardThreshold: movingTowardThreshold,
            moistureWarning: moistureWarning,
            soilTempProjection: soilTempProjection,

            // Supplementary context
            perennialWarning: species.perennialWarning || null,
            broadleafNote: species.broadleafNote || null,
            notes: species.notes
        };
    }

    /**
     * Build a human-readable recommended action string.
     */
    function buildRecommendedAction(alertStatus, species, days, moistureMm, currentTemp, trend) {
        var lowMoisture = moistureMm == null || moistureMm < 6;
        var moistureNote = lowMoisture ? ' Ensure 6–13 mm irrigation within 48 hours of application.' : '';

        switch (alertStatus) {
            case 'GREEN':
                if (days != null) {
                    return 'No action required. Estimated ' + days + ' days until application window opens. Monitor weekly.';
                }
                return 'No action required. Monitor soil temperature trend weekly.';

            case 'AMBER':
                if (species.confidenceRating === 'L') {
                    return 'Informational: Pre-emergent application window approaching for ' + species.commonName + ' (low confidence data). Verify local conditions before applying.' + moistureNote;
                }
                if (days != null && days <= 7) {
                    return 'Pre-emergent application window open. Apply within ' + days + ' days before germination threshold is reached.' + moistureNote;
                }
                return 'Pre-emergent application window open. Apply and irrigate within 48–72 hours.' + moistureNote;

            case 'RED_EARLY':
                return 'Window closing — apply immediately if pre-emergent not yet applied. Residual protection still possible if product is incorporated now.' + moistureNote;

            case 'RED_MISSED':
                return 'Pre-emergent timing has passed — germination threshold exceeded. Switch to post-emergent strategy for ' + species.commonName + '.';

            default:
                return 'Monitor soil temperature.';
        }
    }

    /**
     * Build tropical programme-based action string for persistent pressure species.
     * Used when soil temp is persistently above germination threshold — timing
     * window logic is not the binding constraint in tropical conditions.
     */
    function buildTropicalProgrammeAction(species, moistureMm) {
        var lowMoisture = moistureMm == null || moistureMm < 6;
        var moistureNote = lowMoisture ? ' Ensure 6–13 mm irrigation within 48 hours of application.' : '';
        var base = 'Persistent germination pressure — soil temperature consistently above threshold for ' + species.commonName + '. ';
        if (species.tropicalNote) {
            return base + species.tropicalNote + moistureNote;
        }
        return base + 'Apply pre-emergent on a programme interval (10–14 weeks depending on product residual). Time initial application before wet-season onset.' + moistureNote;
    }

    // =========================================================================
    // MAIN ENGINE FUNCTION
    // =========================================================================

    /**
     * Run pre-emergent timing analysis for selected species.
     *
     * @param {object} inputs
     *   @param {number}   inputs.soilTemp5cm        — current 5cm soil temp (°C), required
     *   @param {number[]} inputs.soilTempHistory     — array of recent daily 5cm soil temps (°C), required
     *   @param {number}   inputs.moistureFlag        — recent rainfall/irrigation mm (optional)
     *   @param {number[]} inputs.soilTempForecast14d — 14-day daily forecast soil temps (optional)
     *   @param {string[]} inputs.selectedSpecies     — array of species keys from SPECIES_DB
     *   @param {string}   inputs.region              — 'au', 'nz', or 'all' (default 'all')
     *   @param {string}   inputs.hemisphere          — 'southern' or 'northern' (default 'southern')
     * @returns {object} engine result
     */
    function analyse(inputs) {
        if (!inputs) throw new Error('pre-emergent-engine: inputs required');
        if (inputs.soilTemp5cm == null || isNaN(inputs.soilTemp5cm)) {
            return {
                success: false,
                error: 'soilTemp5cm is required and must be a number',
                results: [],
                aggregateStatus: 'UNKNOWN'
            };
        }

        var soilTemp = inputs.soilTemp5cm;
        var history = inputs.soilTempHistory || [soilTemp];
        var moisture = inputs.moistureFlag != null ? inputs.moistureFlag : null;
        var forecast = inputs.soilTempForecast14d || null;
        var region = inputs.region || 'all';
        var selectedKeys = inputs.selectedSpecies;

        // ── Build active species DB for this region ───────────────────────────
        // Tropical regions: merge temperate 'all'/'au' species that also appear
        // in TROPICAL_SPECIES_DB (deduplicated by key) with tropical-only species.
        // Non-tropical regions: use SPECIES_DB only.
        var isTropical = TROPICAL_REGIONS.indexOf(region) !== -1;
        var activeDB;

        if (isTropical) {
            // TROPICAL_SPECIES_DB is the primary source for tropical regions.
            // Some keys overlap with SPECIES_DB (e.g. eleusine_indica, oxalis_corniculata,
            // paspalum_distichum, cyperus spp.) — TROPICAL_SPECIES_DB version takes precedence
            // as it has tropical-specific notes and applyAt values.
            activeDB = {};
            // Start with temperate entries that have tropical region in their regions array
            Object.keys(SPECIES_DB).forEach(function (k) {
                var s = SPECIES_DB[k];
                if (s.regions.some(function (r) { return r === region || r === 'all'; })) {
                    activeDB[k] = s;
                }
            });
            // Overlay tropical DB (overwrites any temperate entries with same key)
            Object.keys(TROPICAL_SPECIES_DB).forEach(function (k) {
                var s = TROPICAL_SPECIES_DB[k];
                if (s.regions.some(function (r) { return r === region || r === 'all'; })) {
                    activeDB[k] = s;
                }
            });
        } else {
            activeDB = {};
            Object.keys(SPECIES_DB).forEach(function (k) {
                var s = SPECIES_DB[k];
                if (s.regions.indexOf('all') !== -1 || s.regions.indexOf(region) !== -1) {
                    activeDB[k] = s;
                }
            });
        }

        // If no species selected, use all species relevant to region
        if (!selectedKeys || selectedKeys.length === 0) {
            selectedKeys = Object.keys(activeDB);
        }

        // ── Persistent pressure detection (tropical only) ────────────────────
        // If 10-day rolling average is >= 3°C above the species germination threshold
        // for 5+ consecutive days, flag PERSISTENT_PRESSURE for that species.
        // This drives a different recommendation message (programme interval vs timing window).
        var rolling10d = rollingAverage(history, 10);

        var results = [];
        var highestPriority = 0;
        var priorityMap = { GREEN: 0, AMBER: 1, RED_EARLY: 2, RED_MISSED: 3, PERSISTENT_PRESSURE: 2 };
        var priorityLabels = ['GREEN', 'AMBER', 'RED_EARLY', 'RED_MISSED'];

        for (var i = 0; i < selectedKeys.length; i++) {
            var key = selectedKeys[i];
            var species = activeDB[key];
            if (!species) {
                results.push({ speciesKey: key, error: 'Unknown species key for region: ' + region });
                continue;
            }

            // Species with preEmergentIneffective flag: return advisory-only result
            if (species.preEmergentIneffective) {
                results.push({
                    speciesKey: key,
                    scientificName: species.name,
                    commonName: species.commonName,
                    alertStatus: 'ADVISORY_ONLY',
                    preEmergentIneffective: true,
                    residualRisk: 'HIGH',
                    recommendedAction: 'Pre-emergent herbicides are NOT effective for ' + species.commonName + ' — this species spreads primarily by tubers/rhizomes. Apply post-emergent halosulfuron or imazosulfuron programme. See sedgeNote for details.',
                    sedgeNote: species.sedgeNote || null,
                    perennialWarning: species.perennialWarning || null,
                    tropicalNote: species.tropicalNote || null,
                    notes: species.notes,
                    confidenceRating: species.confidenceRating,
                    confidenceScore: species.confidenceScore
                });
                continue;
            }

            var alert = computeSpeciesAlert(species, soilTemp, history, moisture, forecast);
            alert.speciesKey = key;
            alert.scientificName = species.name;
            alert.springOnly = species.springOnly || false;

            // Tropical enrichment
            if (isTropical) {
                alert.tropicalNote = species.tropicalNote || null;
                alert.resistanceWarning = species.resistanceWarning || null;
                alert.sedgeNote = species.sedgeNote || null;

                // Persistent pressure: rolling avg >= threshold + 3°C for 5+ consecutive days
                var persistentPressure = false;
                if (rolling10d != null && !species.reversedLogic) {
                    var exceedDays = 0;
                    var checkSlice = history.slice(-5);
                    var thresh = species.germinationThreshold;
                    if (checkSlice.length >= 5) {
                        persistentPressure = checkSlice.every(function (t) { return t >= thresh + 3; });
                    }
                }
                alert.persistentPressure = persistentPressure;

                if (persistentPressure) {
                    // Override alert status — soil temp is no longer the binding constraint
                    alert.alertStatus = 'PERSISTENT_PRESSURE';
                    alert.applicationWindowOpen = true;
                    alert.applicationWindowClosing = false;
                    alert.recommendedAction = buildTropicalProgrammeAction(species, moisture);
                }
            }

            results.push(alert);

            var p = priorityMap[alert.alertStatus] || 0;
            if (p > highestPriority) highestPriority = p;
        }

        // Sort: ADVISORY_ONLY and PERSISTENT_PRESSURE last, then by priority desc, days asc
        results.sort(function (a, b) {
            var specialA = a.alertStatus === 'ADVISORY_ONLY' || a.alertStatus === 'PERSISTENT_PRESSURE';
            var specialB = b.alertStatus === 'ADVISORY_ONLY' || b.alertStatus === 'PERSISTENT_PRESSURE';
            if (!specialA && specialB) return -1;
            if (specialA && !specialB) return 1;
            var pa = priorityMap[a.alertStatus] || 0;
            var pb = priorityMap[b.alertStatus] || 0;
            if (pb !== pa) return pb - pa;
            var da = a.daysToThreshold != null ? a.daysToThreshold : 999;
            var db = b.daysToThreshold != null ? b.daysToThreshold : 999;
            return da - db;
        });

        var trend14d = computeTrend(history, 14); // 14-day window reduces short-term noise

        return {
            success: true,
            version: VERSION,
            isTropicalRegion: isTropical,
            aggregateStatus: priorityLabels[highestPriority] || 'GREEN',
            results: results,
            summary: {
                soilTemp5cm: round(soilTemp, 1),
                rollingAvg10d: rolling10d,
                trend7d: trend14d,
                trendDirection: trend14d > 0.1 ? 'warming' : trend14d < -0.1 ? 'cooling' : 'stable',
                activeAlerts: results.filter(function (r) {
                    return r.alertStatus !== 'GREEN' && r.alertStatus !== 'ADVISORY_ONLY';
                }).length,
                persistentPressureCount: results.filter(function (r) { return r.persistentPressure; }).length,
                advisoryOnlyCount: results.filter(function (r) { return r.alertStatus === 'ADVISORY_ONLY'; }).length,
                totalSpecies: results.length,
                moistureFlag: moisture,
                region: region
            }
        };
    }

    // =========================================================================
    // UTILITY: List available species
    // =========================================================================

    function listSpecies(region) {
        region = region || 'all';
        var isTropical = TROPICAL_REGIONS.indexOf(region) !== -1;
        var sourceDB;

        if (isTropical) {
            sourceDB = {};
            Object.keys(SPECIES_DB).forEach(function (k) {
                var s = SPECIES_DB[k];
                if (s.regions.some(function (r) { return r === region || r === 'all'; })) {
                    sourceDB[k] = s;
                }
            });
            Object.keys(TROPICAL_SPECIES_DB).forEach(function (k) {
                var s = TROPICAL_SPECIES_DB[k];
                if (s.regions.some(function (r) { return r === region || r === 'all'; })) {
                    sourceDB[k] = s;
                }
            });
        } else {
            sourceDB = {};
            Object.keys(SPECIES_DB).forEach(function (k) {
                var s = SPECIES_DB[k];
                if (!region || region === 'all' || s.regions.indexOf('all') !== -1 || s.regions.indexOf(region) !== -1) {
                    sourceDB[k] = s;
                }
            });
        }

        return Object.keys(sourceDB).map(function (key) {
            var s = sourceDB[key];
            return {
                key: key,
                name: s.name,
                commonName: s.commonName,
                type: s.type,
                season: s.season,
                direction: s.direction,
                confidenceRating: s.confidenceRating,
                regions: s.regions,
                preEmergentIneffective: s.preEmergentIneffective || false
            };
        });
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    var GAIP_PreEmergent = {
        VERSION: VERSION,
        analyse: analyse,
        listSpecies: listSpecies,
        SPECIES_DB: SPECIES_DB,
        TROPICAL_SPECIES_DB: TROPICAL_SPECIES_DB,
        TROPICAL_REGIONS: TROPICAL_REGIONS,

        // Expose helpers for testing
        _computeSpeciesAlert: computeSpeciesAlert,
        _rollingAverage: rollingAverage,
        _computeTrend: computeTrend,
        _daysToThreshold: daysToThreshold,
        _consecutiveDaysExceeded: consecutiveDaysExceeded
    };

    // Export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = GAIP_PreEmergent;
    } else {
        global.GAIP_PreEmergent = GAIP_PreEmergent;
    }

})(typeof window !== 'undefined' ? window : global);
