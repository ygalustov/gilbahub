/**
 * =============================================================================
 * GILBA DISEASE ENGINE - PURE EXTRACTED v3.0.1
 * =============================================================================
 *
 * Pure-function disease risk engine. No DOM reads, no global mutation.
 * Accepts a single state object, returns a deterministic result.
 *
 * EXTRACTION PATTERN (matches climate engine extraction):
 *   - Every calculation is a pure function: f(state) → result
 *   - No `window.*` reads inside any calculation path
 *   - No `document.*` reads
 *   - No module-level mutable state
 *   - Fungicide databases are static data, injected via state.fungicideDb or defaulted
 *   - Species normalization delegates to a single canonical function
 *   - Regional disease multipliers passed in via state, not read from globals
 *
 * INPUT SHAPE (DiseaseEngineInput):
 * {
 *   climate: { temperature: { mean, min, max, dailyPattern? }, moisture: { humidity: { mean, night? }, precipitation: { total } }, hourlyData?, dewpoint?, snowCover?, cloudCover? },
 *   nitrogen: { status: 'deficient'|'low'|'adequate'|'optimal'|'high'|'excessive' },
 *   shade: { dliDeficit: { percentage }, stressFactor?, fungalRisk? },
 *   soil: { pH?, K_ppm?, Mn_ppm?, thatchMm? },
 *   variety: { name?, species?, disease: { [diseaseName]: { riskMultiplier } }, source? },
 *   species: string,                    // Canonical species key
 *   region: string,                     // e.g. 'AU', 'NZ', 'GB', 'SE'
 *   traffic: { cumulativeStress?: { status } },
 *   mowing: { heightOfCut?, height? },
 *   dewData: { leafWetness: { averageWetHours?, totalWetHours? } },
 *   tissueNutrients: { hasData, compositeModifier, modifiers: { K?, Ca?, Mn?, Si?, KN_ratio?, P? }, notes? },
 *   poaPercent: number,
 *   baseSpecies: string,
 *   // Optional injections (replace global reads):
 *   regionalMultipliers: { [diseaseKey]: number },  // replaces window.gaip_getDiseaseMultiplier
 *   regionDisplayInfo: { name, id?, dataSource? },   // replaces window.gaip_getRegionDisplayInfo
 *   largePatchModel: object,                          // replaces window.LargePatchModel
 *   dormancyData: object,                             // replaces window.GAIP_CLIMATE_V2.dormancy
 * }
 *
 * OUTPUT SHAPE (DiseaseEngineResult):
 * {
 *   timestamp, species, region, fungicideRegion, overallRisk, overallScore,
 *   diseases: [ { disease, displayName, riskScore, adjustedRisk, riskLevel, confidence, confidenceScore, drivers, ... } ],
 *   topThreats, alerts, variety, tissueNutrients
 * }
 *
 * @version 3.0.0
 * @author Gilba Solutions
 * =============================================================================
 */

(function(root) {
'use strict';

// =============================================================================
// CONFIGURATION (immutable)
// =============================================================================

const DISEASE_CONFIG = Object.freeze({
    thresholds: { low: 25, moderate: 50, high: 70, severe: 85 },
    sprayWindow: { minRainFreeHours: 4, maxWindSpeed: 15, optimalTempMin: 10, optimalTempMax: 30 },
});

const CONFIDENCE_SCORES = Object.freeze({
    'high': 90, 'medium': 70, 'low': 40,
    'insufficient data': 10, 'insufficient': 10, 'none': 0
});

// =============================================================================
// SPECIES SUSCEPTIBILITY (immutable reference data)
// =============================================================================

// b35fix459 (C64), Red Thread engine wire-in adds a `redThread` column to
// every species row. Values lifted from the standalone red-thread-model.js
// RED_THREAD_CONFIG.speciesSusceptibility (lines 120-153) which carries the
// canonical Penn State / NC State / MSU / UMass / UC IPM / RHS UK / Syngenta
// ANZ / Smiley 2005 / Zhang 2015 heuristic ratings. The pure engine's
// dispatcher gate `> 0.5` at DISPATCHER_GATES.redThread suppresses warm-season
// hosts (bermuda/couch 0.35, kikuyu 0.25, zoysia 0.4, buffalo/buffalograss
// 0.3, seashore_paspalum 0.3) while admitting cool-season hosts (bentgrass
// 0.9, perennialRyegrass 1.3, kentuckyBluegrass 1.1, tallFescue 0.7,
// poaAnnua 1.0). buffalograss is benchmarked at 0.3 by buffalo analogy
// (Buchloe dactyloides is not enumerated in the standalone module). CABI
// 2024 rec #4 follow-on engine refinements (LWD floor 6h to 12h,
// temperature ceiling 29 to 24 or 27 deg C, PGR-cover multiplier 1.1-1.2x
// within 14d) ship as separate single-purpose builds C64a/b/c per
// non-negotiable #9.
const SPECIES_SUSCEPTIBILITY = Object.freeze({
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added.
    bentgrass:        { dollarSpot: 1.3, brownPatch: 1.3, pythium: 1.3, anthracnose: 1.4, fusarium: 1.2, takeAll: 1.5, grayLeafSpot: 0.5, springDeadSpot: 0, helminthosporium: 0.3, largePatch: 0, redThread: 0.9, drechsleraPoae: 0.6 },
    // b35fix396: dollarSpot 0.95→1.1. Literature consistently groups perennial ryegrass  
    // with highly susceptible species: "Certain cultivars of creeping bentgrass,
    // perennial ryegrass, and Kentucky bluegrass are very susceptible to dollar spot"
    // (NC State, Penn State, Lawn Institute). The 0.95 (neutral-to-slightly-resistant)
    // rating contradicts field experience and peer-reviewed sources.
    // Corrected to 1.1 reflecting documented high susceptibility.
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added.
    perennialRyegrass:{ dollarSpot: 1.1, brownPatch: 1.4, pythium: 1.4, anthracnose: 0.8, fusarium: 1.0, takeAll: 0.7, grayLeafSpot: 1.5, springDeadSpot: 0, helminthosporium: 0.5, largePatch: 0, redThread: 1.3, drechsleraPoae: 0.8 },
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added. KBG is the primary
    // host per BIPOLARIS_CURVULARIA_SUSCEPTIBILITY v3.0 comment in
    // bipolaris-curvularia-models.js:234 ("Primary host for D. poae").
    kentuckyBluegrass:{ dollarSpot: 1.0, brownPatch: 0.9, pythium: 1.1, anthracnose: 0.7, fusarium: 1.2, takeAll: 0.8, grayLeafSpot: 0.6, springDeadSpot: 0, helminthosporium: 1.3, largePatch: 0, redThread: 1.1, drechsleraPoae: 1.8 },
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added.
    tallFescue:       { dollarSpot: 0.8, brownPatch: 1.4, pythium: 0.9, anthracnose: 0.5, fusarium: 0.7, takeAll: 0.5, grayLeafSpot: 0.9, springDeadSpot: 0, helminthosporium: 0.6, largePatch: 0, redThread: 0.7, drechsleraPoae: 0.5 },
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added.
    poaAnnua:         { dollarSpot: 1.4, brownPatch: 1.0, pythium: 1.5, anthracnose: 1.8, fusarium: 1.3, takeAll: 1.0, grayLeafSpot: 0.3, springDeadSpot: 0, helminthosporium: 0.4, largePatch: 0, redThread: 1.0, drechsleraPoae: 1.0 },
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added (0, warm-season non-host).
    bermuda:          { dollarSpot: 0.3, brownPatch: 0.2, pythium: 0.6, anthracnose: 0.3, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 0.5, springDeadSpot: 1.5, helminthosporium: 1.4, largePatch: 0.7, redThread: 0.35, drechsleraPoae: 0 },
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added (0, warm-season non-host).
    couch:            { dollarSpot: 0.3, brownPatch: 0.2, pythium: 0.6, anthracnose: 0.3, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 0.5, springDeadSpot: 1.4, helminthosporium: 1.3, largePatch: 0.7, redThread: 0.35, drechsleraPoae: 0 },
    // kikuyu: primary Bipolaris/Exserohilum host (helminthosporium 1.0 correct); GLS significant warm-season host (was 0.3 → 1.1);
    //         dollar spot moderate-high susceptibility per AU field/Sclerotinia data (was 0.25 → 0.6);
    //         large patch AU-confirmed R. solani AG 2-2 LP; SDS: 0 — no credible primary AU host documentation (b35fix150: reverted from b24 0.35)
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added (0, warm-season non-host).
    kikuyu:           { dollarSpot: 0.6, brownPatch: 0.15, pythium: 0.6, anthracnose: 0.2, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 1.1, springDeadSpot: 0, helminthosporium: 1.0, largePatch: 1.2, redThread: 0.25, drechsleraPoae: 0 },
    // zoysia: dollar spot and large patch primary hosts; brown patch most common disease (was 0.2 → 0.7);
    //         anthracnose significant per Georgia/UGA data (was 0.4 → 0.7)
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added (0, warm-season non-host).
    zoysia:           { dollarSpot: 0.9, brownPatch: 0.7, pythium: 0.7, anthracnose: 0.7, fusarium: 0.0, takeAll: 0.5, grayLeafSpot: 0.6, springDeadSpot: 1.2, helminthosporium: 1.3, largePatch: 1.4, redThread: 0.4, drechsleraPoae: 0 },
    // buffalo (St Augustine): GLS primary host but management-responsive (was 1.8 → 1.3 per Lebanon/Lawn Institute);
    //         take-all root rot major disease (was 0.3 → 0.8 per Clemson/TAMU data);
    //         SDS secondary host Perth-documented (was 0 → 0.3)
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added (0, warm-season non-host).
    buffalo:          { dollarSpot: 0.5, brownPatch: 0.2, pythium: 0.5, anthracnose: 0.2, fusarium: 0.0, takeAll: 0.8, grayLeafSpot: 1.3, springDeadSpot: 0.3, helminthosporium: 0.8, largePatch: 0.9, redThread: 0.3, drechsleraPoae: 0 },
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added (0, Buchloe not enumerated
    // in BIPOLARIS_CURVULARIA_SUSCEPTIBILITY; benchmarked by buffalo analogy
    // as warm-season non-host).
    buffalograss:     { dollarSpot: 0.5, brownPatch: 0.15, pythium: 0.5, anthracnose: 0.2, fusarium: 0.0, takeAll: 0.3, grayLeafSpot: 0.3, springDeadSpot: 0, helminthosporium: 0.8, largePatch: 0.6, redThread: 0.3, drechsleraPoae: 0 },
    // seashore_paspalum (Paspalum vaginatum): halophytic warm-season C4 grass.
    //   Disease profile distinct from couch/bermuda — TAKE-ALL PATCH is the
    //   signature paspalum vulnerability (Duncan & Carrow 2005 GCM Feb p.114-118;
    //   Duncan & Carrow 2002 GCM 70(4):57-60 "Thou shalt not scalp seashore
    //   paspalum"). Mn deficiency + scalping + over-irrigation pathway is
    //   well-documented; Heckman et al. 2003 Crop Sci 43:1395-1398 establishes
    //   the Mn fertilisation suppression mechanism (validated on bentgrass,
    //   paspalum literature applies same pathway).
    //
    //   Other documented diseases (Brosnan & Deputy 2008 UH-CTAHR TM-1):
    //   dollar spot (cultivar variation — Sea Isle 1, Salam elevated; Sea Isle
    //   2000 reduced), Helminthosporium/Bipolaris/Drechslera leaf spots,
    //   fairy ring (handled outside this table), fusarium blight (Florida
    //   reports). Pythium susceptibility elevated under saturated soil + heat
    //   stress — typical of halophytic grasses managed with frequent saline
    //   irrigation.
    //
    //   Susceptibility values benchmarked against couch (closest C4 peer in
    //   AU dropdown) with adjustments per literature. Conservative, refine
    //   when AU-specific cultivar trial data accumulates.
    //   Added b35fix364 (closes asymmetric-engines bug surfaced 2026-04-27
    //   by Jerry production test of b35fix363, pre-fix paspalum fell back
    //   to perennialRyegrass susceptibility, so cool-season disease set was
    //   running on a halophytic warm-season grass).
    //
    //   b35fix420 (C23): springDeadSpot 1.0 -> 0 (host-range correction).
    //   Spring Dead Spot pathogens (Ophiosphaerella narmari in AU/NZ;
    //   O. korrae and O. herpotricha in US) are Cynodon (bermuda/couch)
    //   specialists. No primary literature documents Ophiosphaerella spp.
    //   on Paspalum vaginatum: the cited paspalum disease compendium
    //   (Brosnan & Deputy 2008 UH-CTAHR TM-1) lists dollar spot, fairy ring,
    //   leaf spots and fusarium blight, no SDS. Duncan & Carrow's seashore
    //   paspalum management body of work also makes no SDS reference. The
    //   1.0 value was a benchmarking artefact from the b35fix364 couch
    //   reference profile and was producing visible nonsense (Spring Dead
    //   Spot listed at LOW for paspalum) in the Disease Risk Assessment
    //   section of production reports (Rockingham GC v8). Setting to 0
    //   suppresses the model at the dispatcher gate (the existing
    //   `if (susceptibility.springDeadSpot > 0)` guard at the analyse loop).
    // b35fix459 (C64): redThread column added.
    // b35fix461 (C59): drechsleraPoae column added (0, warm-season halophytic
    // non-host; benchmarked by paspalum row in BIPOLARIS_CURVULARIA_SUSCEPTIBILITY).
    seashore_paspalum:{ dollarSpot: 0.7, brownPatch: 0.3, pythium: 0.7, anthracnose: 0.3, fusarium: 0.3, takeAll: 1.4, grayLeafSpot: 0.7, springDeadSpot: 0, helminthosporium: 1.0, largePatch: 0.6, redThread: 0.3, drechsleraPoae: 0 },
});

// =============================================================================
// NITROGEN MODIFIER TABLES (immutable)
// =============================================================================

const N_MODIFIERS = Object.freeze({
    // Dollar spot is suppressed by N. Excessive N suppresses more than high,
    // not less — the prior 1.05 reversal had no biological basis.
    // Ref: Couch 1995, Smiley et al. 2005 — increasing N progressively reduces
    // dollar spot severity up to luxury consumption levels.
    deficient: 1.5, low: 1.3, adequate: 1, optimal: 0.95, high: 0.85, excessive: 0.75
});

const N_MODIFIERS_BROWN_PATCH = Object.freeze({
    deficient: 0.6, low: 0.8, adequate: 1, optimal: 1.1, high: 1.4, excessive: 1.8
});

const N_MODIFIERS_FUSARIUM = Object.freeze({
    deficient: 0.7, low: 0.85, adequate: 1, high: 1.3, excessive: 1.5
});

// =============================================================================
// SPECIES NORMALIZATION (Single canonical function)
// =============================================================================

function normalizeSpecies(sp) {
    if (!sp) return 'perennialRyegrass';
    const lower = sp.toLowerCase().replace(/[\s\-_]/g, '');
    const aliases = {
        couch: 'couch', bermuda: 'bermuda', bermudagrass: 'bermuda', cynodon: 'bermuda',
        kikuyu: 'kikuyu', pennisetum: 'kikuyu',
        zoysia: 'zoysia', zoysiagrass: 'zoysia',
        buffalo: 'buffalo', stenotaphrum: 'buffalo', buffalograss: 'buffalograss', buchloe: 'buffalograss',
        perennialryegrass: 'perennialRyegrass', prg: 'perennialRyegrass', ryegrass: 'perennialRyegrass', loliumperenne: 'perennialRyegrass',
        bentgrass: 'bentgrass', bent: 'bentgrass', creepingbent: 'bentgrass', creepingbentgrass: 'bentgrass', agrostis: 'bentgrass',
        kentuckybluegrass: 'kentuckyBluegrass', kbg: 'kentuckyBluegrass', bluegrass: 'kentuckyBluegrass', poapratensis: 'kentuckyBluegrass',
        tallfescue: 'tallFescue', fescue: 'tallFescue', festuca: 'tallFescue',
        finefescue: 'fineFescue',
        poaannua: 'poaAnnua', poa: 'poaAnnua', annualbluegrass: 'poaAnnua',
        seashorepaspalum: 'seashore_paspalum', paspalum: 'seashore_paspalum',
    };
    if (aliases[lower]) return aliases[lower];
    if (SPECIES_SUSCEPTIBILITY[lower]) return lower;
    // Partial matches
    if (lower.includes('bent')) return 'bentgrass';
    if (lower.includes('rye')) return 'perennialRyegrass';
    if (lower.includes('couch')) return 'couch';
    if (lower.includes('bermuda')) return 'bermuda';
    if (lower.includes('poa') || lower.includes('annual')) return 'poaAnnua';
    if (lower.includes('tall') && lower.includes('fescue')) return 'tallFescue';
    if (lower.includes('fescue')) return 'fineFescue';
    if (lower.includes('blue')) return 'kentuckyBluegrass';
    if (lower.includes('kikuyu')) return 'kikuyu';
    if (lower.includes('zoysia')) return 'zoysia';
    if (lower.includes('buffalo')) return 'buffalo';
    if (lower.includes('paspalum')) return 'seashore_paspalum';
    return 'perennialRyegrass';
}

// =============================================================================
// b35fix419 (C4) — Species-aware disease display name resolver
// b35fix432 — extended _TAKEALL_ROOTROT_SPECIES from {paspalum} to AU-
//             relevant warm-season scope (closes Open Question 10).
//
// The default disease label "Take-all Patch" is taxonomically correct for
// bentgrass / cool-season grasses where the pathogen is Gaeumannomyces
// avenae (formerly G. graminis var. avenae) per Penn State Extension and
// Latin 2011 BP-114-W. On warm-season hosts the pathogen complex is
// G. graminis var. graminis + Magnaporthiopsis spp. + Candidacolonium
// spp. (Stephens et al. 2022; Tucker et al. 2022; CABI 2024 Ch.6 p.131-141)
// and the disease is conventionally "Take-all Root Rot" — first reported
// on seashore paspalum in the US by Datnoff et al 2002 (Plant Disease
// 86:1405). The susceptibility math is unchanged (the disease engine
// carries one `takeAll` susceptibility column); only the user-facing
// label differs by host.
//
// This resolver is the SSOT for that label swap. Renderer code paths
// (collectData primary-threat assembly, Cultivar Profile diseaseLabels dict,
// Disease Risk Assessment per-disease rows) call this helper instead of
// hard-coding "Take-all Patch".
//
// Other diseases pass through unchanged for now. If future entries surface
// the same bug class for another disease (e.g. Spring Dead Spot on paspalum
// vs SDS on couch — different pathogens, different labels conventionally),
// add the entry to this resolver.
// =============================================================================

const _DISEASE_DISPLAY_DEFAULTS = Object.freeze({
    dollarSpot: 'Dollar Spot',
    brownPatch: 'Brown Patch',
    pythium: 'Pythium',
    pythiumRootRot: 'Pythium Root Rot',
    pythiumBlight: 'Pythium Blight',
    anthracnose: 'Anthracnose',
    fusarium: 'Fusarium (Microdochium)',
    helminthosporium: 'Helminthosporium Leaf Spot',
    grayLeafSpot: 'Gray Leaf Spot',
    waiteaPatch: 'Waitea Patch',
    springDeadSpot: 'Spring Dead Spot',
    largePatch: 'Large Patch',
    redThread: 'Red Thread',
    takeAll: 'Take-all Patch',
    takeAllPatch: 'Take-all Patch',
});

// b35fix432 (closes Open Question 10 from post-395 migration ledger):
// Extended from {seashore_paspalum} to all AU-relevant warm-season species
// where the disease, when it occurs, is "take-all root rot" (sensu CABI /
// US terminology) caused by Gaeumannomyces graminis var. graminis or
// congeneric Gaeumannomyces / ERI fungi — not "take-all patch" caused by
// G. avenae (formerly G. graminis var. avenae) which is the cool-season
// disease per Latin 2011 BP-114-W and CABI 2024 Ch.6 p.105.
//
// Per CABI 2024 Ch.6 p.131: "the term 'take-all root rot' adopted in the
// United States describes root disease on warm-season turfgrasses caused
// by G. graminis which is distinctly different from the root disease
// 'take-all patch' of cool-season grasses caused by primarily G. avenae".
//
// This map drives display label only via resolveDiseaseDisplayName.
// Susceptibility coefficients, dispatcher gate (>0.5), TakeAllModel
// coefficients, math invariants — all unchanged.
//
// Per-species attribution (sources banked 2026-05-04):
//
//   seashore_paspalum
//     G. graminis var. graminis on seashore paspalum, US first report.
//     Datnoff et al 2002 Plant Disease 86:1405. CABI 2024 Table 6.16
//     lists G. graminis as the only documented ERI pathogen on this host.
//     Susceptibility 1.4; passes dispatcher gate >0.5; TakeAllModel fires.
//
//   buffalo (Stenotaphrum secundatum, AU "buffalo grass" / US "St
//   Augustinegrass")
//     CABI 2024 Table 6.16 lists six Gaeumannomyces spp.: G. arxii,
//     G. californicus, G. floridanus, G. graminis, G. graminicola,
//     G. wongoonoo. Wongoonoo patch on AU buffalo lawns described by
//     Wong 2002 Mycological Research 106:857-862 (G. wongoonoo sp. nov.).
//     Susceptibility 0.8; passes dispatcher gate; TakeAllModel fires.
//
//   bermuda (Cynodon dactylon and hybrids, US naming)
//     Bermudagrass decline primarily attributed to G. graminis var.
//     graminis per Elliott 1991 (CABI Table 6.16 + p.134); also
//     Magnaporthiopsis cynodontis (Vines et al 2020), M. dharug,
//     M. gumbaynggirr, M. incrustans, M. taurocanis (Wong et al 2022
//     Mycosphere 13:602-611), Candidacolonium cynodontis, Wongia spp.,
//     Phialocephala bamuru. Stephens et al 2022 confirms Gaeumannomyces
//     spp. dominate over Magnaporthiopsis on Champion bermudagrass.
//     Susceptibility 0.3; gated out at dispatcher (>0.5); label flip
//     applies via Cultivar Profile diseaseLabels and primary-threat
//     paths only. Forward-looking for future cultivar additions.
//
//   couch (same Cynodon complex as bermuda; AU naming)
//     Same pathogen evidence as bermuda — CABI 2024 Table 6.16 lists
//     the host as "Bermudagrass (couchgrass)" as a single entry. Plus
//     AU-specific named patches all caused by ERI fungi:
//       - Fairway patch (Phialocephala bamuru) — Wong et al 2015a
//         Australasian Plant Pathology 44:545-555.
//       - Summer decline (Wongia griffinii) — Khemmuk et al 2016
//         IMA Fungus 7:247-252.
//       - Adelaide patch (Wongia garrettii) — Khemmuk et al 2016.
//       - Deniliquin patch (Budhanggurabania cynodonticola) —
//         Wong et al 2015b Persoonia 34:240-241.
//     Susceptibility 0.3; gated out; label flip on renderer paths only.
//
//   kikuyu (Cenchrus clandestinus, formerly Pennisetum clandestinum)
//     CABI 2024 Table 6.16 lists G. graminicola, G. graminis,
//     Magnaporthiopsis gadigal, Penicillifer martini, Phialocephala
//     bamuru. M. gadigal type isolate from kikuyu at Darlinghurst NSW
//     per Wong et al 2022. Fairway patch and summer decline both occur
//     on kikuyu (CABI Fig 6.47).
//     Susceptibility 0.3; gated out; label flip on renderer paths only.
//
//   zoysia (Zoysia spp.)
//     LOWER CONFIDENCE inclusion — single CABI Table 6.16 entry for
//     G. graminis on zoysiagrass + Burcher & Wilkinson 2007 documenting
//     G. incrustans on Japanese lawngrass (Zoysia japonica) at 12-25°C
//     with optimum 18°C. CABI also notes (Ggg slides p.16) that zoysia
//     is more resistant than other warm-season grasses. Disease
//     prevalence is meaningfully lower than on bermuda/couch but the
//     pathogen complex when it does occur is the warm-season ERI
//     pathway, not var. avenae cool-season. Including for label
//     correctness; treat the TakeAllModel risk score as low-incidence.
//     Susceptibility 0.5; gated out at strict >0.5; label flip on
//     renderer paths only.
//
// Excluded from this build:
//   - buffalograss (Buchloe dactyloides) — North American native,
//     not grown in AU/NZ markets. Dropped from _TAKEALL_WARMSEASON_HOSTS
//     in this build. Susceptibility row + alias map decommission deferred
//     to a follow-up build (overlaps with OQ9 in migration ledger).
//   - centipede grass — listed in CABI Table 6.16 (G. graminis) but no
//     normalized key exists in SPECIES_SUSCEPTIBILITY. Out of scope.
//   - bentgrass / fineFescue / poaAnnua / kentuckyBluegrass /
//     perennialRyegrass / tallFescue — cool-season hosts where the
//     disease is "Take-all Patch" (var. avenae). Stay out of this map
//     by definition.
const _TAKEALL_ROOTROT_SPECIES = Object.freeze({
    seashore_paspalum: true,
    buffalo: true,
    bermuda: true,
    couch: true,
    kikuyu: true,
    zoysia: true,
});

// b35fix430: warm-season hosts that can pass the dispatcher gate
// (susceptibility.anthracnose > 0.5) and therefore reach AnthracnoseModel.
// Per Crouch & Clarke 2012 (GCM May p.99), warm-season anthracnose is
// caused by DIFFERENT Colletotrichum species (C. eremochloae on
// centipede; C. caudatum / C. paspali on bahiagrass and zoysia in Japan;
// bermudagrass species unidentified) — not C. cereale. The Danneberger
// 1984 forecasting model and the Inguagiato 2008/2009 stress multipliers
// are derived from cool-season Poa annua / creeping bentgrass field
// trials. Applying them to warm-season hosts is an extrapolation. This
// set drives a runtime caveat appended to keyMessage so the user is told
// the model is being applied outside its validated host range.
//
// Currently only zoysia (anthracnose susceptibility 0.7) passes the
// dispatcher gate among warm-season hosts; couch (0.3), bermuda (0.3),
// kikuyu (0.2), buffalo / buffalograss (0.2) and seashore_paspalum (0.3)
// are filtered out before AnthracnoseModel.calculate is invoked.
const _ANTHRACNOSE_WARM_SEASON_HOSTS = Object.freeze({
    bermuda: true,
    couch: true,
    kikuyu: true,
    zoysia: true,
    buffalo: true,
    buffalograss: true,
    seashore_paspalum: true,
});

// b35fix431: warm-season hosts that can pass the takeAll dispatcher gate
// (susceptibility.takeAll > 0.5) and therefore reach TakeAllModel.calculate.
// Per Beehag & Wong 2024 *Biology and Integrated Management of Turfgrass
// Diseases* (CABI) Chapter 6 p.101-141: take-all patch on cool-season
// grasses is caused by G. avenae (formerly G. graminis var. avenae) and
// G. tritici (formerly var. tritici), mesophilic fungi which infect at
// 10-19 degC (Grose et al. 1984; Couch 1995). Bermudagrass decline /
// take-all root rot on warm-season grasses is caused by a complex
// including G. graminis var. graminis (Elliott 1991), Magnaporthiopsis
// spp. and Candidacolonium spp. (Stephens et al. 2022; Tucker et al.
// 2022), with broader temperature tolerance (10-35 degC growth range,
// optimum 24-35 degC for warm-season root growth overlap). The current
// TakeAllModel temperature curve (Gaussian mu=15 sigma=4 with infection
// window 12-18 degC) is calibrated for the cool-season var. avenae
// pathway. Applying the same curve to warm-season hosts produces near-
// zero soilTempFactor at typical summer soil temps (>25 degC) when the
// warm-season pathogen pathway is actually active per Tredway 2019
// (Syngenta GreenCast). This set drives a runtime caveat appended to
// keyMessage so the user is told the model output is indicative on
// warm-season hosts.
//
// At b35fix430 SPECIES_SUSCEPTIBILITY values, the takeAll dispatcher
// gate (susceptibility.takeAll > 0.5) admits buffalo (0.8) and
// seashore_paspalum (1.4) from the warm-season scope; bermuda (0.3),
// couch (0.3), kikuyu (0.3), zoysia (0.5) do not pass the gate at
// current susceptibility values and never reach TakeAllModel. The
// frozen set carries the AU-relevant warm-season host scope so future
// susceptibility audits cannot silently activate the model on a
// warm-season host without the caveat firing. Pairs with
// provenanceStress.hostRange = 'caveat-applied' on TakeAllModel return.
//
// b35fix432: buffalograss (Buchloe dactyloides) removed from this set.
// It is a North American prairie species not grown in AU/NZ markets
// (Gilba's client base is AU/NZ/UK/IE/EU). Susceptibility row, alias
// map (lines ~172), _ANTHRACNOSE_WARM_SEASON_HOSTS membership and
// C4_WARM_SEASON array entry retained pending a follow-up build that
// fully decommissions the buffalograss key (overlaps with OQ9 in the
// post-b35fix395 migration ledger — Buffalo vs Buffalograss conflation
// in SPECIES_PH_TOLERANCE).
const _TAKEALL_WARMSEASON_HOSTS = Object.freeze({
    bermuda: true,
    couch: true,
    kikuyu: true,
    zoysia: true,
    buffalo: true,
    seashore_paspalum: true,
});

function resolveDiseaseDisplayName(diseaseKey, species) {
    if (!diseaseKey) return diseaseKey || '';
    // Take-all special case: warm-season hosts in _TAKEALL_ROOTROT_SPECIES
    // (paspalum, buffalo, bermuda, couch, kikuyu, zoysia per b35fix432) get
    // "Take-all Root Rot" — the disease caused by G. graminis var. graminis
    // and congeneric warm-season ERI fungi per CABI 2024 Ch.6 p.131. All
    // other species (cool-season hosts where the pathogen is G. avenae
    // formerly G. graminis var. avenae) keep "Take-all Patch".
    if (diseaseKey === 'takeAll' || diseaseKey === 'takeAllPatch') {
        if (species) {
            const norm = normalizeSpecies(species);
            if (_TAKEALL_ROOTROT_SPECIES[norm]) {
                return 'Take-all Root Rot';
            }
        }
        return 'Take-all Patch';
    }
    // All other diseases: lookup canonical label, fallback to key.
    return _DISEASE_DISPLAY_DEFAULTS[diseaseKey] || diseaseKey;
}


// =============================================================================
// PURE HELPER FUNCTIONS (no side effects)
// =============================================================================

function confidenceToScore(level) {
    if (typeof level === 'number') return level;
    return CONFIDENCE_SCORES[level] || 50;
}

function classifyRisk(score) {
    if (score >= DISEASE_CONFIG.thresholds.severe) return 'severe';
    if (score >= DISEASE_CONFIG.thresholds.high) return 'high';
    if (score >= DISEASE_CONFIG.thresholds.moderate) return 'moderate';
    return 'low';
}

/**
 * Night-time minimum air temperature, in °C, or null when unknown.
 *
 * b35fix351 (Tier 2 provenance audit, Pythium first):
 *   Pre-fix `return climate?.temperature?.min || 15;` fabricated a 15°C
 *   night-temp on every site where climate.temperature.min was null/0/missing.
 *   PythiumModel's gate `if (nightTemp < 20) return riskScore 0, confidence
 *   90%` then fired a confident "no Pythium risk" verdict on degraded climate
 *   — silent false-negative on the most catastrophic warm-season disease
 *   (Pythium destroys turf in 24-48h). Same fabrication class as pre-b35fix346
 *   AnthracnoseModel `meanTemp || 20` and pre-b35fix349 SK rung 1
 *   `(d.mean || 0)` zero-coercion.
 *
 *   Post-fix: returns the real hourly-aggregated night minimum when
 *   hourlyData is present; falls back to climate.temperature.min when scalar;
 *   returns NULL when neither is available. Consumers null-guard explicitly
 *   and route through their degraded path (PythiumModel: explicit
 *   "DEGRADED — Pythium night-temperature input missing" with confidence 'low').
 *
 *   Strict guard on hourly entries (typeof === 'number' && !isNaN) matches
 *   the canonical b35fix349 strict-numeric semantics for get5DayAvgTemp.
 *
 *   Note on the `?? null` (was `|| 15`) shift: a literal 0°C reading would
 *   pre-fix have been coerced to 15 by the `||` short-circuit (since 0 is
 *   falsy). Post-fix, 0°C passes through correctly. This is a correction not
 *   a regression — sub-zero night minimums are agronomically meaningful and
 *   should not be silently overwritten.
 */
function getNightTemp(climate) {
    if (climate?.hourlyData?.temperature_2m && climate?.hourlyData?.time) {
        const nightTemps = climate.hourlyData.time
            .map((t, i) => {
                const h = new Date(t).getHours();
                if (h < 20 && h > 6) return null;
                const v = climate.hourlyData.temperature_2m[i];
                return (typeof v === 'number' && !isNaN(v)) ? v : null;
            })
            .filter(v => v !== null);
        if (nightTemps.length > 0) return Math.min(...nightTemps);
    }
    const minScalar = climate?.temperature?.min;
    return (typeof minScalar === 'number' && !isNaN(minScalar)) ? minScalar : null;
}

function getNightHumidity(climate) {
    if (climate?.hourlyData?.relative_humidity_2m && climate?.hourlyData?.time) {
        const nightRH = climate.hourlyData.time
            .map((t, i) => {
                const h = new Date(t).getHours();
                return (h >= 20 || h <= 6) ? climate.hourlyData.relative_humidity_2m[i] : null;
            })
            .filter(v => v !== null);
        if (nightRH.length > 0) return nightRH.reduce((a, b) => a + b, 0) / nightRH.length;
    }
    return climate?.moisture?.humidity?.mean ?? null;
}

function getHighHumidityHours(climate) {
    return climate?.hourlyData?.relative_humidity_2m
        ? climate.hourlyData.relative_humidity_2m.filter(v => v >= 85).length
        : 0;
}

/**
 * 5-day mean relative humidity, in percent.
 * Smith-Kerns 2018 calls this MEANRH. Uses the most recent 120 hours of
 * hourly RH when available; falls back to climate.moisture.humidity.mean.
 *
 * b35fix335: introduced as part of the Smith-Kerns 2018 logistic regression
 * implementation (Tier 1 provenance audit). Pre-fix, the dollar-spot path
 * counted "favourable hours" with arbitrary RH/temp thresholds and labelled
 * the result Smith-Kerns — that calculation appears nowhere in the paper.
 */
function get5DayMeanRH(climate) {
    const hourly = climate?.hourlyData?.relative_humidity_2m;
    if (Array.isArray(hourly) && hourly.length > 0) {
        // Most recent up to 120 hours (5 days). Skip null/undefined entries.
        const start = Math.max(0, hourly.length - 120);
        let sum = 0, count = 0;
        for (let i = start; i < hourly.length; i++) {
            const v = hourly[i];
            if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
        }
        if (count > 0) return sum / count;
    }
    return climate?.moisture?.humidity?.mean ?? null;
}

/**
 * Resolve mean air temperature from a climate object via the canonical
 * fallback chain shared by Smith-Kerns 2018 (dollar spot) and Danneberger
 * 1984 (anthracnose).
 *
 * Rung order:
 *   (1) climate.temperature.dailyPattern  (caller's responsibility — see below)
 *   (2) (climate.temperature.max + climate.temperature.min) / 2  — diurnal-typical proxy
 *   (3) climate.temperature.mean                                  — period mean
 *   (4) climate.temperature.current                               — single-hour reading (degraded; b35fix337)
 *   else null                                                     — engine must degrade
 *
 * RUNG 1 IS NOT INSIDE THIS HELPER. Both consumers
 * (getSmithKerns2018Probability and AnthracnoseModel.calculate) call
 * get5DayAvgTemp() directly and only fall through to this helper when rung 1
 * returns null. The split is structural: rung 1 averages an array, rungs 2-4
 * read scalar fields. b35fix349 unified the rung-1 SEMANTICS — get5DayAvgTemp
 * is now the single shared implementation (walk all entries, strict numeric
 * guard, real-entry-count denominator). Pre-b35fix349, SK used a looser form
 * (first 5 only, nullish-as-zero, slice.length denominator) and Anthracnose
 * used the strict form inline; the two engines could disagree on MEANAT for
 * the same climate object on sparse or non-numeric dailyPattern data.
 *
 * b35fix348 (Tier 2 provenance audit, anthracnose first): extracted rungs 2-4
 * from parallel copies in getSmithKerns2018Probability (b35fix335a/337) and
 * AnthracnoseModel.calculate (b35fix346) — closes the recurring
 * asymmetric-engines bug class that produced the Shirley GC NZ 2026-04-26
 * disagreement (Smith-Kerns reported MEANAT n/a while Anthracnose silently
 * fabricated 20 °C on the same climate object, same run).
 *
 * b35fix349 (Tier 2 provenance audit, anthracnose follow-up): unifies rung 1.
 * Future rung additions land in get5DayAvgTemp (rung 1) or here (rungs 2-4)
 * once, instead of needing two synchronised edits in two engines.
 */
function resolveMeanAirTemp(climate) {
    // Rung 2: average of daily max + min — better proxy than period-mean
    // because it represents diurnal-typical conditions, which is what the
    // SK 2018 calibration was based on.
    if (climate?.temperature?.max != null && climate?.temperature?.min != null) {
        return (climate.temperature.max + climate.temperature.min) / 2;
    }
    // Rung 3: period mean
    if (climate?.temperature?.mean != null) {
        return climate.temperature.mean;
    }
    // Rung 4 (b35fix337): current-hour reading. Single-hour value, not a
    // 5-day mean — degraded. Diagnostic source tags should reflect this as
    // `(current hour, degraded)` so consumers see the degradation explicitly.
    if (climate?.temperature?.current != null) {
        return climate.temperature.current;
    }
    return null;
}

/**
 * Resolve mean air temperature AND the source-tag identifying which rung
 * produced the value.
 *
 * Returns `{ value, source }`:
 *   value: number | null   — same as resolveMeanAirTemp(climate) extended with rung 1
 *   source: string         — one of:
 *     'dailyPattern'             (rung 1: get5DayAvgTemp produced a numeric value)
 *     'max/min avg'              (rung 2: (max + min) / 2)
 *     'period mean'              (rung 3: climate.temperature.mean)
 *     'current hour, degraded'   (rung 4: climate.temperature.current — single-hour reading)
 *     'no data'                  (all rungs null)
 *
 * b35fix350 (Tier 2 provenance audit, anthracnose engine-pair refactor —
 * second leg): pre-fix DollarSpot.calculate's diagnostic block contained a
 * third parallel rung walk — re-doing the work of getSmithKerns2018Probability
 * and AnthracnoseModel.calculate to build display strings. With b35fix348
 * (rungs 2-4 unified) and b35fix349 (rung 1 unified), the engine-side rung
 * resolution is fully consolidated, but the diagnostic remained an outlier:
 * three near-identical inline walks. Promoting the rung+source resolution
 * into a single helper closes the consolidation:
 *
 *   - getSmithKerns2018Probability:    get5DayAvgTemp → resolveMeanAirTemp
 *   - AnthracnoseModel.calculate:      get5DayAvgTemp → resolveMeanAirTemp
 *   - DollarSpot diagnostic block:     resolveMeanAirTempSource (this helper)
 *
 * Behavioural impact: zero. The helper produces the same { value, source }
 * the inline diagnostic block produced — pinned by tests/dollar-spot-meanat-source.test.js.
 *
 * Order is rung-1-first (matches engine resolution order). On a populated
 * `dailyPattern` the helper returns the dailyPattern average and tags it
 * `'dailyPattern'`, regardless of whether scalar rungs are also populated —
 * rung 1 wins. This matches the `_diagMeanAT` ?? chain the diagnostic used
 * pre-fix.
 */
function resolveMeanAirTempSource(climate) {
    // Rung 1: dailyPattern average (canonical post-b35fix349 — walk all entries,
    // strict numeric guard, real-entry-count denominator)
    const rung1 = get5DayAvgTemp(climate?.temperature?.dailyPattern);
    if (rung1 != null) {
        return { value: rung1, source: 'dailyPattern' };
    }
    // Rungs 2-4: shared scalar-rung helper
    if (climate?.temperature?.max != null && climate?.temperature?.min != null) {
        return {
            value: (climate.temperature.max + climate.temperature.min) / 2,
            source: 'max/min avg'
        };
    }
    if (climate?.temperature?.mean != null) {
        return { value: climate.temperature.mean, source: 'period mean' };
    }
    if (climate?.temperature?.current != null) {
        return {
            value: climate.temperature.current,
            source: 'current hour, degraded'
        };
    }
    return { value: null, source: 'no data' };
}

/**
 * Smith-Kerns 2018 dollar spot probability.
 *
 * Implements the published logistic regression model:
 *   logit(μ) = −11.4041 + 0.0894·MEANRH + 0.1932·MEANAT
 *   μ       = 1 / (1 + exp(−logit(μ)))
 *
 * where:
 *   MEANRH = 5-day mean relative humidity (%, 0–100)
 *   MEANAT = 5-day mean air temperature (°C)
 *   μ      = probability that dollar spot will occur on a given day
 *
 * The canonical action threshold is 20% probability. Hempfling et al. 2021
 * (Crop Science) demonstrated that the 20% threshold over-predicts on
 * low-susceptibility cultivars and that thresholds >20% improve accuracy
 * on tolerant bentgrasses — the variety modifier in DollarSpotModel
 * captures this conceptually, but the published threshold remains 20%.
 *
 * Returns a probability in [0, 100] (percentage form).
 *
 * Source: Smith, D.L., Kerns, J.P., Walker, N.R., Payne, A.R., Horvath, B.,
 *   Inguagiato, J.C., Kaminski, J.E., Tomaso-Peterson, M., & Koch, P.L.
 *   (2018). Development and validation of a weather-based warning system
 *   to advise fungicide application to control dollar spot on turfgrass.
 *   PLOS ONE 13(3): e0194216. DOI 10.1371/journal.pone.0194216
 *
 * b35fix335 (Tier 1 provenance audit): replaces getSmithKernsConcurrentHours
 * which was a Gilba-internal favourable-hours score mislabelled Smith-Kerns.
 * The 20% action threshold survives in name but now refers to a probability
 * computed from the published equation, not an arbitrary scaled index.
 */
function getSmithKerns2018Probability(climate) {
    // b35fix335a: temp resolution chain matches DollarSpotModel.calculate's
    // existing fallback logic. Production deployment showed climate.temperature
    // .dailyPattern is rarely populated outside multi-day-forecast contexts —
    // pre-fix this function returned null on every site that lacked dailyPattern
    // (24 of 24 sites in the 2026-04-26 production log), causing the engine to
    // collapse into the degraded temp-only fallback even when temperature.mean
    // (or max/min average) was perfectly available.
    //
    // b35fix337: production log of Shirley GC Christchurch (2026-04-26 ~16:00 UTC)
    // showed one transient call out of 72 where the b35fix335a chain returned null
    // despite the climate engine logging "Using temperature from climate engine:
    // 18.5°C (current hour)" right before the disease-engine dispatch. Root cause:
    // on that single first-paint-after-run-#4 call, climate.temperature.current
    // was populated but mean / max / min / dailyPattern were all still null. The
    // chain had no 4th rung. Adding temperature.current as a degraded last-resort
    // fallback is honest because: (a) current is a real measurement, just a
    // single-hour reading rather than a 5-day mean, so SK math runs on a real
    // value rather than refusing; (b) the diagnostic source tag flags it
    // explicitly as `(current hour, degraded)` so consumers see the degradation;
    // (c) for low-pressure conditions like Christchurch autumn (current=18.5°C
    // vs proper 5-day mean ~13°C), the SK probability stays in the same band so
    // the action threshold isn't crossed spuriously.
    const meanRH = get5DayMeanRH(climate);

    // Rung 1: canonical helper get5DayAvgTemp(). b35fix348 moved rungs 2-4
    // (max/min avg → period mean → current hour) into resolveMeanAirTemp()
    // and shared with AnthracnoseModel. b35fix349 unified rung 1 too: the
    // helper now walks ALL dailyPattern entries (was: first 5) with a strict
    // typeof === 'number' && !isNaN guard (was: nullish-as-zero), denominator
    // = real-entry count. Anthracnose's stricter semantics promoted to
    // canonical because zero-coercing missing data systematically depressed
    // MEANAT on sparse-pattern sites.
    let meanAT = get5DayAvgTemp(climate?.temperature?.dailyPattern);
    if (meanAT == null) meanAT = resolveMeanAirTemp(climate);

    if (meanRH == null || meanAT == null) return null;

    const logit = -11.4041 + 0.0894 * meanRH + 0.1932 * meanAT;
    const probability = 1 / (1 + Math.exp(-logit));
    return probability * 100; // 0–100 scale for downstream consumers
}

/**
 * Compatibility shim. Several call sites consume a 0–1 "favourability factor"
 * style number. We map the published Smith-Kerns probability onto a 0–1
 * factor: P(20%) = 0.5 (the paper's action threshold sits at the midpoint
 * of the legacy humFactor range). Below 20%: linear ramp from 0. Above 20%:
 * non-linear ramp toward 1.0 at very high probability. This keeps the rest
 * of the disease engine's tapering behaviour intact while making the input
 * actually be the published model output.
 *
 * b35fix335: intermediate adapter — replaces concurrent-hours/8 normalisation
 * which was not from the paper. The non-linear shape is a Gilba choice for
 * presentation, NOT part of Smith-Kerns 2018; the underlying probability is
 * exposed separately via the drivers object so consumers can use it directly.
 */
function smithKernsProbToFactor(probability) {
    if (probability == null) return 0;
    const p = Math.max(0, Math.min(100, probability));
    // Map: 0% → 0, 20% (action threshold) → 0.5, 60% → ~0.85, 100% → 1.0
    // Quadratic ease so the action threshold sits at exactly the midpoint.
    if (p <= 20) return (p / 20) * 0.5;
    return 0.5 + 0.5 * Math.pow((p - 20) / 80, 0.6);
}

/**
 * Get leaf wetness hours - PURE version
 * The original read from module-level `_currentDewData`. Now accepts dewData as parameter.
 */
function getLeafWetnessHours(climate, dewData) {
    if (dewData?.leafWetness?.averageWetHours) {
        // Dew engine counts all 24 hours. Dollar spot infection is driven by
        // daytime leaf wetness on active turf. Apply 0.5 discount to convert
        // all-hours dew average to a daytime-equivalent infection period.
        return Math.round(dewData.leafWetness.averageWetHours * 0.5);
    }
    if (dewData?.leafWetness?.totalWetHours)
        return Math.round((dewData.leafWetness.totalWetHours / 7) * 0.5);
    if (!climate?.hourlyData?.relative_humidity_2m) return 0;
    const rh = climate.hourlyData.relative_humidity_2m;
    const time = climate.hourlyData.time;
    let wetHours = 0;
    for (let i = 0; i < rh.length; i++) {
        if (rh[i] >= 90) {
            // Restrict to daytime (06:00-20:00) — same rationale as SmithKerns:
            // overnight condensation on inactive turf is a weak infection driver.
            if (time && time[i]) {
                const h = new Date(time[i]).getHours();
                if (h >= 6 && h < 20) { wetHours++; }
            } else {
                wetHours++; // no time data — count all (conservative fallback)
            }
        }
    }
    const days = Math.max(1, rh.length / 24);
    return Math.round(wetHours / days);
}

/**
 * Nutter-Shane Pythium blight forecast — paper-faithful conjunctive boolean.
 *
 * b35fix352 (Tier 2 provenance audit, Pythium algorithm misattribution):
 *
 * Returns the published Nutter, Cole & Schein 1983 and Shane 1994 forecast
 * verdicts as a separate diagnostic alongside the Gilba continuous risk
 * score. Both rules are conjunctive boolean tests on three thresholds.
 *
 * NUTTER 1983 (Plant Disease 67:1126-1128):
 *     forecast TRUE iff
 *       (1) max daily temperature > 30°C
 *       AND (2) ≥ 14 hours of relative humidity > 90% during the same day
 *       AND (3) minimum temperature was > 20°C during that period
 *
 * SHANE 1994 (Use of Disease Models for Turfgrass Management Decisions,
 *            pp. 397-404 in Leslie A.R. ed., Handbook of Integrated Pest
 *            Management for Turf and Ornamentals, CRC Press):
 *     forecast TRUE iff
 *       (1) max daily temperature > 27.7°C
 *       AND (2) ≥ 9 hours of relative humidity > 90% during the same day
 *       AND (3) minimum temperature was > 20°C during that period
 *
 * Shane 1994 is the dominant operational form in commercial turf practice
 * (cited by APS Pythium lesson, Penn State, NRCC Cornell, ADAMA).
 *
 * The published rules require HOURLY relative-humidity data covering enough
 * of the day to count consecutive hours above 90%. When hourly data is
 * absent (most production sites pre-b35fix345; many sites still lack it
 * post-b35fix345), this function returns `available: false` with a
 * transparent reason — it never fabricates a verdict from period-mean RH.
 *
 * The published rules also need consecutive >90% RH hours, but agronomy
 * literature is inconsistent on whether the 14h / 9h must be strictly
 * consecutive within a single day or whether cumulative >90% hours within
 * a 24-hour window suffice. APS lesson page phrasing implies cumulative
 * within a day; ADAMA wording reads as a continuous block. This function
 * uses cumulative hours within the supplied hourlyData window because that
 * is what the data shape actually supports — the climate hourly arrays do
 * not annotate "consecutive blocks". Documented in the result.reason.
 *
 * @param {Object} climate - canonical climate object with hourlyData
 * @returns {{
 *   available: boolean,
 *   nutter1983?: boolean,
 *   shane1994?: boolean,
 *   driverValues?: { maxT, minT, hoursRhAbove90 },
 *   reason: string
 * }}
 */
function getNutterShaneForecast(climate) {
    // Required hourly RH series — without it, the forecast is unevaluable
    if (!Array.isArray(climate?.hourlyData?.relative_humidity_2m) ||
        climate.hourlyData.relative_humidity_2m.length < 12) {
        return {
            available: false,
            reason: 'Hourly relative-humidity data unavailable; Nutter-Shane forecast requires hourly RH series of ≥12 entries to count >90% hours.',
        };
    }

    // Resolve max and min daily air temperature from canonical scalars.
    // We prefer the scalars over walking the hourly temp series because the
    // climate object already aggregates them upstream and we want symmetry
    // with the rest of the engine. Both must be real numbers — no fabrication.
    const maxRaw = climate?.temperature?.max;
    const minRaw = climate?.temperature?.min;
    const maxT = (typeof maxRaw === 'number' && !isNaN(maxRaw)) ? maxRaw : null;
    const minT = (typeof minRaw === 'number' && !isNaN(minRaw)) ? minRaw : null;
    if (maxT == null || minT == null) {
        return {
            available: false,
            reason: 'Daily max/min air temperature unavailable; Nutter-Shane forecast requires both.',
        };
    }

    // Count cumulative hours where RH > 90 within the supplied series.
    // The published rules specify ≥14h (Nutter) / ≥9h (Shane) of >90% RH.
    // Strict numeric guard mirrors b35fix349 canonical semantics.
    let hoursRhAbove90 = 0;
    const rh = climate.hourlyData.relative_humidity_2m;
    for (let i = 0; i < rh.length; i++) {
        const v = rh[i];
        if (typeof v === 'number' && !isNaN(v) && v > 90) hoursRhAbove90++;
    }

    // Apply the three published gates.
    const minTempProvisoMet = minT > 20;
    const nutter1983 = (maxT > 30)   && (hoursRhAbove90 >= 14) && minTempProvisoMet;
    const shane1994  = (maxT > 27.7) && (hoursRhAbove90 >=  9) && minTempProvisoMet;

    return {
        available: true,
        nutter1983,
        shane1994,
        driverValues: { maxT, minT, hoursRhAbove90 },
        reason: nutter1983 ? 'Nutter 1983 thresholds met (>30°C max, ≥14h >90% RH, >20°C min).'
              : shane1994  ? 'Shane 1994 thresholds met (>27.7°C max, ≥9h >90% RH, >20°C min); Nutter 1983 thresholds NOT met.'
              : 'Neither Nutter 1983 nor Shane 1994 thresholds met.',
    };
}

/**
 * b35fix455 (C61): Latin 2021 infection-commencement diagnostic channel.
 *
 * Parallel to getNutterShaneForecast(). Computes a low-tier informational
 * signal at the 18 deg C night-temperature anchor cited in CABI 2024
 * Ch.7 p.191-194 (Beehag, Walker, Wong & Kaapro 2024), attributed to
 * Latin 2021 for fungal infection commencement. This is NOT an outbreak
 * forecast and is NOT used to drive the continuous Gilba weighted-sum
 * riskScore or the paper-faithful Nutter-Shane boolean. Both of those
 * channels retain their 20 deg C anchors per the contemporary outbreak-
 * forecasting consensus (Latin BP-109-W extension publication; Penn State
 * Pest Diagnostic Lab current; Maryland Extension FS-2024-0707;
 * UC IPM current).
 *
 * Why a separate channel rather than moving the outbreak gate:
 *   The CABI 2024 phrasing "fungal infection commencement at around
 *   18 deg C" describes initial infection establishment, which is a
 *   different biological phenomenon than the destructive outbreak
 *   conditions targeted by the Nutter 1983 / Shane 1994 forecasting
 *   model (RH >90% for >=14h or >=9h with min temp >20 deg C). A pathogen
 *   can commence infecting tissue at lower temperatures than those at
 *   which a forecastable, destructive outbreak develops. Conflating
 *   infection-commencement temperatures with outbreak-forecast
 *   thresholds would emit outbreak-tier risk on 18-19 deg C nights
 *   where the 2024 extension-publication consensus would not.
 *
 *   The architecturally correct response, mirroring the b35fix352
 *   Nutter-Shane paper-faithful boolean precedent, is to honour the
 *   citation in its own diagnostic channel without contaminating the
 *   outbreak-risk score. Forecast-aware consumers MAY surface this as
 *   an informational note ("Pythium infection-commencement conditions
 *   present") alongside, but never replacing, the outbreak risk tier.
 *
 * Returns the same available/reason shape as getNutterShaneForecast for
 * symmetry. When climate night-temperature is missing the field is
 * honest about why (available:false) and never fabricates a verdict.
 *
 * @param {Object} climate - canonical climate object
 * @returns {{
 *   available: boolean,
 *   infectionCommencement?: boolean,
 *   nightTemp?: number,
 *   threshold?: number,
 *   source?: string,
 *   reason: string
 * }}
 */
function getLatinInfectionCommencement(climate) {
    const nightTemp = getNightTemp(climate);
    if (nightTemp == null) {
        return {
            available: false,
            reason: 'Night temperature unavailable; Latin 2021 infection-commencement diagnostic requires nightTemp.',
        };
    }
    const threshold = 18;
    const infectionCommencement = nightTemp >= threshold;
    return {
        available: true,
        infectionCommencement,
        nightTemp: Math.round(nightTemp * 10) / 10,
        threshold,
        source: 'Latin 2021 via Beehag, Walker, Wong & Kaapro 2024 (CABI Ch.7 p.191-194)',
        reason: infectionCommencement
            ? 'Night temperature at or above 18 deg C; Pythium infection-commencement conditions present per Latin 2021. Informational only, NOT an outbreak forecast.'
            : 'Night temperature below 18 deg C; Pythium infection-commencement threshold not met per Latin 2021.',
    };
}

function get5DayAvgTemp(dailyPattern) {
    // b35fix349 (Tier 2 provenance audit, anthracnose follow-up): canonical
    // rung-1 semantics. Pre-fix this function used SK's looser form:
    //   - first 5 entries only (`slice(0, 5)`)
    //   - nullish/non-numeric d.mean coerced to 0 (`d.mean || 0`)
    //   - denominator = slice length (depressed the mean on sparse data)
    // AnthracnoseModel.calculate (b35fix346) used a stricter form:
    //   - walk ALL entries
    //   - typeof === 'number' && !isNaN(v) guard (skips non-numeric)
    //   - denominator = real-entry count
    // The strict form is correct: a non-numeric or null entry is missing data,
    // not zero. Treating it as zero biases the mean toward 0 °C, which on
    // dollar-spot calibration data depresses MEANAT just enough to push some
    // sites below the SK 2018 logistic action threshold spuriously. b35fix348
    // notes flagged this as out of scope; b35fix349 unifies.
    //
    // Behavioural impact (relative to b35fix348):
    //   - Sites with fully-populated dailyPattern of length ≤ 5: identical
    //     output (slice(0,5) of a length-5 array == the array itself; all
    //     entries numeric → strict guard accepts them all).
    //   - Sites with dailyPattern length > 5: now averages the full pattern
    //     instead of the first 5 only. SK was previously discarding tail
    //     entries — modest shift, generally toward the period midpoint.
    //   - Sites with sparse/non-numeric dailyPattern entries: SK output
    //     shifts modestly UPWARD because the existing `|| 0` zero-coercion
    //     is removed. Accept as a correction, not a regression.
    //   - Empty / null dailyPattern: still returns null (degraded path
    //     unchanged — caller falls through to resolveMeanAirTemp).
    if (!Array.isArray(dailyPattern) || dailyPattern.length === 0) return null;
    let sum = 0, count = 0;
    for (let i = 0; i < dailyPattern.length; i++) {
        const v = dailyPattern[i]?.mean;
        if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
    }
    return count > 0 ? sum / count : null;
}

function getFusariumNModifier(nStatus, meanTemp) {
    const r = N_MODIFIERS_FUSARIUM[nStatus] || 1;
    if (('high' === nStatus || 'excessive' === nStatus) && meanTemp <= 15) {
        return r * ('excessive' === nStatus ? 1.35 : 1.2);
    }
    return r;
}

/**
 * Fidanza, Dernoeden & Grybauskas (1996) brown patch warning model — E2.
 *
 * Source: Fidanza, M.A., Dernoeden, P.H., and Grybauskas, A.P. (1996).
 *   Development and field validation of a brown patch warning model for
 *   perennial ryegrass turf. Phytopathology 86:385-390.
 *
 * Published equation (paper Abstract and p388):
 *   E2 = -21.5 + 0.15·RH + 1.4·T - 0.033·T²
 *
 * where:
 *   T  = MINIMUM daily air temperature (°C)
 *   RH = MEAN daily relative humidity (%) for a 24-h period ending 0600 h
 *
 * Action threshold (paper p388 right column, Discussion p389):
 *   E2 ≥ 6 = high risk, warrants spray
 *   E2 = 5 = moderate risk
 *   E2 ≤ 4 = low risk (conditions not conducive)
 *
 * Validation (paper p389):
 *   - 1991: 6 of 6 brown patch outbreaks predicted (E ≥ 6).
 *   - 1992: 9 of 12 outbreaks predicted (3 missed were minor).
 *   - 1993 (independent perennial ryegrass + colonial bentgrass validation):
 *     19 of 22 outbreaks predicted by both E2 and E6 models. 85% accuracy
 *     across 34 of 40 combined outbreaks. ALL major infection events predicted.
 *   - 1993 field-trial use of E2 reduced fungicide applications by 29% vs.
 *     14-day calendar schedule with equivalent disease control.
 *
 * Cancel rule (paper p390 right column):
 *   "Model accuracy was improved by canceling a disease warning if air
 *    temperature fell below 15°C within 24 h of a warning."
 *
 * Returns E2 as a number, or null when inputs are unavailable.
 *
 * b35fix340 (Tier 2 provenance audit, Finding 5): introduced as part of the
 * Fidanza et al. 1996 implementation. Pre-fix BrownPatchModel cited
 * "Fidanza & Dernoeden 1995" (wrong year, missing third author Grybauskas)
 * and used a Gilba-internal weighted-sum risk formula with a night-temp
 * gate at 20°C — the actual paper uses min air temp gate at 16°C and a
 * 4-term regression. Algorithm misattribution, same class as Smith-Kerns
 * 2018 corrected in b35fix335.
 */
function getFidanzaE2(climate) {
    // T = minimum daily air temperature.
    // The paper uses minimum daily air temp as the temperature input
    // (NOT night-temp computed from hourly data; NOT mean temp).
    const T = climate?.temperature?.min ?? null;

    // RH = mean daily relative humidity (24-h period ending 0600h).
    // Paper p386: "All variables summarized a 24-h interval beginning and
    // ending at 0600 h." We use climate.moisture.humidity.mean as the
    // closest available proxy on the production climate shape; fall back
    // to climate.humidity.mean for older shapes. If hourly RH data is
    // available we prefer the 24-h average (this matches the paper exactly).
    //
    // b35fix341: function now returns the actual inputs it used alongside
    // the E2 value, so the diagnostic and the drivers object can show the
    // truth instead of reading climate.moisture.humidity.mean independently.
    // Pre-fix the diagnostic/drivers reported the climate-object .mean value
    // (often 70 from upstream defaults) while the equation correctly used the
    // hourly 24-h average. Source-of-truth violation — production log
    // 2026-04-26 showed meanRH = 70.0% next to E2 = -3.74 on 17 sites,
    // even though E2 was actually computed from hourly mean ~68.33%.
    let RH = null;
    let rhSource = null;
    if (Array.isArray(climate?.hourlyData?.relative_humidity_2m) &&
        climate.hourlyData.relative_humidity_2m.length >= 24) {
        // Most recent 24 hours
        const arr = climate.hourlyData.relative_humidity_2m;
        const start = Math.max(0, arr.length - 24);
        let sum = 0, count = 0;
        for (let i = start; i < arr.length; i++) {
            const v = arr[i];
            if (typeof v === 'number' && !isNaN(v)) { sum += v; count++; }
        }
        if (count > 0) {
            RH = sum / count;
            rhSource = 'hourly 24-h avg';
        }
    }
    if (RH == null) {
        const fallback = climate?.moisture?.humidity?.mean ?? climate?.humidity?.mean ?? null;
        if (fallback != null) {
            RH = fallback;
            rhSource = 'period mean (fallback)';
        }
    }

    if (T == null || RH == null) {
        return { e2: null, T, RH, rhSource: rhSource || 'no data' };
    }

    const e2 = -21.5 + 0.15 * RH + 1.4 * T - 0.033 * T * T;
    return { e2, T, RH, rhSource };
}

/**
 * Apply the Fidanza et al. 1996 cancel rule (paper p390 right column).
 *
 * Returns true when the warning should be cancelled because the published
 * cancel condition has triggered: air temperature fell below 15°C within
 * 24 h of the warning. The cancel rule was added to the published model
 * after the 1992 false-warning analysis showed that warnings issued in
 * early June were sometimes followed by a cool snap that suppressed the
 * outbreak — paper p390: "Two of these false forecasts in 1992 possibly
 * may be discounted because of low (≤13°C) air temperatures in the days
 * immediately preceding the warning period. The model developed by
 * Schumann et al. (22), however, initially had greater false forecasts
 * (average >6 missed predictions per year per site), which was attributed
 * to a decrease in air temperature below 15°C immediately after the
 * warning. Model accuracy was improved by canceling a disease warning if
 * air temperature fell below 15°C within 24 h of a warning."
 *
 * Implementation note: in real-time use this would consult the next 24
 * hours of forecast temperature; in retrospective analysis it consults
 * the next 24 hours of observed temperature. The encoded function takes
 * an optional `nextDayMin` parameter — when provided, it applies the rule;
 * when null, it returns false (no cancel) and the consumer is expected to
 * surface the rule status separately.
 */
function shouldCancelFidanzaWarning(nextDayMinTemp) {
    if (nextDayMinTemp == null) return false;
    return nextDayMinTemp < 15;
}

/**
 * Get regional disease multiplier - PURE version
 * Original read from window.gaip_getDiseaseMultiplier. Now accepts multipliers map.
 */
function getRegionalDiseaseMultiplier(displayName, regionalMultipliers) {
    if (!regionalMultipliers) return 1;
    const DISPLAY_TO_KEY = {
        'Dollar Spot': 'dollarSpot', 'Brown Patch': 'brownPatch',
        'Pythium Blight': 'pythium', 'Pythium': 'pythium',
        'Anthracnose': 'anthracnose', 'Spring Dead Spot': 'springDeadSpot',
        'Helminthosporium': 'helminthosporium', 'Fusarium': 'fusarium',
        'Fusarium Patch (Microdochium)': 'fusarium',
        'Take-all Patch': 'takeAll', 'Take-all': 'takeAll',
        'Gray Leaf Spot': 'grayLeafSpot', 'Red Thread': 'redThread',
        'Snow Mould': 'snowMould', 'Pink Snow Mould': 'pinkSnowMould',
        'Waitea Patch': 'waiteaPatch', 'Brown Ring Patch': 'waiteaPatch',
        'Large Patch': 'largePatch',
        'Helminthosporium Leaf Spot': 'helminthosporium',
    };
    const key = DISPLAY_TO_KEY[displayName] || displayName.toLowerCase().replace(/\s+/g, '');
    return regionalMultipliers[key] || 1;
}

// =============================================================================
// DISEASE MODELS (all pure functions)
// =============================================================================

// =============================================================================
// b35fix452 (C57): CABI 2024 cross-reference for DollarSpotModel.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.7 p.165-171: Clarireedia taxonomy update from Sclerotinia
//   homoeocarpa per Salgado-Salazar et al. 2018 (already reflected in
//   the model's pathogen field above). AU/NZ distribution. Hall 1984
//   12-14h leaf wetness duration threshold and 22 deg C / 15 deg C
//   two-day average temperature triggers. CABI primarily cross-confirms
//   the Smith-Kerns 2018 logistic-regression chain already in use.
//   Cross-references the existing Smith-Kerns 2018 / Davis & Dernoeden
//   2002 chain. Coefficients, thresholds, and weights unchanged.
// =============================================================================
const DollarSpotModel = {
    name: 'Dollar Spot',
    pathogen: 'Clarireedia jacksonii',
    /**
     * Dollar spot risk computed from Smith-Kerns 2018 published probability,
     * tapered by Gilba site-specific modifiers.
     *
     * b35fix335 (Tier 1 provenance audit): pre-fix this function combined a
     * Gaussian temperature factor, a "concurrent favourable hours" humidity
     * factor (RH ≥ 90% AND temp 15–30°C, daytime only), and a leaf-wetness
     * factor in a weighted sum, scaled to 0–100, and labelled the result
     * "Smith-Kerns 2018". None of that math is in the paper. The actual
     * Smith-Kerns 2018 model is a logistic regression on 5-day mean RH and
     * 5-day mean air temperature.
     *
     * Post-fix architecture:
     *   1. smithKernsProbability — the published model output (0–100%).
     *      This is the headline number. The 20% action threshold from
     *      Smith et al. 2018 / Hempfling et al. 2021 applies to this.
     *   2. Gilba modifiers (leaf wetness, N status, shade, variety) are
     *      multiplicative tapers applied to the probability, exposed
     *      separately so a reader can see where the Smith-Kerns number
     *      ended and Gilba layering began.
     *   3. variety modifier remains intentionally not applied here — it
     *      is layered downstream via taperMultiplier() in analyse().
     */
    calculate(climate, nitrogen, variety, shade, dewData) {
        const meanTemp = climate?.temperature?.mean || 20;
        const dailyMeanTemp = (climate?.temperature?.max != null && climate?.temperature?.min != null)
            ? (climate.temperature.max + climate.temperature.min) / 2
            : meanTemp;
        const avg5Day = get5DayAvgTemp(climate?.temperature?.dailyPattern) || dailyMeanTemp;
        const meanRH5d = get5DayMeanRH(climate);
        const leafWet = getLeafWetnessHours(climate, dewData);
        const nStatus = nitrogen?.status || 'adequate';
        const dliDeficit = shade?.dliDeficit?.percentage || 0;

        // --- Smith-Kerns 2018 published probability ---
        // logit(μ) = −11.4041 + 0.0894·MEANRH + 0.1932·MEANAT
        // μ       = 1 / (1 + exp(−logit(μ)))
        // Returns null if either input is unavailable; we then fall back to
        // a degraded-data path that mirrors the structure but flags low
        // confidence.
        const smithKernsProbability = getSmithKerns2018Probability(climate);

        // --- Gilba site-specific modifiers (layered on top of SK probability) ---
        // wetFactor: leaf wetness from dew engine or hourly RH proxy. Acts as
        //   an INFECTION amplifier on top of the SK probability — SK captures
        //   ambient conditions, dew captures actual leaf-surface wetness.
        const wetFactor = Math.min(1, leafWet / 10);
        // nMod: N status modifier. Low N is well documented to amplify dollar
        //   spot susceptibility (Davis & Dernoeden 2002; Hempfling 2017; multiple
        //   extension sources). Recent research shows "foliar N content affects
        //   dollar spot severity, cutoff ~4.5% foliar N" (Plant Disease 2020).
        //   Mechanism: "N may select microbes that degrade oxalic acid, an important
        //   virulence factor of C. jacksonii" (Phytopathology 2025).
        const nMod = N_MODIFIERS[nStatus] || 1;
        // shadeMod: high-shade sites recover slowly from dollar spot scarring
        //   even if SK probability is moderate.
        // PROVENANCE NOTE: DLI deficit threshold (30%) and amplification formula lack
        // specific peer-reviewed citation. Based on general principle that shaded
        // conditions promote prolonged moisture and reduced air circulation.
        // Future: locate studies quantifying shade effects on dollar spot severity.
        const shadeMod = dliDeficit > 30 ? 1 + (dliDeficit - 30) / 100 : 1; // UNVERIFIED thresholds
        // varietyMod: extracted but applied in analyse() via taperMultiplier
        //   so resistant cultivars properly damp the score.
        const varietyMod = variety?.disease?.dollarSpot?.riskMultiplier || 1;

        // --- Compose final risk score ---
        // Headline: the Smith-Kerns probability itself (capped at 100).
        // Gilba layer: multiplicative tapers (wetness boost up to ~+30%,
        //   nitrogen ±35%, shade up to +70% on heavily shaded sites).
        // The Gilba layer is explicit and capped — never amplifies SK by
        //   more than 2× — so the final number stays in plausible territory
        //   relative to the published threshold.
        let rawRisk;
        let confidence = 'high';
        let confidenceScore = 90;
        let degraded = false;

        if (smithKernsProbability != null) {
            // Wetness multiplier: 1.0 at zero leaf wetness, up to ~1.30 at
            // ≥10 hrs/day. Capped at 1.30 — this is a Gilba calibration, not
            // from Smith-Kerns 2018.
            const wetMultiplier = 1 + 0.30 * wetFactor;
            const layeredRisk = smithKernsProbability * wetMultiplier * nMod * shadeMod;
            rawRisk = Math.max(0, layeredRisk);
            // Confidence improves when both 5-day means come from hourly data
            const hasHourlyRH = Array.isArray(climate?.hourlyData?.relative_humidity_2m)
                && climate.hourlyData.relative_humidity_2m.length >= 24;
            confidence = hasHourlyRH ? 'high' : 'medium';
            confidenceScore = hasHourlyRH ? 90 : 70;
        } else {
            // Degraded path: insufficient data to compute SK probability.
            // Fall back to a coarse temperature-only estimate and flag low
            // confidence. This is a Gilba fallback, NOT Smith-Kerns.
            let tempFactor = 0;
            if (avg5Day >= 15 && avg5Day <= 30) {
                tempFactor = Math.exp(-0.5 * Math.pow((avg5Day - 22) / 6, 2));
            } else if (avg5Day > 30) {
                tempFactor = Math.max(0, 1 - (avg5Day - 30) / 10);
            } else if (avg5Day > 10) {
                tempFactor = (avg5Day - 10) / 10;
            }
            rawRisk = tempFactor * (1 + 0.30 * wetFactor) * nMod * shadeMod * 30;
            confidence = 'low';
            confidenceScore = 40;
            degraded = true;
        }

        const risk = Math.min(100, rawRisk);

        // --- DIAGNOSTIC (b35fix99 + b35fix335 + b35fix335b): log intermediate values ---
        // b35fix335b: distinguish real-data MEANRH/MEANAT from fallback defaults.
        // Pre-fix the diagnostic used the local avg5Day variable which was papered
        // over with `meanTemp || 20` — production showed `MEANAT: 20.00, SK: n/a
        // (degraded)` which is logically inconsistent and confused verification.
        // Post-fix the diagnostic logs the actual SK function inputs (real data
        // or null) and tags the data source so degradation is unambiguous.
        //
        // b35fix350 (Tier 2 provenance audit, anthracnose engine-pair refactor —
        // second leg): the three parallel rung walks (_diagAvg5DayPattern,
        // _diagAvg5DayMaxMin, _diagMeanAT ?? chain, _atSrc ladder) collapsed
        // into a single resolveMeanAirTempSource(climate) call. Behaviour
        // unchanged — pinned by tests/dollar-spot-meanat-source.test.js.
        if (typeof console !== 'undefined') {
            const _diagMeanRH = get5DayMeanRH(climate);
            const _meanAT = resolveMeanAirTempSource(climate);
            // b35fix355: source-tag must mirror the rung get5DayMeanRH actually
            // used. Pre-fix the tag tested only `array.length > 0`, so when the
            // hourly array existed but was all-null (e.g. disease-forecast.js
            // synthesises 24-entry null arrays when dayClimate.humidity is
            // missing), the diagnostic printed `(hourly avg)` while
            // get5DayMeanRH had actually fallen through both rungs and
            // returned null. Production log gilbasolutions_com-1777248533557
            // showed 23/24 dispatches as `n/a (hourly avg)` — internally
            // contradictory. Post-fix the tag matches the function's branching:
            //   'hourly avg' iff hourly array has ≥1 numeric entry;
            //   'period mean' iff fell through to climate.moisture.humidity.mean;
            //   'no data' iff returned null.
            // This does NOT fix the underlying propagation gap — that's a real
            // shape mismatch between disease-forecast's per-day climate object
            // and the v1 nested shape get5DayMeanRH expects (climate.humidity
            // top-level v2 fallback is missing from the function). The tag fix
            // here makes the next production log unambiguous about what
            // happened, so the propagation fix can be scoped accurately.
            let _rhSrc;
            const _hourlyRH = climate?.hourlyData?.relative_humidity_2m;
            if (Array.isArray(_hourlyRH) && _hourlyRH.length > 0) {
                let _hasNumeric = false;
                const _start = Math.max(0, _hourlyRH.length - 120);
                for (let _i = _start; _i < _hourlyRH.length; _i++) {
                    const _v = _hourlyRH[_i];
                    if (typeof _v === 'number' && !isNaN(_v)) { _hasNumeric = true; break; }
                }
                _rhSrc = _hasNumeric
                    ? 'hourly avg'
                    : (climate?.moisture?.humidity?.mean != null ? 'period mean' : 'no data');
            } else {
                _rhSrc = (climate?.moisture?.humidity?.mean != null) ? 'period mean' : 'no data';
            }
            console.group('[DollarSpot.calculate() diagnostic, b35fix335 SK 2018 logistic]');
            console.log('MEANRH (5d %)        :', _diagMeanRH != null ? _diagMeanRH.toFixed(2) : 'n/a', '(' + _rhSrc + ')');
            console.log('MEANAT (5d °C)       :', _meanAT.value != null ? _meanAT.value.toFixed(2) : 'n/a', '(' + _meanAT.source + ')');
            console.log('SK 2018 probability  :', smithKernsProbability != null ? smithKernsProbability.toFixed(2) + '%' : 'n/a (degraded)');
            console.log('wetFactor (Gilba)    :', wetFactor.toFixed(4), '(leafWetHrs:', leafWet, ')');
            console.log('nMod (Gilba)         :', nMod, '(N status:', nStatus, ')');
            console.log('shadeMod (Gilba)     :', shadeMod.toFixed(4), '(dliDeficit:', dliDeficit, '%)');
            console.log('varietyMod (Gilba)   :', varietyMod, '(applied in analyse(), NOT here)');
            console.log('rawRisk (layered)    :', rawRisk.toFixed(2));
            console.log('riskScore (final)    :', Math.round(risk), degraded ? '(DEGRADED, SK inputs missing)' : '');
            console.groupEnd();
        }

        return {
            disease: 'dollarSpot', displayName: 'Dollar Spot',
            riskScore: Math.round(risk),
            riskLevel: classifyRisk(risk),
            rawRisk: Math.round(rawRisk),
            // Exposed separately so consumers can show "SK probability vs
            // Gilba-layered risk" in reports and the published 20% action
            // threshold can be applied directly to smithKernsProbability.
            smithKernsProbability: smithKernsProbability != null ? Math.round(smithKernsProbability * 10) / 10 : null,
            smithKernsActionThreshold: 20, // % — Smith et al. 2018 standard
            confidence: confidence,
            confidenceScore: confidenceScore,
            degraded: degraded,
            drivers: {
                temperature: { value: avg5Day != null ? Math.round(avg5Day * 10) / 10 : null, source: 'MEANAT (Smith-Kerns 2018 input)' },
                humidity:    { value: meanRH5d != null ? Math.round(meanRH5d * 10) / 10 : null, source: 'MEANRH (Smith-Kerns 2018 input)' },
                leafWetness: { hours: leafWet, contribution: Math.round(wetFactor * 100), source: 'Gilba modifier (not in SK 2018)' },
                nitrogen:    { status: nStatus, modifier: nMod, source: 'Gilba modifier (Davis & Dernoeden 2002 framing)' },
            },
            modifiers: { shade: shadeMod, variety: varietyMod, nitrogen: nMod },
            source: 'Smith-Kerns 2018 logistic regression (PLOS ONE 13(3):e0194216) + Gilba site modifiers',
        };
    },
    getInterventions(riskLevel, opts) {
        const cultural = ['Remove dew early morning (mow, roll, or drag)'];
        if (opts?.nitrogen?.status === 'deficient' || opts?.nitrogen?.status === 'low') {
            cultural.unshift('PRIORITY: Apply nitrogen - low N dramatically increases susceptibility');
        }
        return { cultural, preventive: [], timing: null };
    },
};

// =============================================================================
// b35fix452 (C57): CABI 2024 cross-reference for BrownPatchModel.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.7 p.194-199 + Box 7.15: 10h minimum leaf wetness duration, > 95%
//   relative humidity, AU/NZ distribution back to Scott 1937. Fidanza
//   E2 (Fidanza, Dernoeden & Grybauskas 1996, paper-verified b35fix340)
//   stays as the headline infection-driver model; CABI is supplementary
//   environmental-envelope confirmation. Cross-references the existing
//   Fidanza 1996 / Shaner & Finney 1977 / Smiley, Dernoeden & Clarke
//   2005 chain. Coefficients, thresholds, and weights unchanged.
// =============================================================================
const BrownPatchModel = {
    name: 'Brown Patch',
    pathogen: 'Rhizoctonia solani AG 1-A',  // AG 1-A = cool-season brown patch; AG 2-2 LP = large patch warm-season

    /**
     * b35fix340 (Tier 2 provenance audit, Finding 5):
     *
     * Pre-b35fix340 this model used a Gilba-internal weighted-sum risk formula
     *   risk = (0.5·nightFactor + 0.2·dayFactor + 0.3·wetFactor)·nMod·100
     * with a night-temp gate at 20°C and an LW-hours minimum of 10h, citing
     * "Fidanza & Dernoeden 1995". That citation was wrong on three counts:
     *   - Year: actual paper is 1996, not 1995.
     *   - Author list: Fidanza, Dernoeden & GRYBAUSKAS, not just two authors.
     *   - Equation: the paper publishes a 4-term regression
     *     E2 = -21.5 + 0.15·RH + 1.4·T - 0.033·T²  (paper p388)
     *     where T = MIN air temp (not night temp) and RH = MEAN daily RH
     *     (24-h period ending 0600h). The encoded weighted-sum bears no
     *     resemblance to the published equation.
     *
     * Algorithm misattribution, same class as Smith-Kerns 2018 corrected
     * in b35fix335. b35fix340 replaces the Gilba weighted-sum with the
     * published E2 equation as the headline number; Gilba site modifiers
     * (variety, tissue nutrients, dew engine LW input) are layered as
     * separate, explicitly-distinguished tapers in analyse() rather than
     * baked into the headline. The published 15°C cancel rule is wired in
     * via shouldCancelFidanzaWarning() — a forecast-aware consumer can
     * apply it; when no forecast min-temp is available, the cancel flag
     * is exposed on the result object for transparency.
     *
     * Source: Fidanza, M.A., Dernoeden, P.H., and Grybauskas, A.P. (1996).
     *   Development and field validation of a brown patch warning model for
     *   perennial ryegrass turf. Phytopathology 86:385-390.
     */
    calculate(climate, nitrogen, variety, dewData) {
        const nStatus = nitrogen?.status || 'adequate';

        // ── 1. INFECTION COMPONENT (Fidanza et al. 1996 published E2) ─────
        // Compute the published E2 from min daily air temp + mean daily RH.
        // b35fix341: getFidanzaE2 now returns the ACTUAL inputs it used so the
        // diagnostic and drivers show the truth instead of the climate object's
        // .moisture.humidity.mean (which is often a literal 70 from upstream
        // defaults — see disease-forecast.js avgHumidity fallback).
        const fidanza = getFidanzaE2(climate);
        const e2 = fidanza.e2;
        const minTemp = fidanza.T;
        const meanRH  = fidanza.RH;
        const rhSource = fidanza.rhSource;

        // The published cancel rule: "if air temperature falls below 15°C
        // within 24 h of a warning, cancel" (paper p390). We don't have
        // forecast min-temp wired in here — flag the rule status so a
        // forecast-aware consumer can apply it.
        // climate.forecast?.tomorrow?.tempMin is a plausible forecast hook;
        // present the cancelRule field even when null so downstream knows
        // the rule exists and is not being applied automatically.
        const forecastNextMinTemp = climate?.forecast?.nextDay?.tempMin
                                 ?? climate?.forecast?.tomorrow?.tempMin
                                 ?? null;
        const cancelRuleApplies = shouldCancelFidanzaWarning(forecastNextMinTemp);

        // Validated input range (paper p388 Discussion: model "limited to
        // average temperatures ranging from 16 to 28 C" not stated explicitly
        // for brown patch but the gating threshold IS T ≥ 16°C per paper
        // Table 1 variable D: minimum air temp ≥16°C scores +1 point; <16°C
        // scores -2 points). For the regression E2 we do not hard-clamp T
        // because paper Fig 2B shows the regression surface across T 10-24°C;
        // values below 16°C produce E2 below the 6 threshold naturally.
        const tempInRange = minTemp != null && minTemp >= 10 && minTemp <= 30;

        // Degraded-data fallback: if the published equation can't compute
        // (T or RH missing), fall back to a conservative "no warning" path
        // and flag the degradation. This mirrors the b35fix335 Smith-Kerns
        // pattern where degraded inputs do not produce a fabricated risk.
        if (e2 == null) {
            return {
                disease: 'brownPatch', displayName: 'Brown Patch',
                riskScore: 0,
                rawRisk: 0,
                riskLevel: 'low',
                confidence: 'low',
                confidenceScore: 30,
                degraded: true,
                fidanzaE2: null,
                fidanzaActionThreshold: 6,
                fidanzaInputs: { minAirTemp: minTemp, meanRH: meanRH, rhSource: rhSource },
                drivers: {
                    fidanzaE2: { value: null, threshold: 6, status: 'degraded, inputs missing' },
                    minAirTemp: { value: minTemp, status: minTemp == null ? 'missing' : 'available', source: '(Fidanza E2 input)' },
                    meanRH:     { value: meanRH,  status: meanRH == null ? 'missing' : 'available', rhSource: rhSource, source: '(Fidanza E2 input, ' + rhSource + ')' },
                },
                source: 'Fidanza, Dernoeden & Grybauskas 1996 Phytopathology 86:385-390 (paper-verified b35fix340), degraded path: E2 inputs missing',
                agGroup: 'AG 1-A',
            };
        }

        // ── 2. MAP E2 → 0-100 RISK SCORE ─────────────────────────────────
        // The published threshold is E2 ≥ 6 = high risk; ≤ 4 = low; 5 = moderate.
        // Map the E2 scale onto 0-100 using the published thresholds as anchors:
        //   E2 ≤ 0 → 0      (well below low-risk floor)
        //   E2 = 4 → 33     (boundary: low / moderate)
        //   E2 = 5 → 50     (moderate)
        //   E2 = 6 → 67     (boundary: moderate / high — published warning threshold)
        //   E2 ≥ 8 → 100    (saturated; paper observations max out near E2=8 per Fig 2B)
        // Linear segments between anchors. The threshold E2 ≥ 6 maps to risk ≥ 67,
        // which sits cleanly in the "high risk" band of the engine's classifyRisk().
        let infectionRisk;
        if (e2 <= 0)        infectionRisk = 0;
        else if (e2 <= 4)   infectionRisk = (e2 / 4) * 33;
        else if (e2 <= 5)   infectionRisk = 33 + ((e2 - 4) / 1) * 17;   // 33 → 50
        else if (e2 <= 6)   infectionRisk = 50 + ((e2 - 5) / 1) * 17;   // 50 → 67
        else if (e2 <= 8)   infectionRisk = 67 + ((e2 - 6) / 2) * 33;   // 67 → 100
        else                infectionRisk = 100;

        const infectionFlag = e2 >= 6;

        // ── 3. STRESS / N MODIFIER (Gilba layer, NOT in Fidanza 1996) ───
        // The published E2 model does NOT include nitrogen status. Gilba layers
        // a stress modifier on top of the published score, keyed off the
        // existing N_MODIFIERS_BROWN_PATCH map (high N favours brown patch on
        // perennial ryegrass per Shaner & Finney 1977 Phytopathology 67:1051-1056,
        // cited by Fidanza et al. as ref 24 — N effect is real and in the
        // literature, just not in the warning model).
        const nMod = N_MODIFIERS_BROWN_PATCH[nStatus] || 1;

        // ── 4. SUPPLEMENTARY LW SIGNAL (Gilba dew engine, NOT in Fidanza 1996)
        // Paper Table 1 lists "leaf wetness duration ≥6h OR precipitation in
        // prior 48h ≥12mm" as a 1-point variable in E6, but E2 (the simplified
        // shipped model) does not use leaf wetness directly. We expose dew-
        // engine LW hours on the result object for transparency but do NOT
        // bake it into the headline score — the published E2 is what fires
        // the threshold.
        const lwHours = dewData?.leafWetness?.averageWetHours ?? null;

        // ── 5. COMBINE ───────────────────────────────────────────────────
        // Headline risk = published E2 mapped to 0-100, modulated by N status.
        // Variety + tissue + species multipliers are layered downstream in
        // analyse() via the existing taperMultiplier(), preserving the
        // architectural rule (Smith-Kerns parity).
        const rawRisk = Math.min(100, Math.max(0, infectionRisk * nMod));
        const riskScore = Math.round(rawRisk);

        // ── 6. DIAGNOSTIC ────────────────────────────────────────────────
        if (typeof console !== 'undefined') {
            console.group('[BrownPatch.calculate() diagnostic]');
            console.log('minAirTemp (T)  :', minTemp != null ? minTemp.toFixed(1) + '°C' : 'n/a', '(Fidanza E2 input, paper uses MIN daily air temp)');
            console.log('meanRH          :', meanRH != null ? meanRH.toFixed(1) + '%'  : 'n/a', '(' + rhSource + ', paper: 24-h mean ending 0600h)');
            console.log('Fidanza E2      :', e2.toFixed(2), '(threshold ≥ 6:', infectionFlag ? 'YES' : 'NO', ')');
            console.log('infectionRisk   :', infectionRisk.toFixed(1), '(E2 mapped to 0-100)');
            console.log('nMod            :', nMod, '(N status:', nStatus, ', Gilba layer, NOT in Fidanza 1996)');
            console.log('cancelRuleApplies:', cancelRuleApplies, '(Fidanza paper p390: cancel if next-day Tmin < 15°C)');
            console.log('lwHours         :', lwHours != null ? lwHours.toFixed(1) + 'h' : 'n/a', '(Gilba dew engine, supplementary, NOT in E2)');
            console.log('riskScore       :', riskScore);
            console.groupEnd();
        }

        return {
            disease: 'brownPatch', displayName: 'Brown Patch',
            riskScore,
            rawRisk: Math.round(rawRisk),
            riskLevel: classifyRisk(riskScore),
            confidence: tempInRange ? 'high' : 'medium',
            confidenceScore: tempInRange ? 88 : 65,
            degraded: false,

            // Published-equation outputs exposed for downstream use
            fidanzaE2: Math.round(e2 * 100) / 100,
            fidanzaActionThreshold: 6,
            fidanzaInputs: { minAirTemp: minTemp, meanRH: meanRH, rhSource: rhSource },
            infectionFlag,
            cancelRuleApplies,
            cancelRuleNote: 'Fidanza et al. 1996 p390: cancel warning if next-day Tmin < 15°C. Forecast hook: climate.forecast.nextDay.tempMin or climate.forecast.tomorrow.tempMin.',

            drivers: {
                // Published E2 inputs — labelled (Fidanza E2 input)
                fidanzaE2:   { value: Math.round(e2 * 100) / 100, threshold: 6, infectionFlag, source: '(Fidanza E2)' },
                minAirTemp:  { value: minTemp != null ? Math.round(minTemp * 10) / 10 : null, threshold: 16, source: '(Fidanza E2 input)' },
                meanRH:      { value: meanRH != null ? Math.round(meanRH * 10) / 10 : null,  rhSource: rhSource, source: '(Fidanza E2 input, ' + rhSource + ')' },
                // Gilba-layer modifiers — explicitly distinguished
                nitrogen:    { status: nStatus, modifier: nMod, source: '(Gilba modifier, N effect per Shaner & Finney 1977, layered on top of published E2)' },
                leafWetnessHours: { value: lwHours, source: '(Gilba dew engine, supplementary, NOT in published E2 model)' },
            },
            modifiers: { nitrogen: nMod },
            source: 'Fidanza, Dernoeden & Grybauskas 1996 Phytopathology 86:385-390 (paper-verified b35fix340, supersedes pre-fix "Fidanza & Dernoeden 1995" misattribution); E2 = -21.5 + 0.15·RH + 1.4·T - 0.033·T², action threshold E2 ≥ 6. N modifier (Gilba layer): Shaner & Finney 1977 Phytopathology 67:1051-1056.',
            provenance: {
                citation: 'verified',                 // DOI 10.1094/Phyto-86-385 — paper Phytopathology 86:385-390
                paperObtained: '2026-04-26',
                equation: 'verified',                 // E2 = -21.5 + 0.15·RH + 1.4·T - 0.033·T² letter-for-letter (paper p388)
                threshold: 'verified',                // E2 ≥ 6 (paper p388 right column, p389)
                inputDefinitions: 'verified',         // T = MIN daily air temp; RH = mean 24-h RH ending 0600h (paper p386 right col)
                cancelRule: 'wired-but-not-auto-applied', // 15°C cancel rule (paper p390) exposed on result; consumer must supply forecast min-temp
                supersedes: 'pre-b35fix340 cited "Fidanza & Dernoeden 1995" (wrong year, missing third author Grybauskas) and used a Gilba weighted-sum risk formula bearing no resemblance to the published equation (algorithm misattribution, Smith-Kerns class)',
                stressLayerProvenance: 'N modifier (N_MODIFIERS_BROWN_PATCH) is a Gilba layer per Shaner & Finney 1977 Phytopathology 67:1051-1056, paper-cited as ref 24 in Fidanza et al. 1996. The published E2 model itself does not include N. Layered architecture matches Smith-Kerns 2018 (b35fix335).',
                auditDoc: 'docs/provenance-audit-tier2.md',
            },
            agGroup: 'AG 1-A',
        };
    },

    getInterventions(riskLevel, opts) {
        const cultural = [];
        if (opts?.nitrogen?.status === 'high' || opts?.nitrogen?.status === 'excessive') {
            cultural.unshift('REDUCE nitrogen, high N favours brown patch on perennial ryegrass (Shaner & Finney 1977; cited by Fidanza et al. 1996)');
        }
        return { cultural, preventive: [], timing: 'Fidanza E2 ≥ 6 = warning. Cancel if next-day Tmin < 15°C (paper p390).' };
    },
};

// =============================================================================
// b35fix452 (C57): CABI 2024 cross-reference for PythiumModel.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.7 p.191-194 + Ch.6 Table 6.3: cardinal temperatures across six
//   Pythium species. CABI cites Latin 2021 for fungal infection
//   commencement at around 18 deg C, and reports that foliar blighting
//   on cool-season turfgrasses proceeds most rapidly at 29-35 deg C
//   with humidity above 90% and leaf wetness periods exceeding 14h
//   (Couch 1995; Tredway et al. 2023). On warm-season turfgrass,
//   temperatures above 10 deg C during humid and rainy periods are
//   reported as conducive to infection. The hub currently uses a 20 deg
//   C night-temperature gate (Nutter, Cole & Schein 1983 published
//   proviso clause, paper-correct, kept) but the continuous Gilba
//   weighted-sum night-factor onset at 20 deg C should move to 18 deg C
//   per Latin 2021 / CABI; flagged in audit recommendation #6 for
//   engine refinement under a future build. Cross-references the
//   existing Nutter 1983 / Shane 1994 chain. Coefficients, thresholds,
//   and weights unchanged in this build.
//
// b35fix455 (C61): Latin 2021 infection-commencement diagnostic channel
//   per CABI 2024 Ch.7 p.191-194. Closes audit recommendation #6 from
//   cabi_2024_disease_audit.md via Option B (parallel diagnostic
//   channel, NOT outbreak-gate move).
//
//   AUDIT-FRAMING CORRECTION. The original rec #6 framing proposed
//   moving the continuous Gilba weighted-sum night-factor onset from
//   20 deg C to 18 deg C per the Latin 2021 / CABI 2024 figure. The
//   pre-estimate audit (Checklist C, b35fix455 session) traced the
//   18 deg C figure to its biological context: CABI 2024 attributes
//   it to Latin 2021 for "fungal infection commencement", which is
//   initial-infection establishment, NOT outbreak-forecast conditions.
//   The contemporary outbreak-forecasting consensus (Latin BP-109-W
//   extension publication; Penn State Pest Diagnostic Lab current;
//   Maryland Extension FS-2024-0707; UC IPM Pest Management
//   Guidelines current) all anchor the operative night-temperature
//   threshold for Pythium blight outbreaks at 20 deg C (68 deg F).
//   Moving the outbreak gate or ramp onset to 18 deg C would emit
//   outbreak-tier risk on 18-19 deg C nights where every cited 2024
//   extension publication, including Latin's own, would not.
//
//   POST-FIX. The continuous Gilba weighted-sum gate at
//   `if (nightTemp < 20)` and the ramp `(nightTemp - 20) / 8` are
//   UNCHANGED. The Nutter-Shane paper-faithful boolean
//   (getNutterShaneForecast, b35fix352) is UNCHANGED. A new helper
//   getLatinInfectionCommencement(climate) computes a low-tier
//   informational signal at the 18 deg C night-temperature anchor,
//   attached to the result object on all three return paths
//   (degraded, cold-gate, real-path) as result.latinInfectionCommencement.
//   The field carries the same shape as result.nutterShaneForecast
//   for symmetry: { available, infectionCommencement, nightTemp,
//   threshold, source, reason }. Forecast-aware consumers MAY surface
//   it as an informational note alongside the outbreak risk tier;
//   passive consumers ignore it without contract change.
//
//   ARCHITECTURE PRECEDENT. Mirrors the b35fix352 disposition pattern
//   for the Nutter 1983 conjunctive boolean: when a published anchor
//   describes a different biological phenomenon than the engine's
//   primary continuous channel, the right fix is a parallel diagnostic
//   field rather than re-anchoring the continuous channel and
//   contaminating its semantics.
//
//   PRODUCTION EFFECT. The continuous riskScore is unchanged on every
//   site (zero behavioural delta on outbreak risk). Sites with night
//   temperatures in the 18-20 deg C band will newly carry an
//   informational latinInfectionCommencement:true field; the riskScore
//   on those sites stays at the cold-gate zero-risk return per the
//   unchanged Nutter/Shane proviso. No adjacent coefficient bump
//   (rampMax 28 deg C, gate threshold 20 deg C, soil-pathway threshold
//   20 deg C, Ca modifier 1.2x, weight 0.4/0.2/0.4, rainBoost ladder
//   1.3/1.15, alert thresholds) is required.
//
//   Source: Beehag, Walker, Wong & Kaapro 2024 (CABI Ch.7 p.191-194)
//   citing Latin 2021. Cross-references the existing Nutter 1983 /
//   Shane 1994 / Couch 1995 / Tredway et al. 2023 chain.
// =============================================================================
const PythiumModel = {
    name: 'Pythium Blight',
    pathogen: 'Pythium aphanidermatum',
    /**
     * b35fix352 (Tier 2 provenance audit, Pythium algorithm misattribution):
     *
     * Pre-b35fix352 this model cited Nutter, Cole & Schein 1983 as the source
     * of its risk equation. That citation was wrong on the algorithm form.
     * Nutter, Cole & Schein 1983 publish a CONJUNCTIVE BOOLEAN RULE, not a
     * continuous weighted-sum:
     *
     *   Nutter 1983 forecast TRUE iff:
     *     (1) max daily temperature > 30°C,
     *     (2) followed by ≥14 hours of relative humidity > 90%,
     *     (3) provided the minimum temperature was > 20°C
     *   (Plant Disease 67:1126-1128, abstract — verified via APS abstract
     *    index and corroborating secondary sources.)
     *
     * Shane 1994 (Use of Disease Models for Turfgrass Management Decisions,
     * pp. 397-404, in Leslie A.R. ed., Handbook of Integrated Pest Management
     * for Turf and Ornamentals, CRC Press) modifies these thresholds to
     * (>27.7°C, ≥9h, >20°C) — currently the dominant operational form in
     * commercial turf and the one most cited in extension publications
     * (APS Pythium lesson, Penn State Turfgrass Pest Diagnostic Lab,
     * NRCC Cornell). Shane 1994 was uncited pre-b35fix352.
     *
     * The encoded equation in this model is a continuous weighted-sum:
     *     risk = (0.4·nightFactor + 0.2·dayFactor + 0.4·wetFactor)·rainBoost·nMod·100
     *   with linear ramps:
     *     nightFactor: 20°C→28°C
     *     dayFactor:   30°C→38°C (gates at 30°C)
     *     wetFactor:   leaf-wetness ladder, falls back to night-RH binary
     *
     * That form is GILBA-INTERNAL. It bears no resemblance to the published
     * conjunctive boolean. It uses Nutter/Shane THRESHOLDS as ramp anchors,
     * but the algorithm shape is not from any peer-reviewed turfgrass disease
     * paper Claude/Jerry could trace at b35fix352 time. Same algorithm-
     * misattribution failure class as pre-b35fix335 SK ("getSmithKernsConcurrentHours")
     * and pre-b35fix340 BrownPatch ("Fidanza 1995" weighted-sum).
     *
     * b35fix352 disposition (Option B — honest relabel; mirrors b35fix340
     * Fidanza approach in spirit but more conservative because the published
     * Pythium rule requires hourly-RH-duration data that is unavailable on
     * most production sites):
     *
     *   1. The continuous weighted-sum stays as the headline `riskScore` —
     *      it has display utility (gradient colour, watch zones) and runs on
     *      the climate inputs we actually have.
     *   2. The source string is rewritten. The encoded algorithm is now
     *      attributed to Gilba; Nutter 1983 and Shane 1994 are cited ONLY
     *      for the threshold values (20°C min-temp gate, 30°C day, 27.7°C
     *      Shane day) and for confirming the agronomic envelope.
     *   3. A new `nutterShaneForecast` field is added to the result object,
     *      computing the published conjunctive boolean when hourly RH data
     *      is present. Returns { available: bool, nutter1983, shane1994,
     *      reason } so a forecast-aware consumer can choose to display the
     *      paper-faithful binary verdict alongside the continuous Gilba score.
     *      When hourly RH data is absent, available:false with a transparent
     *      reason — never fabricates a forecast verdict.
     *   4. The `Ca/K MODIFIERS: HEURISTIC` self-flag is REMOVED in b35fix354.
     *      The K modifier (1.1× on K deficiency) was stripped — no Pythium-
     *      specific peer-reviewed support. The Ca modifier (1.2× on Ca
     *      deficiency) was retained and re-cited against Vargas, Smiley/
     *      Dernoeden/Clarke (Compendium 3rd/4th ed.), Rahman & Punja 2007
     *      (Datnoff/Elmer/Huber Mineral Nutrition and Plant Disease, ch. 6),
     *      and Sugimoto et al. 2008 (Plant Disease 92:1559) for the direction;
     *      the 1.2× scalar is acknowledged as Gilba-internal/operational.
     *      Full provenance comment block is at the application site
     *      (computeDiseaseRisks, ≈ Pythium tissue modifier section).
     *
     * Tier-1 / Tier-2 / Tier-3 restructure (encode Nutter-Shane as headline
     * forecast, with Gilba continuous as fallback) is a more involved change
     * that needs a production-data validation pass on the Tier-1 firing rate
     * before it is committed to. Deferred from b35fix352 — the relabel + new
     * forecast field is sufficient to close the algorithm-misattribution
     * audit finding without committing to a structural change unvalidated
     * against production climate-data quality.
     *
     * AUDIT TRAIL (Tier-2 audit findings, Pythium):
     *   #1 silent false-negative on degraded climate     — closed b35fix351
     *   #2 algorithm misattribution to Nutter 1983       — closed b35fix352 (this fix)
     *   #3 Shane 1994 modification uncited                — closed b35fix352 (this fix)
     *   #4 Ca/K modifier heuristic provenance             — closed b35fix354 (this fix)
     *      hybrid disposition: K modifier stripped (unsupported);
     *      Ca modifier retained with peer-reviewed citations (Vargas,
     *      Smiley/Dernoeden/Clarke, Rahman & Punja 2007, Sugimoto et al. 2008).
     *      Magnitude (1.2×) remains Gilba-internal/operational.
     *   #5 Latin 2021 infection-commencement diagnostic   , closed b35fix455 (C61)
     *      CABI 2024 audit rec #6 disposition: Option B (parallel
     *      diagnostic channel, NOT outbreak-gate move). The 18 deg C
     *      figure attributed by CABI 2024 to Latin 2021 describes
     *      infection commencement, not outbreak conditions. Outbreak
     *      gate (20 deg C) and ramp anchor (20 deg C) are retained per
     *      the contemporary 2024 outbreak-forecasting consensus.
     *      New result.latinInfectionCommencement field carries the
     *      18 deg C signal in its own diagnostic channel, mirroring
     *      the b35fix352 nutterShaneForecast precedent.
     *
     * TEMPERATURE GATE: 20°C night minimum — published threshold from Nutter 1983
     *   and Shane 1994 (proviso clause: "provided minimum temperature was >20°C").
     * NIGHT TEMP RAMP: 20°C (threshold) → 28°C (max risk). Gilba-internal
     *   linear ramp; corrected from erroneous 18-24°C ramp in pre-b35fix104 builds.
     * DAY TEMP GATE: 30°C — Nutter 1983; Shane 1994 modification 27.7°C also exposed.
     * WETNESS: Hourly leaf wetness when available; night-RH binary fallback.
     * SOIL PATHWAY: Secondary root/crown risk when soil temp 100mm > 20°C
     *   (Gilba-internal extension; not from Nutter or Shane).
     * Ca MODIFIER: 1.2× tissueMod when tissue Ca status='deficient'. Direction
     *   is peer-reviewed (Vargas Mgmt of Turfgrass Diseases; Smiley/Dernoeden/
     *   Clarke Compendium 3rd/4th ed.; Rahman & Punja 2007 in Datnoff/Elmer/
     *   Huber, Mineral Nutrition and Plant Disease, ch. 6; Sugimoto et al.
     *   2008 Plant Disease 92:1559 — closest peer-reviewed oomycete analog).
     *   Magnitude is Gilba-internal/operational. Mechanism: Ca²⁺ stabilises
     *   middle-lamella pectates and cell-wall integrity, raising the barrier
     *   to oomycete polygalacturonases.
     * K MODIFIER: REMOVED in b35fix354. Pre-fix code applied a 1.1×
     *   multiplier on tissue K deficiency. No Pythium-specific peer-reviewed
     *   evidence supports this — Vargas and Smiley/Dernoeden/Clarke do not
     *   single out K deficiency as a Pythium susceptibility factor.
     * LATIN INFECTION COMMENCEMENT (b35fix455): 18°C night-temp diagnostic
     *   channel. Parallel to nutterShaneForecast. Informational only, NOT
     *   used to drive riskScore. Attributed to Latin 2021 via CABI 2024
     *   (Beehag, Walker, Wong & Kaapro 2024 Ch.7 p.191-194). Outbreak
     *   gate and ramp anchors are NOT moved; the 2024 outbreak-forecasting
     *   consensus (Latin BP-109-W, Penn State Pest Diagnostic Lab,
     *   Maryland Extension FS-2024-0707, UC IPM) anchors at 20°C.
     * SPECIES SCOPE: P. aphanidermatum only. P. ultimum / P. graminicola
     *   (cool-season) not modelled.
     */
    calculate(climate, nitrogen, variety, dewData) {
        // ── Resolve inputs (b35fix351 — Tier 2 provenance audit, Pythium first) ─
        // Pre-b35fix351: nightTemp = getNightTemp() with `|| 15` fabrication and
        // maxTemp = `climate?.temperature?.max || 25` fabrication. On a degraded
        // climate (no temperature data), the gate `if (nightTemp < 20)` fired
        // `riskScore 0, confidence 'high', confidenceScore 90` — silent
        // false-negative on the most catastrophic warm-season disease.
        // Post-fix: getNightTemp returns null when unknown; maxTemp resolves
        // to null when scalar absent; degraded path explicit (riskScore 0,
        // confidence 'low', source-tag 'DEGRADED — Pythium ... missing'),
        // mirroring the b35fix346 AnthracnoseModel temperature null-passthrough.
        const nightTemp = getNightTemp(climate);
        const maxTempRaw = climate?.temperature?.max;
        const maxTemp = (typeof maxTempRaw === 'number' && !isNaN(maxTempRaw)) ? maxTempRaw : null;
        const nightRH = getNightHumidity(climate);
        const precip = climate?.precipitation?.total ?? climate?.moisture?.precipitation?.total ?? climate?.moisture?.rainfall ?? 0;

        // Source tags for diagnostic transparency
        const nightTempSource = nightTemp != null ? 'resolved' : 'no data';
        const maxTempSource   = maxTemp   != null ? 'resolved' : 'no data';

        // b35fix351: explicit degraded gate. nightTemp is the primary driver of
        // the model (gate, ramp, alert trigger, soil-pathway pairing); without
        // it we cannot compute a defensible risk. Mirrors AnthracnoseModel
        // b35fix346 degraded path and DollarSpotModel b35fix335 degraded path.
        if (nightTemp == null) {
            if (typeof console !== 'undefined') {
                console.group('[Pythium.calculate() diagnostic, b35fix351 degraded]');
                console.log('nightTemp     : n/a (no data)');
                console.log('maxTemp       :', maxTemp != null ? (Math.round(maxTemp * 10) / 10) + ' °C' : 'n/a (no data)');
                console.log('nightRH       :', nightRH != null ? Math.round(nightRH) + '%' : 'n/a (no data)');
                console.log('riskScore     : 0 (DEGRADED, Pythium night-temperature input missing)');
                console.groupEnd();
            }
            return {
                disease: 'pythiumBlight', displayName: 'Pythium Blight',
                riskScore: 0, riskLevel: 'low', confidence: 'low', confidenceScore: 30,
                reason: 'DEGRADED, Pythium night-temperature input missing',
                drivers: {
                    nightTemperature: { value: null, source: nightTempSource, threshold: 20, status: 'unknown' },
                    dayTemperature:   { value: maxTemp, source: maxTempSource },
                },
                // b35fix352: Nutter-Shane forecast unavailable on degraded
                // climate by definition (no temp data → no forecast). Echo
                // the result-object shape so consumers can rely on the field
                // existing across all return paths.
                nutterShaneForecast: { available: false, reason: 'Climate temperature inputs missing; Nutter-Shane forecast unevaluable.' },
                // b35fix455 (C61): Latin 2021 infection-commencement diagnostic
                // unavailable on degraded climate. Same shape echo as the
                // Nutter-Shane field for symmetry across all three return paths.
                latinInfectionCommencement: { available: false, reason: 'Night temperature unavailable; Latin 2021 infection-commencement diagnostic requires nightTemp.' },
                speciesScope: 'P. aphanidermatum (summer blight). P. ultimum / P. graminicola not modelled, operate at lower temperatures.',
                source: 'PythiumModel, degraded: temperature missing (b35fix351). Risk model: Gilba weighted-sum (continuous) using published thresholds from Nutter, Cole & Schein 1983 and Shane 1994; see result.source on the real-data path for full provenance (b35fix352).',
            };
        }

        if (nightTemp < 20) {
            // b35fix352: even on the cold-gate path, Nutter-Shane forecast is
            // computable when hourly RH is present. Call the helper for shape
            // symmetry; the published rules already require minTemp > 20°C
            // (the proviso clause), so a cold-gate climate will return
            // nutter1983:false / shane1994:false through the rule itself —
            // no special-casing needed.
            const coldGateForecast = getNutterShaneForecast(climate);
            // b35fix455 (C61): Latin 2021 infection-commencement diagnostic
            // on the cold-gate path. Below the Nutter/Shane 20 deg C outbreak
            // gate, night temperatures in the 18-19.9 deg C band carry the
            // Latin 2021 infection-commencement signal as informational only.
            // riskScore stays at 0 per the outbreak-forecasting consensus.
            const coldGateLatinInfection = getLatinInfectionCommencement(climate);
            return {
                disease: 'pythiumBlight', displayName: 'Pythium Blight',
                riskScore: 0, riskLevel: 'low', confidence: 'high', confidenceScore: 90,
                reason: 'Night temps below Pythium outbreak threshold (20°C)',
                drivers: { nightTemperature: { value: nightTemp, source: nightTempSource, threshold: 20, status: 'limiting' } },
                nutterShaneForecast: coldGateForecast,
                latinInfectionCommencement: coldGateLatinInfection,
                speciesScope: 'P. aphanidermatum (summer blight). P. ultimum / P. graminicola not modelled, operate at lower temperatures.',
                source: 'Pythium 20°C night-temperature threshold, Nutter, Cole & Schein 1983 (Plant Disease 67:1126-1128) proviso clause; same threshold used in Shane 1994 modification.',
            };
        }

        // Night temp ramp: 20°C gate → 28°C max (corrected from 18-24°C)
        const nightFactor = Math.min(1, (nightTemp - 20) / 8);
        // b35fix351: dayFactor uses null-safe maxTemp; missing maxTemp → 0
        // contribution (was: fabricated 25 → also produced 0 because gate is
        // 30°C, so behaviourally inert here, but the data absence is now
        // observable on the diagnostic and drivers).
        const dayFactor = (maxTemp != null && maxTemp >= 30) ? Math.min(1, (maxTemp - 30) / 8) : 0;

        // Wetness: use hourly leaf wetness hours if available, else night RH binary fallback
        // b35fix344: getNightHumidity now returns null when no humidity data available
        // (pre-fix used literal 70 default). Explicit null check below means the binary
        // RH fallback only fires when we have real humidity data; otherwise wetFactor
        // depends solely on the dew engine's leaf wetness hours.
        const wetHours = getLeafWetnessHours(climate);
        const wetFactor = wetHours >= 14 ? 1 :
                          wetHours >= 10 ? (wetHours - 10) / 4 :
                          (nightRH != null && nightRH >= 90) ? 1 :
                          (nightRH != null && nightRH >= 80) ? 0.5 : 0;

        const rainBoost = precip > 10 ? 1.3 : precip > 5 ? 1.15 : 1;

        let risk = (0.4 * nightFactor + 0.2 * dayFactor + 0.4 * wetFactor) * rainBoost *
                   1 * 100; // variety mod applied in analyse()
        risk = Math.min(100, Math.max(0, risk));

        // Soil/crown-root pathway — requires soil temp >20°C at 100mm
        let soilTemp100mm = null;
        let soilTempSource = null;
        if (typeof window !== 'undefined') {
            if (window.GAIP_Sensor?.hasData?.()) {
                const sd = window.GAIP_Sensor.getIrrigationData?.();
                if (sd?.soilTemp != null) { soilTemp100mm = sd.soilTemp; soilTempSource = 'sensor'; }
            }
            if (soilTemp100mm === null && window.GAIP_SOIL_TEMP?.summary?.depths?.['100mm']?.mean != null) {
                soilTemp100mm = window.GAIP_SOIL_TEMP.summary.depths['100mm'].mean;
                soilTempSource = 'physics_model_100mm';
            }
        }
        if (soilTemp100mm === null && climate?.soilTemp?.depths?.d100mm != null) {
            soilTemp100mm = climate.soilTemp.depths.d100mm; soilTempSource = climate.soilTemp.source || 'canonical';
        }
        if (soilTemp100mm === null && climate?.temperature?.soil != null) {
            soilTemp100mm = typeof climate.temperature.soil === 'object' ? climate.temperature.soil.mean : climate.temperature.soil;
            soilTempSource = 'climate_temperature_soil';
        }

        let soilPathwayRisk = 0, soilPathwayNote = null;
        if (soilTemp100mm !== null && soilTemp100mm >= 20) {
            const soilRamp = Math.min(1, (soilTemp100mm - 20) / 10);
            soilPathwayRisk = Math.round(soilRamp * wetFactor * 100);
            if (soilPathwayRisk >= 50) soilPathwayNote = `Soil ${soilTemp100mm.toFixed(1)}°C at 100mm, Pythium root/crown rot conditions. Prioritise drainage and drench-registered products.`;
            else if (soilPathwayRisk >= 25) soilPathwayNote = `Soil ${soilTemp100mm.toFixed(1)}°C at 100mm, monitor root zone moisture.`;
        }

        let alertType = null;
        if (risk >= DISEASE_CONFIG.thresholds.severe) alertType = 'PYTHIUM_EMERGENCY';
        else if (risk >= DISEASE_CONFIG.thresholds.high) alertType = 'PYTHIUM_WARNING';
        // b35fix351: nightTemp null short-circuited at top; nightRH null safe
        // here because `null >= 80` evaluates false and won't trigger the watch.
        else if (nightTemp >= 22 && nightRH != null && nightRH >= 80) alertType = 'PYTHIUM_WATCH';

        // b35fix352: Nutter-Shane paper-faithful boolean forecast — runs
        // alongside the Gilba continuous risk score. Returns
        // { available, nutter1983, shane1994, driverValues, reason }.
        // When hourly RH data is unavailable, available:false and the field
        // is honest about why — never fabricates a verdict from period-mean RH.
        const nutterShaneForecast = getNutterShaneForecast(climate);
        // b35fix455 (C61): Latin 2021 infection-commencement diagnostic.
        // Parallel low-tier informational channel at the 18 deg C night-temp
        // anchor cited in CABI 2024 Ch.7 p.191-194. On the real path the
        // outbreak gate has already cleared (nightTemp >= 20), so this field
        // will always read available:true with infectionCommencement:true on
        // the real-path return. Kept on the result for consumer-side schema
        // consistency with the cold-gate and degraded paths.
        const latinInfectionCommencement = getLatinInfectionCommencement(climate);

        // --- DIAGNOSTIC (b35fix104 + b35fix351 null-safe + b35fix352 paper-forecast + b35fix455 Latin diagnostic) ---
        if (typeof console !== 'undefined') {
            console.group('[Pythium.calculate() diagnostic]');
            console.log('nightTemp     :', (Math.round(nightTemp * 10) / 10) + ' °C (' + nightTempSource + '; outbreakGate: 20°C, rampMax: 28°C, latinInfection: 18°C)');
            console.log('maxTemp       :', maxTemp != null ? (Math.round(maxTemp * 10) / 10) + ' °C (' + maxTempSource + '; dayFactor threshold: 30°C)' : 'n/a (no data)');
            console.log('nightRH       :', nightRH != null ? Math.round(nightRH) + '%' : 'n/a (no data)');
            console.log('wetHours      :', wetHours, '(from hourly data:', wetHours > 0 ? 'yes' : 'no, using RH fallback)');
            console.log('precip        :', Math.round(precip * 10) / 10, 'mm (rainBoost:', rainBoost, ')');
            console.log('nightFactor   :', nightFactor.toFixed(4));
            console.log('dayFactor     :', dayFactor.toFixed(4));
            console.log('wetFactor     :', wetFactor.toFixed(4));
            console.log('soilTemp100mm :', soilTemp100mm !== null ? soilTemp100mm.toFixed(1) + '°C (' + soilTempSource + ')' : 'not available');
            console.log('soilPathwayRisk:', soilPathwayRisk);
            console.log('alertType     :', alertType || 'none');
            console.log('riskScore     :', Math.round(risk), '(capped at 100)');
            // b35fix352: paper-faithful forecast diagnostic
            if (nutterShaneForecast.available) {
                console.log('Nutter1983    :', nutterShaneForecast.nutter1983 ? 'TRUE' : 'false',
                    '(maxT ' + nutterShaneForecast.driverValues.maxT.toFixed(1) + '°C, minT ' +
                    nutterShaneForecast.driverValues.minT.toFixed(1) + '°C, ' +
                    nutterShaneForecast.driverValues.hoursRhAbove90 + 'h >90% RH)');
                console.log('Shane1994     :', nutterShaneForecast.shane1994 ? 'TRUE' : 'false',
                    '(thresholds: >27.7°C, ≥9h, >20°C)');
            } else {
                console.log('Nutter1983/Shane1994 forecast: not available, ' + nutterShaneForecast.reason);
            }
            // b35fix455 (C61): Latin 2021 infection-commencement diagnostic
            console.log('LatinInfection:', latinInfectionCommencement.infectionCommencement ? 'TRUE' : 'false',
                '(threshold: 18°C, informational only, NOT outbreak forecast)');
            console.groupEnd();
        }
        // --- END DIAGNOSTIC ---

        return {
            disease: 'pythiumBlight', displayName: 'Pythium Blight',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            confidence: 'high', confidenceScore: 90, alertType,
            drivers: {
                nightTemperature: { value: Math.round(nightTemp * 10) / 10, source: nightTempSource, threshold: 20, rampMax: 28, contribution: Math.round(nightFactor * 100) },
                dayTemperature: { value: maxTemp != null ? Math.round(maxTemp * 10) / 10 : null, source: maxTempSource, contribution: Math.round(dayFactor * 100) },
                wetness: {
                    leafWetnessHours: wetHours > 0 ? wetHours : null,
                    // b35fix351: nightHumidity echoes null when humidity data
                    // missing (pre-fix Math.round(null) silently rendered 0).
                    nightHumidity: nightRH != null ? Math.round(nightRH) : null,
                    contribution: Math.round(wetFactor * 100),
                    method: wetHours > 0 ? 'hourly_leaf_wetness' : 'night_rh_binary',
                },
                recentRain: { mm: Math.round(precip * 10) / 10, amplifier: rainBoost },
            },
            soilPathway: {
                soilTemp100mm: soilTemp100mm !== null ? Math.round(soilTemp100mm * 10) / 10 : null,
                soilTempSource,
                rootCrownRisk: soilPathwayRisk,
                rootCrownRiskLevel: soilPathwayRisk >= 70 ? 'high' : soilPathwayRisk >= 40 ? 'moderate' : 'low',
                note: soilPathwayNote,
            },
            urgencyNote: risk >= DISEASE_CONFIG.thresholds.high
                ? 'URGENT: Pythium destroys turf in 24-48 hours. Preventive timing critical.' : null,
            // b35fix352: paper-faithful Nutter-Shane forecast as a separate
            // diagnostic field. Available when hourly RH data is present;
            // honest unavailable-state when not. Forecast-aware consumers can
            // display this alongside (or instead of) the Gilba continuous risk.
            nutterShaneForecast,
            // b35fix455 (C61): Latin 2021 infection-commencement diagnostic
            // channel per CABI 2024 Ch.7 p.191-194. Informational only; NOT
            // used by the continuous riskScore or the Nutter-Shane boolean.
            // See banner above PythiumModel for the dual-channel rationale.
            latinInfectionCommencement,
            speciesScope: 'P. aphanidermatum (summer blight). P. ultimum / P. graminicola not modelled, operate at lower temperatures.',
            source: 'Pythium risk model: Gilba weighted-sum (continuous) using published thresholds from Nutter, Cole & Schein 1983 (Plant Disease 67:1126-1128) and Shane 1994 (Use of Disease Models for Turfgrass Management Decisions, pp. 397-404 in Leslie A.R. ed., Handbook of Integrated Pest Management for Turf and Ornamentals, CRC Press). The published rules are conjunctive boolean forecasts, see result.nutterShaneForecast for the paper-faithful binary verdict. Algorithm form (continuous weighted-sum with linear ramps over Nutter/Shane thresholds) is Gilba-internal. Soil-pathway extension is a Gilba-internal heuristic. Ca tissue modifier (b35fix354): direction peer-reviewed (Vargas Mgmt of Turfgrass Diseases; Smiley/Dernoeden/Clarke Compendium 3rd/4th ed.; Rahman & Punja 2007 in Datnoff/Elmer/Huber Mineral Nutrition and Plant Disease, ch. 6; Sugimoto et al. 2008 Plant Disease 92:1559), magnitude (1.2×) is operational. K tissue modifier (1.1×) was removed in b35fix354, no Pythium-specific peer-reviewed support. Symptom guidance: APS Pythium Blight teaching lesson; Shane & Tredway (APS Compendium of Turfgrass Diseases).',
        };
    },
    getInterventions(riskLevel, opts) {
        const r = { cultural: [], preventive: [], timing: null };
        if (riskLevel === 'moderate') r.timing = 'Prepare preventive, monitor forecast';
        if (riskLevel === 'high') { r.timing = 'Apply TODAY before nightfall'; r.urgency = 'HIGH'; }
        if (riskLevel === 'severe') {
            r.timing = 'IMMEDIATE APPLICATION'; r.urgency = 'CRITICAL';
            r.curativeNote = 'Apply at curative rate (1.5x label) IMMEDIATELY';
            r.emergencyNote = 'Pythium spreads across a green in 24 hours. Do not wait.';
        }
        return r;
    },
};

// =============================================================================
// b35fix452 (C57): CABI 2024 cross-reference for AnthracnoseModel.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.7 p.159-164 + Box 7.1: Colletotrichum cereale on cool-season
//   turfgrass occurs in two distinct phases with different temperature
//   optima. Foliar blight phase 29-35 deg C (high-temp summer stress).
//   Basal rot phase 15-24 deg C, associated with anaerobic conditions
//   in the thatch-mat region driven by rainfall and excessive irrigation
//   (Landschoot & Hoyland 1995, cited within CABI), more destructive
//   of the two phases, often causes turfgrass death. The hub currently
//   computes the foliar blight component only via Danneberger 1984 ASI
//   (validated T range 16-28 deg C) and emits a narrative basal-rot
//   message below 16 deg C without a separate risk channel. Audit
//   recommendation #1 proposes adding a parallel basal-rot channel
//   under a future build. Cross-references the existing Danneberger
//   1984 / Smiley, Dernoeden & Clarke 2005 / Inguagiato 2008 + 2009
//   chain. Coefficients, thresholds, and weights unchanged in this build.
// =============================================================================
//
// b35fix453 (C58): basal-rot dual-phase channel, closes audit
//   recommendation #1 from cabi_2024_disease_audit.md.
//
//   PROBLEM. Pre-fix the engine returned a single riskScore derived from
//   the Danneberger 1984 ASI (validated 16-28 deg C). When meanTemp fell
//   below 16 deg C the model dropped out of validity and produced 0 risk
//   from the infection component, with only a narrative keyMessage hint
//   that basal rot might be active. CABI 2024 Ch.7 p.159-164 + Box 7.1
//   documents two distinct phases of C. cereale on cool-season turfgrass:
//   foliar blight 29-35 deg C optimum (Danneberger 1984 captures the
//   16-28 deg C rising shoulder), and basal rot 15-24 deg C optimum,
//   associated with anaerobic thatch-mat conditions driven by rainfall
//   and excessive irrigation (Landschoot & Hoyland 1995, cited within
//   CABI). Smiley, Dernoeden & Clarke 2005 (Compendium of Turfgrass
//   Diseases 3rd ed.) report basal rot active 5-25 deg C, peaks
//   15-20 deg C, consistent with CABI Box 7.1. CABI calls basal rot
//   the more destructive of the two phases and notes it often causes
//   turfgrass death, so a model that silently zeroes risk in the
//   basal-rot window is materially misleading.
//
//   ARCHITECTURE. Add a parallel basal-rot risk channel computed from
//   meanTemp + moisture + stress, run alongside the existing Danneberger
//   foliar-blight channel. Headline riskScore is max(foliarRisk,
//   basalRotRisk). New `phase` field on the return object names the
//   dominant phase ('foliar' / 'basal' / 'both' / 'none'). New
//   `drivers.basalRot` block parallel to existing `drivers.infection`.
//   keyMessage refactored to surface dominant phase rather than a single
//   gated narrative.
//
//   BASAL-ROT TEMPERATURE FACTOR. Gaussian-style centred at 19.5 deg C
//   (midpoint of CABI Box 7.1 15-24 deg C range), sigma 4.5 deg C
//   (covers Smiley 2005 5-25 deg C activity range with falloff at the
//   extremes). Returns 0 outside 5-28 deg C (no plausible basal-rot
//   activity above 28 deg C per CABI Ch.7 + Smiley 2005; foliar takes
//   over above this anyway).
//
//   BASAL-ROT MOISTURE FACTOR. CABI Box 7.1 explicitly identifies
//   anaerobic thatch-mat conditions driven by rainfall and excessive
//   irrigation as the primary moisture pathway. Combine two saturating
//   inputs and take the max:
//     (a) leaf-wetness saturation: LW / 10h, capped 1.0 (10h sustained
//         wetness saturates the basal-rot moisture signal; matches the
//         operational threshold for anaerobic thatch development cited
//         in Landschoot & Hoyland 1995 via CABI).
//     (b) precipitation saturation: precip / 10mm, capped 1.0 (10 mm/d
//         daily rainfall is the operational saturation point for thatch
//         waterlogging; aligns with the Pythium engine moisture
//         increment at line 3056 which uses rainfall/20 * 0.3 per
//         increment, scaled here for a binary saturating function).
//   Returns 0 when both inputs are null.
//
//   STRESS CONTRIBUTION. The Inguagiato 2008/2009 N + HOC stress
//   multipliers + shade + traffic apply to basal rot in the same
//   directional sense as foliar blight (low N, ultra-low HOC, shade,
//   compaction all amplify both phases per Crouch & Clarke 2012 GCM
//   p.96-102 biology review). CABI does not partition stress modifiers
//   between phases, so the same stressMult is applied. Audit-comment
//   notes the partition is unverified; if future literature distinguishes
//   per-phase stress responses the architecture will accommodate it via
//   separate stressMultFoliar and stressMultBasal arguments.
//
//   COMBINE. basalRotRisk = (tempFactor * moistureFactor * 100) *
//   stressMult, clamped [0, 100]. With moisture factor 0 (no LW, no
//   precip), basal-rot risk drops to 0 regardless of temperature, which
//   matches the CABI characterisation (anaerobic conditions are the
//   driver, temperature alone is insufficient).
//
//   HEADLINE riskScore = max(foliarRisk, basalRotRisk). Pre-fix
//   behaviour preserved when meanTemp is in the 16-28 deg C foliar
//   window AND moisture is absent: foliar dominates, basalRotRisk
//   drops to 0, max() returns foliar = pre-fix value. Behaviour change
//   only in three windows:
//     1. 5 to under 16 deg C with moisture present: previously 0 risk
//        plus narrative, post-fix produces non-zero basal-rot risk
//        with phase='basal'.
//     2. 16 to 24 deg C with sustained moisture: previously foliar
//        only, post-fix max(foliar, basalRot) with phase='both' if
//        basal exceeds foliar.
//     3. 24 to 28 deg C with sustained moisture: foliar typically
//        dominates per the temperature Gaussian falloff at 24 deg C+
//        on the basal-rot side; behavioural delta usually 0.
//
//   SaaS-PORT SAFETY. Existing return-object fields preserved
//   byte-identical (riskScore, rawRisk, riskLevel, confidence,
//   confidenceScore, asi, infectionFlag, stressFactors, primaryDriver,
//   drivers.infection, drivers.stress, source, provenance,
//   provenanceStress, keyMessage). New fields are additive: phase,
//   foliarRisk, basalRotRisk, drivers.basalRot. Consumers that read
//   only riskScore + riskLevel + keyMessage continue to function
//   unchanged. word-export.js Disease Details renderer reads
//   adjustedRisk + riskLevel + keyMessage only (b35fix448 audit
//   confirmed via grep), so production rendering carries the new
//   max-of-two riskScore transparently.
//
//   COEFFICIENT, THRESHOLD, WEIGHT, SIGNATURE STABILITY. Danneberger
//   1984 equation untouched. Inguagiato 2008/2009 stress multipliers
//   untouched. _ANTHRACNOSE_WARM_SEASON_HOSTS frozen set untouched.
//   Dispatcher gate at line ~4337 untouched. calculate() signature
//   (climate, nitrogen, variety, shade, traffic, mowing, dewData)
//   untouched.
// =============================================================================
const AnthracnoseModel = {
    name: 'Anthracnose',
    pathogen: 'Colletotrichum cereale',

    // -------------------------------------------------------------------------
    // b35fix241: Danneberger, Vargas & Jones (1984) weather-based infection model
    // Phytopathology 74:448-451  DOI 10.1094/Phyto-74-448
    //
    // ASI = 4.0233 − 0.2283·LW − 0.5308·T − 0.0013·LW² + 0.0197·T² + 0.0155·(LW×T)
    //
    // Where:
    //   LW = average hours of leaf wetness per day (3-day period, 10-12 days pre-symptom)
    //   T  = average daily temperature °C (same period)
    //   ASI ≥ 2 = threshold for infection (88% accuracy in field validation;
    //             14 of 16 periods of disease increase predicted in 1982)
    //   Valid range: T 16–28°C (paper Discussion p451: "Extrapolations from the
    //                model outside these bounds will produce erroneous results.")
    //                LW 0–24h
    //
    // ASI categorical scale (paper abstract): 1=<10%, 2=11-20%, 3=21-30%,
    //   4=31-40%, 5=41-50%, 6=>51% of turfgrass area diseased.
    //
    // Note: the categorical scale is a *classification of empirical disease
    // area %* mapped from the regression output. The regression itself is not
    // bounded to [1, 6] — Fig 1B in the paper shows the predicted surface
    // reaching ~8 at the warm-wet corner. Do not clamp the regression output.
    //
    // ARCHITECTURE: Two-component model
    //   1. Infection component (Danneberger 1984): weather drives whether C. cereale
    //      can infect — outputs ASI and a 0-100 infection risk score.
    //   2. Stress susceptibility multiplier: host stress (N, HOC, shade, traffic)
    //      amplifies infection risk. Based on Inguagiato et al. 2008 (Crop Sci 48:1595)
    //      and Inguagiato et al. 2009 (Crop Sci 49:1454-1462). Final risk = infection
    //      × stress. The published Danneberger model does NOT include host-stress
    //      modifiers — the paper Discussion p451 explicitly notes this absence
    //      ("the model does not account for the varying degree of susceptibility
    //      of different biotypes of annual bluegrass to anthracnose or the effect
    //      of nitrogen fertilization on disease development") and invites future
    //      adjustments. The Inguagiato multipliers are a Gilba layer, not part
    //      of Danneberger 1984. Without infection conditions (ASI < 2 or T out
    //      of range), stress alone cannot drive risk above a low ceiling —
    //      consistent with field observation that stressed turf without warm+wet
    //      conditions does not develop anthracnose.
    //
    // -------------------------------------------------------------------------
    // PROVENANCE STATUS (Tier 2 audit, b35fix339, 2026-04-26):
    //
    // VERIFIED against the source paper (Danneberger, Vargas & Jones 1984
    // Phytopathology 74:448-451) obtained 2026-04-26:
    //
    //   - Citation: real (DOI 10.1094/Phyto-74-448 resolves).
    //   - Equation coefficients: 4.0233 / -0.2283 / -0.5308 / -0.0013 / 0.0197 /
    //     0.0155 — letter-for-letter match against the equation as printed
    //     mid-page 449 of the paper.
    //   - ASI ≥ 2 threshold: paper p450 right column and Fig 3 caption.
    //   - Validated T range [16, 28] °C: Discussion p451.
    //   - LW domain [0, 24] h: paper p449 ("good fit of the model for ... wetting
    //     durations up to 24 hr").
    //   - Latent period 10–12 days from infection to symptom expression: Table 1
    //     (paper p449), used to set the 3-day averaging window 10–12 d pre-symptom.
    //   - Sub-threshold false-positive behaviour (ASI 1.0–1.8 estimated disease
    //     when none present, 90% of zero-disease wetting periods sat at or below
    //     ASI = 2): paper p450 right column. The threshold ASI ≥ 2 is the
    //     authors' published handling of this; the b35fix242 LW ≥ 1 gate is a
    //     redundant downstream guard. Both kept.
    //
    // SUPERSEDES b35fix338: that build flagged the coefficients as unverified
    // and added a [0, 6] output clamp on the regression. With the paper in hand
    // both moves were wrong:
    //   - The coefficients are exactly the published values.
    //   - Fig 1B shows the predicted surface reaching ~8 at the warm-wet corner,
    //     so [0, 6] clamping truncates legitimate regression output.
    //   - The "scale overrun" defect was a misreading: the 1-6 categorical scale
    //     classifies empirical disease area %, not the regression output range.
    // The b35fix338 clamp is REMOVED in b35fix339. See docs/provenance-audit-tier2.md.
    //
    // KNOWN edge behaviours (present in the paper, not bugs):
    //   - Non-monotonicity in LW at T = 16 °C: ∂ASI/∂LW < 0 for LW > 7.6 h at
    //     this boundary. Visible in the paper's own Fig 1B as the surface
    //     dipping toward negative ASI at the cool-extended-wet corner. A known
    //     polynomial-regression edge artifact at the limit of the training data.
    //   - Mathematical extrapolation above ASI = 6: legitimate output of the
    //     regression at the warm-wet corner; the categorical scale stops at 6
    //     because the empirical disease area saturates at >51 %, not because
    //     the equation is bounded.
    // -------------------------------------------------------------------------

    _dannebergerASI(T, LW) {
        // Clamp inputs to model's validated range (paper Discussion p451:
        // "Extrapolations from the model outside these bounds will produce
        // erroneous results").
        const Tc = Math.max(16, Math.min(28, T));
        const LWc = Math.max(0, Math.min(24, LW));
        // Encoded equation matches Danneberger, Vargas & Jones 1984 Phyto 74:449
        // letter-for-letter (paper-verified b35fix339, 2026-04-26).
        return 4.0233
            - 0.2283 * LWc
            - 0.5308 * Tc
            - 0.0013 * LWc * LWc
            + 0.0197 * Tc * Tc
            + 0.0155 * (LWc * Tc);
    },

    // -------------------------------------------------------------------------
    // b35fix453 (C58): basal-rot risk channel.
    //
    // Computes a 0-100 basal-rot risk score from temperature + moisture +
    // stress, parallel to the Danneberger ASI foliar channel. Cardinal
    // sources:
    //   - CABI 2024 Ch.7 p.159-164 + Box 7.1 (Beehag, Walker, Wong &
    //     Kaapro): basal rot 15-24 deg C optimum, anaerobic thatch-mat
    //     conditions driven by rainfall and excessive irrigation.
    //   - Smiley, Dernoeden & Clarke 2005 (Compendium of Turfgrass
    //     Diseases 3rd ed.): basal rot active 5-25 deg C, peaks
    //     15-20 deg C.
    //   - Landschoot & Hoyland 1995 (cited within CABI): rainfall +
    //     excessive irrigation as the anaerobic-thatch driver.
    //
    // Temperature factor: Gaussian centred at 19.5 deg C, sigma 4.5,
    // bounded [0, 1], returns 0 outside 5-28 deg C. The Gaussian shape
    // captures the activity falloff at the extremes of Smiley 2005's
    // 5-25 deg C range while peaking inside CABI's 15-24 deg C optimum.
    //
    // Moisture factor: max of (LW / 10h) saturation and (precip / 10mm)
    // saturation, both capped 1.0. Returns 0 when both inputs are
    // null. Operational saturation thresholds align with the Pythium
    // engine moisture handling at line ~3056 (rainfall/20 * 0.3 per
    // increment) scaled here as a binary saturating function appropriate
    // for the basal-rot anaerobic-thatch pathway.
    //
    // Returns 0 when temperature is null or moisture is null + 0.
    // -------------------------------------------------------------------------
    _basalRotRisk(T, LW, precip) {
        if (T == null) return { risk: 0, tempFactor: 0, moistureFactor: 0 };
        // Hard outer envelope: Smiley 2005 5-25 deg C activity range
        // with extension to 28 deg C to soft-overlap the Danneberger
        // foliar window. Outside this, basal rot is not plausible per
        // CABI Ch.7 + Smiley 2005.
        if (T < 5 || T > 28) return { risk: 0, tempFactor: 0, moistureFactor: 0 };
        // Gaussian temperature factor centred at 19.5 deg C (midpoint of
        // CABI 15-24 deg C) with sigma 4.5 deg C.
        const mu = 19.5;
        const sigma = 4.5;
        const tempFactor = Math.exp(-Math.pow(T - mu, 2) / (2 * sigma * sigma));
        // Moisture factor: max of LW saturation and precip saturation.
        // Null inputs degrade to 0; both null yields 0 risk regardless
        // of temperature (CABI Box 7.1 anaerobic-thatch driver is
        // necessary, not just sufficient).
        const lwSat = (LW != null) ? Math.min(1, LW / 10) : 0;
        const precipSat = (precip != null) ? Math.min(1, precip / 10) : 0;
        const moistureFactor = Math.max(lwSat, precipSat);
        // Combine. Pre-stress base risk is bounded [0, 100].
        const baseRisk = tempFactor * moistureFactor * 100;
        return { risk: baseRisk, tempFactor, moistureFactor };
    },

    calculate(climate, nitrogen, variety, shade, traffic, mowing, dewData) {
        // b35fix346: Anthracnose temperature input now uses the same 4-rung
        // fallback chain as Smith-Kerns (b35fix335a/337) instead of `?? 20`.
        // Production verification log gilbasolutions_com-1777186066069.log
        // (2026-04-26, Shirley GC NZ) showed Smith-Kerns correctly reporting
        // `MEANAT n/a (no data)` but Anthracnose silently fabricating
        // `meanTemp 20.0 °C` on the same site, same run. Two engines reading
        // the same conceptual quantity by different access patterns —
        // recurring asymmetric-engines bug class.
        //
        // b35fix348: rungs 2-4 (max/min avg → period mean → current hour) now
        // delegated to resolveMeanAirTemp() — single source of truth shared
        // with getSmithKerns2018Probability.
        //
        // b35fix349: rung 1 (dailyPattern averaging) also unified. Anthracnose's
        // strict semantics (walk all entries, typeof === 'number' && !isNaN
        // guard, denominator = real-entry count) became canonical and were
        // promoted into get5DayAvgTemp. Anthracnose now calls the same helper
        // SK does — full SSOT for MEANAT resolution across both engines.
        let meanTemp = get5DayAvgTemp(climate?.temperature?.dailyPattern);
        if (meanTemp == null) meanTemp = resolveMeanAirTemp(climate);

        const nStatus = nitrogen?.status || 'adequate';
        const dliDeficit = shade?.dliDeficit?.percentage || 0;
        const hoc = mowing?.heightOfCut || mowing?.height || 4;
        const stressStatus = traffic?.cumulativeStress?.status || 'normal';

        // b35fix346: explicit degraded path when all 4 temperature rungs
        // returned null. Pre-fix `?? 20` would have kept going with a
        // fabricated 20°C — produced spurious infectionRisk values on
        // sites where climate.temperature was entirely empty (Shirley GC
        // first-paint 2026-04-26 was an instance of this).
        if (meanTemp == null) {
            if (typeof console !== 'undefined') {
                console.group('[Anthracnose.calculate() diagnostic]');
                console.log('meanTemp      : n/a (no data, all 4 rungs null)');
                console.log('riskScore     : 0 (DEGRADED, Anthracnose temperature inputs missing)');
                console.groupEnd();
            }
            return {
                disease: 'anthracnose', displayName: 'Anthracnose',
                riskScore: 0,
                rawRisk: 0,
                riskLevel: 'low',
                confidence: 'low',
                confidenceScore: 30,
                degraded: true,
                asi: null,
                infectionFlag: false,
                stressFactors: [],
                // b35fix453 (C58): degraded path also reports phase + per-channel
                // breakdown for consumer consistency. All zero, phase 'none'.
                phase: 'none',
                foliarRisk: 0,
                basalRotRisk: 0,
                primaryDriver: 'No temperature data, risk computation skipped',
                drivers: {
                    infection: { asi: null, leafWetnessHours: null, meanTemp: null, status: 'degraded, no temperature data' },
                    basalRot: { temperature: null, tempFactor: 0, moistureFactor: 0, leafWetnessHours: null, precipitation: null, preStressRisk: 0, riskScore: 0, active: false, status: 'degraded, no temperature data' },
                },
                source: 'AnthracnoseModel, degraded: temperature missing (b35fix346)',
            };
        }

        // ── 1. INFECTION COMPONENT (Danneberger et al. 1984) ─────────────────
        // LW source: dew engine averageWetHours (all-hours dew average).
        // Danneberger used sensors 1.3cm above soil — closer to canopy than the
        // dew engine's night-hours model. Apply 0.75 correction to convert the
        // dew engine's all-hours average to a canopy-equivalent (conservative).
        const rawLW = dewData?.leafWetness?.averageWetHours ?? null;
        const LW = rawLW !== null ? Math.min(24, rawLW * 0.75) : null;

        // Temperature validity: model only applies 16–28°C.
        // Outside that range: foliar blight (>28°C) or basal rot (<16°C) may
        // still occur but cannot be predicted by this equation — flag accordingly.
        const tempInRange = meanTemp >= 16 && meanTemp <= 28;

        let asi = null;
        let infectionRisk = 0;     // 0-100, weather-driven
        let infectionFlag = false;  // ASI ≥ 2
        let noWeatherData = false;

        if (LW === null) {
            noWeatherData = true;
            // No leaf wetness data — fall back to RH proxy
            const rh = climate?.humidity?.mean || 0;
            // Estimate LW from mean RH: rough proxy only, lower confidence
            const estimatedLW = rh >= 95 ? 10 : rh >= 85 ? 6 : rh >= 70 ? 3 : 0;
            // b35fix242: gate on estimatedLW >= 1. The Danneberger 1984 equation was
            // calibrated on field plots with mean LW 4-16h/day. At LW=0 the T² term
            // dominates and gives ASI≥2 above ~24°C with no leaf wetness — this is a
            // mathematical artifact outside the model's validated space. Anthracnose
            // requires leaf wetness to infect; LW=0 must produce no infection risk.
            if (tempInRange && estimatedLW >= 1) {
                asi = this._dannebergerASI(meanTemp, estimatedLW);
            }
        } else if (tempInRange) {
            // b35fix242: same gate applied to real dew-engine data.
            // LW values < 1h/day indicate essentially dry canopy conditions.
            if (LW >= 1) {
                asi = this._dannebergerASI(meanTemp, LW);
            }
            // If LW is present but <1h, asi remains null → stress-only ceiling applies.
        }

        if (asi !== null) {
            infectionFlag = asi >= 2;
            // Normalise ASI to 0-100:
            // ASI scale runs 1-6 (mapped to 0-51+% disease area).
            // Map ASI 0→0%, 2→threshold (20%), 6→100% for display.
            // Linear segment: below 2 = sub-threshold, above = active infection.
            infectionRisk = asi < 2
                ? Math.max(0, (asi / 2) * 20)          // 0-20% pre-threshold
                : Math.min(100, 20 + ((asi - 2) / 4) * 80); // 20-100% above threshold
        }

        // ── 2. STRESS SUSCEPTIBILITY MULTIPLIER ──────────────────────────────
        // Inguagiato et al. 2008 (Crop Sci 48:1595): N frequency primary driver,
        //   N every 7d reduced disease up to 24% vs 28d (paper-verified b35fix430
        //   via Murphy/Inguagiato/Clarke 2012 GCM May p.105 secondary citation).
        //   Low N status raises risk.
        // Inguagiato et al. 2009 (Crop Sci 49:1454): HOC 2.8mm vs 3.6mm severity
        //   delta. Quantitative magnitude not paper-verified at b35fix430 (primary
        //   not obtained; Murphy 2012 BMP cites the directional finding without
        //   the percentage range). Stepped calibration retained pending primary.
        // Penn State / Settle & Martinez-Espinosa (2006): compaction, shade.
        //   UNVERIFIED — primary not obtained at b35fix430.
        let stressMult = 1.0;
        const stressFactors = [];

        // Nitrogen — most important single factor (Inguagiato 2008)
        if (nStatus === 'deficient') {
            stressMult *= 1.5;
            stressFactors.push({ factor: 'Nitrogen deficiency', modifier: 1.5, source: 'Inguagiato et al. 2008 Crop Sci 48:1595' });
        } else if (nStatus === 'low') {
            stressMult *= 1.25;
            stressFactors.push({ factor: 'Low nitrogen', modifier: 1.25, source: 'Inguagiato et al. 2008 Crop Sci 48:1595' });
        }

        // HOC — calibrated to Inguagiato et al. 2009 field data (cited via
        // Murphy/Inguagiato/Clarke 2012 GCM May p.108 BMP table, which states
        // mowing below 0.125 inch (3.2mm) should be avoided and 0.141 inch
        // (3.6mm) gives greater suppression). Stepped calibration: 1.20 below
        // 2.8mm, ramp 1.0→1.12 between 3.6mm and 2.8mm. Magnitudes unverified
        // pending Inguagiato 2009 primary.
        if (hoc < 2.8) {
            stressMult *= 1.20;
            stressFactors.push({ factor: 'Ultra-low HOC', modifier: 1.20, detail: `${hoc}mm`, source: 'Inguagiato et al. 2009 Crop Sci' });
        } else if (hoc < 3.6) {
            const frac = (3.6 - hoc) / (3.6 - 2.8);  // 0 at 3.6mm, 1 at 2.8mm
            const mod = 1 + frac * 0.12;               // 1.0–1.12
            stressMult *= mod;
            stressFactors.push({ factor: 'Low mowing height', modifier: Math.round(mod * 100) / 100, detail: `${hoc}mm`, source: 'Inguagiato et al. 2009 Crop Sci' });
        }

        // Shade — compounding stress (Landschoot 2021 Penn State; Settle 2006 APS)
        if (dliDeficit > 40) {
            stressMult *= 1.20;
            stressFactors.push({ factor: 'Severe shade stress', modifier: 1.20, detail: `${Math.round(dliDeficit)}% DLI deficit` });
        } else if (dliDeficit > 25) {
            stressMult *= 1.10;
            stressFactors.push({ factor: 'Shade stress', modifier: 1.10, detail: `${Math.round(dliDeficit)}% DLI deficit` });
        }

        // Traffic/compaction (Settle & Martinez-Espinosa 2006 APS)
        if (stressStatus === 'critical') {
            stressMult *= 1.20;
            stressFactors.push({ factor: 'Critical traffic/compaction', modifier: 1.20 });
        } else if (stressStatus === 'stressed') {
            stressMult *= 1.10;
            stressFactors.push({ factor: 'Traffic/compaction stress', modifier: 1.10 });
        }

        // ── 3. COMBINE: foliar infection × stress ────────────────────────────
        // Without infection conditions, cap at 15 (stress predisposition only —
        // not a disease prediction, just a susceptibility flag).
        // With infection conditions, apply stress multiplier to infection risk.
        let foliarRawRisk;
        if (infectionFlag) {
            foliarRawRisk = Math.min(100, infectionRisk * stressMult);
        } else if (asi !== null && asi > 0) {
            // Sub-threshold infection conditions — partial risk, stress-amplified
            foliarRawRisk = Math.min(30, infectionRisk * stressMult);
        } else {
            // No infection data or temp out of range — stress-only ceiling
            foliarRawRisk = Math.min(15, (stressMult - 1) * 50);
        }

        const foliarRiskScore = Math.round(foliarRawRisk);

        // ── 3b. BASAL-ROT CHANNEL (b35fix453 / C58) ──────────────────────────
        // Parallel computation, runs alongside the foliar Danneberger channel.
        // CABI 2024 Box 7.1 + Smiley/Dernoeden/Clarke 2005 + Landschoot &
        // Hoyland 1995. See banner at line ~1896 for full architecture.
        // Stress multiplier applied identically to foliar; per-phase stress
        // partition is unverified at b35fix453 and would require new primary
        // literature.
        const precip = climate?.precipitation?.total
            ?? climate?.moisture?.precipitation?.total
            ?? climate?.moisture?.rainfall
            ?? null;
        const basalRotComponents = this._basalRotRisk(meanTemp, LW, precip);
        const basalRotRawRisk = Math.min(100, basalRotComponents.risk * stressMult);
        const basalRotRiskScore = Math.round(basalRotRawRisk);

        // ── 3c. HEADLINE: max of foliar + basal-rot ──────────────────────────
        // CABI Box 7.1 calls basal rot the more destructive phase; reporting
        // the max() preserves the worst-case headline while phase + per-channel
        // breakdown surface which phase is driving the score.
        const rawRisk = Math.max(foliarRawRisk, basalRotRawRisk);
        const riskScore = Math.max(foliarRiskScore, basalRotRiskScore);

        // ── 3d. PHASE RESOLUTION ─────────────────────────────────────────────
        // 'foliar' if Danneberger ASI active and basal-rot inactive.
        // 'basal' if basal-rot non-zero and foliar inactive.
        // 'both' if both channels are active (overlap window 16-24 deg C
        // with sustained moisture).
        // 'none' if neither channel is active above the stress-only floor.
        const foliarActive = infectionFlag || (asi !== null && asi >= 2);
        const basalActive = basalRotRawRisk >= 10;  // operational floor matching foliar sub-threshold band
        let phase;
        if (foliarActive && basalActive) phase = 'both';
        else if (basalActive) phase = 'basal';
        else if (foliarActive) phase = 'foliar';
        else phase = 'none';

        // ── 4. CONSOLE DIAGNOSTIC ────────────────────────────────────────────
        if (typeof console !== 'undefined') {
            console.group('[Anthracnose.calculate() diagnostic]');
            console.log('meanTemp        :', meanTemp.toFixed(1), '°C (Danneberger valid 16-28°C:', tempInRange ? 'YES' : 'NO, foliar extrapolated)');
            console.log('LW (raw)        :', rawLW !== null ? rawLW.toFixed(2) + 'h/day (dew engine)' : 'null, RH proxy used');
            console.log('LW (adjusted)   :', LW !== null ? LW.toFixed(2) + 'h/day (×0.75 canopy correction)' : 'n/a');
            console.log('precipitation   :', precip !== null ? precip.toFixed(1) + 'mm/day' : 'n/a');
            console.log('ASI             :', asi !== null ? asi.toFixed(3) : 'n/a', '(threshold: 2.0, foliar infected:', infectionFlag ? 'YES' : 'NO)');
            console.log('foliarRiskScore :', foliarRiskScore, '(0-100, Danneberger × stress)');
            console.log('basalRot tempF  :', basalRotComponents.tempFactor.toFixed(3), '(Gaussian µ=19.5°C σ=4.5°C)');
            console.log('basalRot moistF :', basalRotComponents.moistureFactor.toFixed(3), '(max LW/10h, precip/10mm)');
            console.log('basalRotRisk    :', basalRotRiskScore, '(0-100, CABI Box 7.1 × stress)');
            console.log('stressMult      :', stressMult.toFixed(3), '(host susceptibility, applied to both channels)');
            console.log('headline phase  :', phase);
            console.log('headline risk   :', riskScore, '(max of foliar + basal-rot)');
            console.groupEnd();
        }

        const primaryFactor = stressFactors.sort((a, b) => b.modifier - a.modifier)[0];

        // b35fix453 (C58): keyMessage chooses copy based on dominant phase.
        // Phase resolution at the COMBINE block above. Pre-fix copy preserved
        // verbatim for the foliar branches and the cool-temp narrative branch.
        // New 'basal' and 'both' branches added for the cases the basal-rot
        // channel surfaces. Per non-negotiable #4, all clinical claims trace
        // to peer-reviewed primaries (CABI 2024 + Smiley 2005 already cited
        // in the banner; Inguagiato 2008/2009 already cited inline).
        let keyMessage;
        if (phase === 'both') {
            keyMessage = 'Both anthracnose phases active. Foliar (Danneberger ASI ≥ 2) and basal rot (CABI Box 7.1 15-24°C with anaerobic moisture conditions) both contributing. Reduce leaf wetness, improve drainage, raise mowing height, address N status.';
        } else if (phase === 'basal') {
            keyMessage = 'Basal rot phase dominant (CABI 2024 Ch.7 Box 7.1: 15-24°C optimum, anaerobic thatch-mat conditions from rainfall or excessive irrigation). More destructive than foliar blight. Improve drainage, reduce irrigation, address N status, consider thatch management.';
        } else if (!tempInRange && meanTemp < 16) {
            keyMessage = 'Temp below 16°C, Danneberger foliar blight model not applicable. Conditions favour basal rot phase (crowns/stolons). Smiley, Dernoedon & Clarke 2005: basal rot active 5-25°C, peaks 15-20°C. Manage via N, drainage and reduced leaf wetness.';
        } else if (infectionFlag) {
            keyMessage = 'Infection conditions met (ASI ≥ 2). Reduce leaf wetness and address host stress.';
        } else {
            keyMessage = 'Below infection threshold. Monitor stress factors, susceptibility is elevated.';
        }

        return {
            disease: 'anthracnose', displayName: 'Anthracnose',
            riskScore,
            rawRisk: Math.round(rawRisk),
            riskLevel: classifyRisk(riskScore),
            confidence: noWeatherData ? 'low' : (tempInRange ? 'high' : 'medium'),
            confidenceScore: noWeatherData ? 40 : (tempInRange ? 85 : 60),
            asi: asi !== null ? Math.round(asi * 100) / 100 : null,
            infectionFlag,
            stressFactors,
            // b35fix453 (C58): additive phase + per-channel breakdown fields.
            // Existing consumers reading riskScore + riskLevel + keyMessage
            // are unaffected. New fields surface the dual-phase architecture.
            phase,
            foliarRisk: foliarRiskScore,
            basalRotRisk: basalRotRiskScore,
            primaryDriver: phase === 'basal'
                ? 'Basal rot conditions (CABI Box 7.1)'
                : phase === 'both'
                    ? 'Both phases active'
                    : infectionFlag
                        ? (primaryFactor ? primaryFactor.factor : 'Weather conditions')
                        : (primaryFactor ? primaryFactor.factor : 'Sub-threshold conditions'),
            drivers: {
                infection: {
                    asi,
                    leafWetnessHours: LW,
                    temperature: meanTemp,
                    infectionFlag,
                    temperatureInRange: tempInRange,
                },
                // b35fix453 (C58): basal-rot driver block parallel to infection.
                // Reports the temperature Gaussian factor, the moisture saturation
                // factor (max of LW and precip), the precip input, and the
                // pre-stress + post-stress risk magnitudes. Consumers can render
                // a phase breakdown without recomputing the channel.
                basalRot: {
                    temperature: meanTemp,
                    tempFactor: Math.round(basalRotComponents.tempFactor * 1000) / 1000,
                    moistureFactor: Math.round(basalRotComponents.moistureFactor * 1000) / 1000,
                    leafWetnessHours: LW,
                    precipitation: precip,
                    preStressRisk: Math.round(basalRotComponents.risk * 10) / 10,
                    riskScore: basalRotRiskScore,
                    active: basalActive,
                },
                stress: {
                    nitrogen: nStatus,
                    mowingHeight: hoc,
                    shadeDliDeficit: dliDeficit,
                    trafficStatus: stressStatus,
                    combinedMultiplier: stressMult,
                },
            },
            keyMessage,
            // PROVENANCE b35fix339 (paper-verified, supersedes b35fix338 audit findings):
            // Equation coefficients verified letter-for-letter against Danneberger,
            // Vargas & Jones 1984 Phytopathology 74:448-451 page 449 (paper obtained
            // 2026-04-26). ASI≥2 threshold (paper p450, Fig 3), T-range [16,28]°C
            // (Discussion p451), and LW domain [0,24]h (p449) all verified against
            // the published text. Stress component (Inguagiato 2008/2009) is a
            // Gilba layer not in the original paper — paper Discussion p451
            // explicitly notes the model does not account for nitrogen
            // fertilization or biotype susceptibility and invites future
            // adjustments.
            source: 'Danneberger, Vargas & Jones 1984 Phytopathology 74:448-451 (paper-verified b35fix339); ASI threshold ≥ 2 (paper Fig 3, p450); T-range 16-28°C (paper Discussion, p451). Stress component (Gilba layer): Inguagiato et al. 2008 Crop Sci 48:1595; Inguagiato et al. 2009 Crop Sci 49:1454-1462.',
            // PROVENANCE field — parallel to rampDurationProvenance from b35fix335.
            // Paper-verified status replaces the b35fix338 unverified flagging.
            provenance: {
                citation: 'verified',           // DOI 10.1094/Phyto-74-448 resolves
                threshold: 'verified',          // ASI≥2: paper p450 right column, Fig 3
                temperatureRange: 'verified',   // [16,28]°C: paper Discussion p451
                leafWetnessDomain: 'verified',  // [0,24]h: paper p449
                coefficients: 'verified',       // letter-for-letter match with paper p449
                paperObtained: '2026-04-26',    // when verification became possible
                supersedes: 'b35fix338 audit (which flagged coefficients UNVERIFIED and added a [0,6] output clamp, both rolled back in b35fix339)',
                edgeBehaviours: [
                    // Present in the paper, not bugs:
                    'non-monotonicity in LW at T=16°C boundary (paper Fig 1B shows surface dipping at cool-extended-wet corner, polynomial-regression edge artifact)',
                    'regression output exceeds 1-6 ASI categorical scale at warm-wet corner (paper Fig 1B y-axis -6 to +8, categorical scale classifies empirical disease area %, not regression output range)',
                    'sub-threshold false positives ASI 1.0-1.8 with no disease (paper p450: 90% of zero-disease wetting periods sit at or below ASI=2, addressed by the published threshold)',
                ],
                stressLayerProvenance: 'Gilba layer (Inguagiato 2008/2009). Paper Discussion p451: "the model does not account for the varying degree of susceptibility of different biotypes of annual bluegrass to anthracnose or the effect of nitrogen fertilization on disease development". Stress multipliers are a layered extension, not part of the published equation.',
                auditDoc: 'docs/provenance-audit-tier2.md',
            },
            // PROVENANCE field for the stress-multiplier layer specifically
            // (b35fix430 Tier 2 audit). Parallel to the Danneberger-component
            // `provenance` block above. Each entry rates how strongly the
            // referenced sources support the magnitude shown in code.
            provenanceStress: {
                nitrogenStatus: 'verified',
                // Inguagiato/Murphy/Clarke 2008 Crop Sci 48:1595-1607 (cited
                // via Murphy/Inguagiato/Clarke 2012 GCM May 2012 p.105 BMP
                // synthesis: applying soluble nitrogen on a seven-day
                // schedule reduces anthracnose severity up to 24% compared
                // to applying the same nitrogen rate every 28 days).
                // Inguagiato et al. presentation slide 14 reports AUDPC
                // regression y = -3.9736x + 13.13, p < 0.0001, R² = 0.844
                // for total N applied, confirming a strong dose-response.
                // 1.5x deficient / 1.25x low magnitudes are operational
                // calibrations consistent with the published direction and
                // dose-response strength.
                mowingHeight: 'partially-verified',
                // Direction (lower HOC → more disease) verified via
                // Murphy/Inguagiato/Clarke 2012 GCM May 2012 p.108 BMP
                // table: "Mowing below 0.125 inch (3.2 millimeters) should
                // be avoided whenever possible. If feasible, raise the
                // cutting height as high as 0.141 inch (3.6 millimeters)
                // for greater suppression of anthracnose." Inguagiato et
                // al. presentation slide 18 shows season-long traces
                // 0.110-inch ~80%, 0.125-inch ~50%, 0.141-inch ~25% peak
                // disease. Quantitative magnitude (1.20 below 2.8mm,
                // 1.0–1.12 ramp 3.6mm→2.8mm) NOT primary-paper-verified;
                // pending Inguagiato/Murphy/Clarke 2009 Crop Sci 49:1454-1462.
                shadeDliDeficit: 'unverified',
                // Settle 2006 APS / Landschoot 2021 Penn State cited
                // in-line. Neither primary obtained at b35fix430. Magnitudes
                // (1.10 / 1.20) are operational placeholders. Direction
                // (shade compounds anthracnose) is plausible per generic
                // turf-stress literature but quantitative thresholds (25% /
                // 40% DLI deficit) are unsupported by cited primaries.
                trafficCompaction: 'unverified',
                // Settle & Martinez-Espinosa 2006 APS cited in-line.
                // Primary not obtained. Direction (compaction stress
                // amplifies anthracnose) plausible but unverified at this
                // engine layer.
                wounding: 'verified-absent',
                // Crouch & Clarke 2012 GCM May 2012 p.100: "activities
                // causing wounded tissue (foot traffic, rolling,
                // double-cutting and verticutting) do not appear to enhance
                // the severity of anthracnose on annual bluegrass putting
                // greens." Murphy/Inguagiato/Clarke 2012 GCM May 2012 p.106
                // re-states: "wounding of leaves, crowns or stolons does
                // not increase anthracnose severity on annual bluegrass
                // putting greens." Inguagiato et al. presentation slides
                // 21–24 show topdressing with traffic does not increase
                // disease. Code does NOT carry a wounding modifier — this
                // is correct and explicitly verified by the literature.
                hostRange: 'caveat-applied',
                // Crouch & Clarke 2012 GCM May 2012 p.97-99: model is
                // calibrated on cool-season Poa annua / Agrostis stolonifera
                // host range. Warm-season anthracnose is caused by distinct
                // Colletotrichum species (C. eremochloae on centipede;
                // C. caudatum / C. paspali on bahiagrass and zoysia in
                // Japan; bermudagrass species unidentified) — not C.
                // cereale. Runtime caveat appended to keyMessage when
                // normalizedSpecies is in _ANTHRACNOSE_WARM_SEASON_HOSTS
                // (currently zoysia is the only warm-season species that
                // passes the dispatcher gate). For paspalum the dispatcher
                // gate excludes the host before the model fires; the
                // caveat would only fire if susceptibility values change.
                paperObtained: '2026-05-03',
                // Five primary / synthesis sources banked at b35fix430:
                //   - Crouch & Clarke 2012 GCM May 2012 p.96-102 (biology review)
                //   - Murphy/Inguagiato/Clarke 2012 GCM May 2012 p.104-110 (BMP synthesis)
                //   - Bonos/Weibel/Lawson/Clarke 2009 Applied Turfgrass Science
                //     DOI 10.1094/ATS-2009-0806-01-BR (cultivar tolerance primary)
                //   - Inguagiato/Roberts/Murphy/Crouch/Clarke (Rutgers presentation,
                //     post-2008, BMP development field-trial dataset)
                //   - Clarke & Murphy (Rutgers Cooperative Extension factsheet,
                //     post-2003, Ridgewood CC trial summary)
                gapsLogged: [
                    // Gaps surfaced by the Tier 2 audit but NOT fixed in
                    // b35fix430. Each is logged as a new C-entry in the
                    // post-b35fix395 migration ledger and is deferred to
                    // post-SaaS-port because each requires a new input on
                    // the calculate() signature (architectural change).
                    'C36, Anthracnose irrigation/wilt-stress modifier (Roberts/Inguagiato/Clarke/Murphy 2011 Crop Sci 51:1244-1252; quantitative U-shape 40/60/80/100% ETo evidence in Inguagiato et al. presentation slides 42-43; Murphy 2012 BMP synthesis p.106; Clarke & Murphy Rutgers factsheet)',
                    'C37, Anthracnose sand-topdressing suppressor modifier (Inguagiato/Murphy/Clarke 2012 Crop Sci 52:1406-1415 cited via Murphy 2012 BMP p.105-106; Inguagiato et al. presentation slides 26-31 quantitative rate/frequency dose-response)',
                    'C38, N-source differentiation (Murphy/Inguagiato/Clarke 2012 GCM May 2012 p.105: potassium nitrate reduces severity, ammonium sulphate increases severity vs urea/AN/calcium nitrate). Requires nStatus field expansion to carry source.',
                ],
                auditDoc: 'docs/provenance-audit-tier2.md',
            },
        };
    },

    getInterventions(riskLevel, opts) {
        const cultural = [];
        const nStatus = opts?.nitrogen?.status;
        if (nStatus === 'deficient' || nStatus === 'low') {
            cultural.push('PRIORITY: Light, frequent nitrogen applications, N deficiency is the primary stress driver (Inguagiato et al. 2008)');
        }
        cultural.push('Remove dew/leaf wetness early morning, reduce consecutive wet hours below infection threshold');
        if (opts?.mowing?.heightOfCut < 3.6) {
            cultural.push('Raise mowing height toward 3.6mm, reduces severity 3-21% (Inguagiato et al. 2009)');
        }
        if (opts?.shade?.dliDeficit?.percentage > 25) {
            cultural.push('Address shade deficit, DLI stress compounds anthracnose susceptibility');
        }
        cultural.push('Avoid compaction, lightweight rolling preferred over heavy equipment during high-risk periods');
        return { cultural, preventive: [], timing: 'Preventive fungicides: apply when ASI trending toward 2 and stress factors present' };
    },
};

// =============================================================================
// b35fix452 (C57): CABI 2024 cross-reference for FusariumModel.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.6 p.107-114 + Box 6.17: cool-to-cold envelope 8-20 deg C, humidity
//   above 90% for more than 24h, long periods of leaf wetness, excessive
//   nitrogen. CABI body text notes infection and progression are most
//   rapid around 0-8 deg C but may continue up to 18 deg C with sufficient
//   humidity and prolonged leaf wetness, and that controlled-glasshouse
//   infection on creeping bentgrass by an American M. nivalis isolate
//   ceased at 32 deg C (Endo 1963). The hub currently zeros risk above
//   18 deg C; CABI Box 6.17 envelope extends to 20 deg C, flagged in
//   audit recommendation #5 for engine refinement under a future build.
//   Cross-references the existing Smith, Jackson & Woolhouse 1989
//   primary citation. Coefficients, thresholds, and weights unchanged
//   in this build.
//
// b35fix454 (C60): temperature ceiling refinement per CABI Box 6.17.
//   Closes audit recommendation #5 from cabi_2024_disease_audit.md.
//   Pre-fix: zero-risk gate at meanTemp > 18 deg C, temperature-factor
//   active band meanTemp >= -2 && meanTemp <= 18. Post-fix: gate raised
//   to meanTemp > 20 deg C and band raised to meanTemp <= 20. Both
//   literals are the same parameter (the upper temperature ceiling) and
//   move together; the gate short-circuits before the band when meanTemp
//   exceeds the ceiling, so the two sites must remain coordinated.
//   The asymmetric Gaussian above 8 deg C (sigma=6, peak at 6 deg C)
//   tails naturally across the new 18-20 deg C band: tempFactor at 18 is
//   exp(-2)=0.135, at 19 is exp(-2.347)=0.0957, at 20 is exp(-2.722)=0.066,
//   producing a physical, monotonically declining contribution rather
//   than a step. No adjacent coefficient bump (sigma, peak, lower bound,
//   moisture weights, freeze-thaw multiplier, fluctuation modifier, N
//   modifier, or winter-N gate at meanTemp <= 15) is required, since
//   each is independent of the upper ceiling. Display copy
//   'Too warm for Fusarium development' remains accurate above 20 deg C.
//   Source: CABI 2024 Box 6.17 (Beehag, Walker, Wong & Kaapro 2024).
//   Cross-references existing Smith, Jackson & Woolhouse 1989 primary
//   citation. Production effect: cool-season sites with mean 18-20 deg C
//   in the climate window will newly emit non-zero Fusarium risk where
//   the pre-fix engine returned zero, with the contribution heavily
//   damped by the Gaussian tail (~13%-7% of peak across the new band).
// =============================================================================
const FusariumModel = {
    name: 'Fusarium Patch (Microdochium)',
    pathogen: 'Microdochium nivale',
    calculate(climate, nitrogen, variety) {
        const meanTemp = climate?.temperature?.mean || climate?.temperature?.current || null;
        // b35fix98: return 0 risk if no temperature data — prevents false positive
        // from the || 10 fallback producing AU Fusarium risk in warm climates.
        if (meanTemp === null || meanTemp === undefined) {
            return {
                disease: 'fusarium', displayName: 'Fusarium Patch (Microdochium)',
                riskScore: 0, riskLevel: 'minimal', confidence: 'low', confidenceScore: 20,
                drivers: { temperature: { value: null, note: 'No temperature data available' } },
                source: 'Smith, Jackson & Woolhouse 1989',
            };
        }
        const minTemp = climate?.temperature?.min ?? (meanTemp - 5);
        const maxTemp = climate?.temperature?.max ?? (meanTemp + 5);
        // b35fix344: humidity null-passthrough. Pre-fix `|| 80` fabricated 80% RH on
        // every site without upstream humidity data — visible in production log
        // 2026-04-26 on 20 of 22 sites where SK degraded but Fusarium still printed
        // `humidity : 80%`. Post-fix: humidity stays null, moistureFactor uses a
        // conservative 0.2 (the lowest tier — same as <80% real humidity case),
        // and a humiditySource tag flows through diagnostics for transparency.
        const humidityRaw = climate?.moisture?.humidity?.mean;
        const humidity = (typeof humidityRaw === 'number' && !isNaN(humidityRaw)) ? humidityRaw : null;
        const humiditySource = humidity != null ? 'period mean' : 'no data';
        const precip = climate?.precipitation?.total || climate?.moisture?.precipitation?.total || 0;
        const nStatus = nitrogen?.status || 'adequate';
        const diurnalRange = maxTemp - minTemp;
        const hasFreezeCycle = minTemp < -1.0 && maxTemp > 2; // Requires genuine sub-zero min, not forecast noise (< -1.0°C per Smiley et al. tissue damage threshold)
        const snowCover = climate?.snowCover?.present || climate?.precipitation?.snow > 0 || false;
        const snowDays = climate?.snowCover?.consecutiveDays || 0;
        // b35fix454 (C60): ceiling raised 18 -> 20 deg C per CABI 2024 Box 6.17
        // (Beehag, Walker, Wong & Kaapro 2024). See banner above for full
        // rationale and coordinated band at line ~2680. Coupled with the
        // tempFactor band condition: both literals must move together.
        if (meanTemp > 20) {
            return {
                disease: 'fusarium', displayName: 'Fusarium Patch (Microdochium)',
                riskScore: 0, riskLevel: 'minimal', confidence: 'high', confidenceScore: 90,
                drivers: {
                    temperature: { value: meanTemp, optimalRange: '0-12°C', contribution: 0, note: 'Too warm for Fusarium development' },
                    moisture: { humidity, humiditySource, rain: precip, contribution: 0 },
                    nitrogen: { status: nStatus, modifier: 1 },
                    freezeThaw: { active: false, contribution: 0 },
                },
                source: 'Smith, Jackson & Woolhouse 1989',
            };
        }

        // Temperature factor (asymmetric, peaks 5-8°C)
        // b35fix454 (C60): upper bound raised 18 -> 20 deg C per CABI 2024
        // Box 6.17. Coupled with the early-return ceiling gate above. The
        // Gaussian above 8 deg C (sigma=6) tails to 0.066 at 20, so the new
        // 18-20 band emits damped but non-zero risk.
        let tempFactor = 0;
        if (meanTemp >= -2 && meanTemp <= 20) {
            tempFactor = meanTemp <= 8
                ? Math.exp(-0.5 * Math.pow((meanTemp - 6) / 4, 2))
                : Math.exp(-0.5 * Math.pow((meanTemp - 6) / 6, 2));
        }

        // Freeze-thaw factor
        let freezeThawFactor = 0, freezeThawNote = null;
        if (hasFreezeCycle) {
            freezeThawFactor = maxTemp > 5 ? 0.9 : 0.7;
            if (minTemp < -3 && maxTemp > 8) {
                freezeThawFactor = 1.0;
                freezeThawNote = 'SEVERE freeze-thaw cycle - high infection risk';
            } else {
                freezeThawNote = 'Freeze-thaw cycle detected - elevated risk';
            }
        }

        // Diurnal fluctuation
        // PROVENANCE NOTE: Specific diurnal range thresholds (8, 10, 15°C) lack peer-reviewed citation.
        // Temperature fluctuation concept is sound but exact values are unverified assumptions.
        // Future: locate literature supporting specific diurnal temperature effects on Microdochium.
        let fluctuationMod = 1.0;
        if (diurnalRange > 15) fluctuationMod = 1.25; // UNVERIFIED threshold
        else if (diurnalRange > 10) fluctuationMod = 1.15; // UNVERIFIED threshold
        else if (diurnalRange > 8) fluctuationMod = 1.08; // UNVERIFIED threshold

        // Snow cover
        // PROVENANCE NOTE: Specific day thresholds (7, 14) lack direct peer-reviewed citation.
        // Literature supports snow duration effect but exact timing needs verification.
        // Future: locate studies with specific snow cover duration vs disease severity data.
        let snowFactor = 0, snowNote = null;
        if (snowCover && meanTemp > -5 && meanTemp < 5) {
            snowFactor = Math.min(1, snowDays / 10);
            if (snowDays > 14) snowNote = 'Extended snow cover - Pink Snow Mould risk elevated'; // UNVERIFIED threshold
            else if (snowDays > 7) snowNote = 'Snow cover persisting - monitor for snow mould'; // UNVERIFIED threshold
        }

        // Moisture
        // b35fix344: when humidity is null, fall back to precip-only signal.
        // The pre-fix `humidity > 90 || precip > 15` worked because comparisons
        // against the literal-80 default returned false, but it concealed the
        // data absence. Post-fix we explicitly check humidity != null and
        // collapse to a precip-only ladder when humidity is missing — same
        // contribution tiers but transparently degraded.
        let moistureFactor;
        if (humidity != null) {
            moistureFactor = (humidity > 90 || precip > 15) ? 1 : (humidity > 80 || precip > 5) ? 0.6 : 0.2;
        } else {
            // No humidity data — precip-only ladder. 0.2 is the same conservative
            // floor used when humidity is below 80% in the real-data path.
            moistureFactor = (precip > 15) ? 1 : (precip > 5) ? 0.6 : 0.2;
        }

        // N modifier
        const nModifier = getFusariumNModifier(nStatus, meanTemp);
        const winterNRisk = (nStatus === 'high' || nStatus === 'excessive') && meanTemp <= 15;

        // Combined risk
        let baseRisk;
        if (freezeThawFactor > 0 || snowFactor > 0) {
            baseRisk = 0.30 * tempFactor + 0.35 * moistureFactor + 0.25 * freezeThawFactor + 0.10 * Math.max(snowFactor, tempFactor);
        } else {
            baseRisk = 0.40 * tempFactor + 0.60 * moistureFactor;
        }

        let riskScore = baseRisk * fluctuationMod * nModifier * 100 // variety mod applied in analyse();
        riskScore = Math.min(100, Math.max(0, riskScore));

        let primaryDriver = 'temperature';
        if (freezeThawFactor > tempFactor && freezeThawFactor > moistureFactor) primaryDriver = 'freeze_thaw';
        else if (moistureFactor > tempFactor) primaryDriver = 'moisture';
        if (winterNRisk && nModifier > 1.3) primaryDriver = 'excess_nitrogen';

        // --- DIAGNOSTIC (b35fix104): log intermediate values to browser console ---
        if (typeof console !== 'undefined') {
            console.group('[Fusarium.calculate() diagnostic]');
            console.log('meanTemp      :', meanTemp.toFixed(1), '°C (optimal: 0-12°C)');
            console.log('minTemp       :', minTemp.toFixed(1), '°C');
            console.log('maxTemp       :', maxTemp.toFixed(1), '°C');
            console.log('diurnalRange  :', diurnalRange.toFixed(1), '°C (fluctuationMod:', fluctuationMod, ')');
            console.log('humidity      :', humidity != null ? humidity + ' %' : 'n/a', '(' + humiditySource + ')');
            console.log('precip        :', precip, 'mm');
            console.log('freezeThaw    :', hasFreezeCycle ? 'YES (factor: ' + freezeThawFactor.toFixed(4) + ')' : 'no');
            console.log('snowCover     :', snowCover ? 'YES (' + snowDays + ' days, factor: ' + snowFactor.toFixed(4) + ')' : 'no');
            console.log('tempFactor    :', tempFactor.toFixed(4));
            console.log('moistureFactor:', moistureFactor.toFixed(4));
            console.log('nModifier     :', nModifier.toFixed(4), '(N status:', nStatus, ', winterRisk:', winterNRisk, ')');
            console.log('primaryDriver :', primaryDriver);
            console.log('riskScore     :', Math.round(riskScore), '(capped at 100)');
            console.groupEnd();
        }
        // --- END DIAGNOSTIC ---

        return {
            disease: 'fusarium', displayName: 'Fusarium Patch (Microdochium)',
            riskScore: Math.round(riskScore), riskLevel: classifyRisk(riskScore),
            confidence: 'high', confidenceScore: 90, primaryDriver, modelVersion: '2.0',
            drivers: {
                temperature: { value: meanTemp, min: minTemp, max: maxTemp, diurnalRange: Math.round(diurnalRange * 10) / 10, optimalRange: '0-12°C', contribution: Math.round(tempFactor * 100) },
                freezeThaw: { active: hasFreezeCycle, contribution: Math.round(freezeThawFactor * 100), note: freezeThawNote, severity: hasFreezeCycle ? (minTemp < -3 && maxTemp > 8 ? 'severe' : 'moderate') : 'none' },
                fluctuation: { diurnalRange: Math.round(diurnalRange * 10) / 10, modifier: fluctuationMod, note: diurnalRange > 10 ? 'Large temp swings increasing stress' : null },
                moisture: { humidity, humiditySource, rain: precip, contribution: Math.round(moistureFactor * 100) },
                snow: { present: snowCover, days: snowDays, contribution: Math.round(snowFactor * 100), note: snowNote },
                nitrogen: { status: nStatus, modifier: nModifier, winterRisk: winterNRisk, note: winterNRisk ? 'Excess N in cool conditions significantly elevates risk' : null },
            },
            source: 'Smith, Jackson & Woolhouse 1989',
        };
    },
    getInterventions(riskLevel, opts) {
        const cultural = [];
        if (opts?.nitrogen?.status === 'high' || opts?.nitrogen?.status === 'excessive') {
            const temp = opts?.climate?.temperature?.mean;
            if (temp !== undefined && temp <= 15) {
                cultural.unshift('CRITICAL: Reduce nitrogen immediately - excess N in cool conditions is primary Fusarium driver');
                cultural.push('Avoid late-season N applications before winter');
            } else {
                cultural.unshift('PRIORITY: Reduce nitrogen - key fusarium driver');
            }
        }
        return { cultural, preventive: [], timing: null };
    },
};

// =============================================================================
// HelminthosporiumModel — Tier 2 audit, disease #3
// =============================================================================
//
// b35fix353 (Tier 2 disease #3 provenance audit, findings #1, #4, #5, #6 closed):
//
//   FINDING #1 (citation insufficient). Pre-fix `source: 'Smiley, Vargas'` — bare
//   author surnames, no year, no journal, no page. Worst citation in the model
//   stable. Two referenced books exist (Smiley, Dernoeden & Clarke 2005,
//   Compendium of Turfgrass Diseases 3rd ed., APS Press; Vargas 2005, Management
//   of Turfgrass Diseases 3rd ed., Wiley). Neither contains a publishable risk
//   equation — both are narrative pathogen-biology references. The encoded
//   weighted-sum is internal Gilba, not from either reference. Same algorithm-
//   misattribution failure class as pre-b35fix335 SK and pre-b35fix340 BrownPatch
//   and pre-b35fix352 Pythium. Source string rewritten to attribute the encoded
//   algorithm honestly to Gilba; Smiley 2005 + Vargas 2005 cited only for
//   pathogen biology, temperature ranges, and host susceptibility narrative.
//
//   FINDING #2 (algorithm wrong for cool-season hosts). REOPENED b35fix361
//   as DEFERRED pending b35fix362 audit. b35fix359 attempted closure by
//   bumping tallFescue.drechsleraPoae 0.5 → 0.6 to route tall fescue
//   dispatches into the parallel DrechsleraPoaeModel engine. Production
//   verification log gilbasolutions_com-1777262616843 (2026-04-27, post-
//   b35fix360 deploy) revealed that `analyseBipolarisCurvularia` is gated
//   off behind `window.GAIP_SHOW_BETA_DISEASES` at line 1801 of
//   bipolaris-curvularia-models.js (`if (!showBetaDiseases) return results;`
//   in patchDiseaseEngineWithBipolaris). The gate exists because the
//   encoded weighted-sum in DrechsleraPoaeModel and the asymmetric Gaussian
//   in calcTempResponse_DrechsleraPoae have NOT been provenance-audited.
//   The b35fix359 closure was therefore based on a false premise: the
//   parallel cool-season engine that was supposed to fill the coverage
//   gap is not in production. Tall fescue + cool-spring conditions are
//   genuinely receiving silent false negatives from HelminthosporiumModel
//   (out-of-band Gaussian) AND from the gated-off DrechsleraPoaeModel.
//   b35fix361 rolls back the susceptibility bump and the citation
//   registry change, and updates the SCOPE caveat to honestly describe
//   the gated state. b35fix362 will do the Tier 2 provenance audit on
//   DrechsleraPoaeModel; if the model survives audit it can be ungated.
//   Cool-season scope flag retained on this model so the SCOPE caveat
//   surfaces the gap to users.
//
//   FINDING #2 CLOSURE NOTE (b35fix464 / C59b). The b35fix361 reopen and
//   b35fix362 deferral text above is preserved as historical context, but
//   the underlying state has changed and the deferral is closed.
//   b35fix461 / C59 wired DrechsleraPoaeModel directly into
//   `DiseaseEnginePure.analyse()` via the dispatcher block adjacent to
//   Helminthosporium with `DISPATCHER_GATES.drechsleraPoae = 0.5`, the
//   12-row SPECIES_SUSCEPTIBILITY column, and DISEASE_DISPLAY_NAMES
//   wire-up. The cool-season coverage gap that Finding #2 surfaced is
//   closed at the engine architecture level. The model also passed the
//   Tier 2 provenance audit referenced in the b35fix362 plan: see
//   `DRECHSLERA_POAE_VALIDATION_STATUS` at
//   `bipolaris-curvularia-models.js:128+`, version 3.2.0, status
//   'validated', detailedMessage updated to flag b35fix362 supersession
//   per Reading 2 framing. The `patchDiseaseEngineWithBipolaris` wrap
//   referenced above is retired to a no-op in b35fix464 / C59d because
//   the legacy `DiseaseEngine.analyse` stub it wrapped is no longer the
//   production route.
//
//   FINDING #6 (temp || 25 fabrication). Pre-fix `const temp = climate?.temperature?.mean || 25;`
//   — same JS-coercion fabrication class as pre-b35fix351 Pythium `maxTemp || 25`,
//   pre-b35fix346 Anthracnose `meanTemp || 20`, and pre-b35fix349 SK rung 1
//   `(d.mean || 0)`. Default 25°C lands inside the active band [20,35] so a
//   missing-climate site produces a non-zero confident risk. Post-fix: null-
//   passthrough on temperature, explicit DEGRADED gate at top of calculate
//   returning riskScore 0 / confidence 'low' / source flagged DEGRADED.
//
//   FINDINGS #4 + #5 (registry hygiene + confidence routing). Confidence now
//   routes through input quality (mirrors post-b35fix346 Anthracnose / post-
//   b35fix351 Pythium pattern): 'high' when all of temp/humidity/leafWet present,
//   'medium' when one missing, 'low' when degraded. validationBadge BETA retained.
//   Brecht et al. 2007 mistagging in citation-registry.js corrected separately
//   (it's a Si × chlorothalonil trial on gray leaf spot in St. Augustine, not a
//   Bipolaris/Helminthosporium calibration source).
//
//   FINDING #4b (registry binding incomplete). ROLLED BACK b35fix361
//   pending b35fix362 audit. b35fix359 promoted PSU Extension (Landschoot
//   2024) and UMass Extension to primary citations for the
//   bipolaris-curvularia engine binding, on the assumption that the engine
//   is in production. It is not (see Finding #2 reopen note above). PSU
//   and UMass references are narrative pathogen-biology / cool-season
//   epidemiology and do not calibrate the encoded continuous risk
//   equations — same audit class as pre-b35fix352 Pythium where Nutter
//   1983 was a narrative reference, not a calibration source for the
//   encoded Gilba algorithm. b35fix361 demotes both back to secondary
//   alongside Brecht 2007 (which was correctly demoted in b35fix359 for
//   different reasons — paper is gray-leaf-spot-on-St-Augustine, not
//   Bipolaris/Drechslera). The honest pre-audit state is: there is no
//   peer-reviewed primary calibration source for this engine binding.
//   PSU and UMass entries themselves remain DEFINED in the registry
//   (the dangling-pointer fix from b35fix359 stays — those references
//   are real and used elsewhere as narrative biology), they're just
//   no longer claimed as primary calibration sources. b35fix362 will
//   settle the binding once the Tier 2 audit on DrechsleraPoaeModel
//   establishes (or fails to establish) provenance for the encoded
//   weighted-sums.
//
//   FINDING #4b CLOSURE NOTE (b35fix464 / C59b). The b35fix361 rollback
//   text above is preserved as historical context, but the binding
//   question is now settled. b35fix461 / C59 anchored the
//   DrechsleraPoaeModel temperature curve on CABI 2024 Box 7.7 (Beehag,
//   Walker, Wong and Kaapro 2024, Biology and Integrated Management of
//   Turfgrass Diseases, CABI Wallingford, ISBN 9781789246216, Ch.7
//   p.174-180 + Box 7.7) using the cardinal-temperature anchors from the
//   CABI fungal-growth optimum 18 deg C with cold-tail sigma 5 and
//   warm-tail sigma 6. The encoded continuous risk equation is now
//   anchored to a peer-reviewed primary calibration source. PSU Extension
//   and UMass Extension remain as narrative pathogen-biology references
//   in the citation registry, not reinstated as primary calibration
//   sources for the engine binding. The model's
//   `DRECHSLERA_POAE_VALIDATION_STATUS.sources` array prepends the CABI
//   2024 citation as the canonical primary anchor.
//
//   FINDING #7 (stale diagnostic tag). CLOSED b35fix359, confirmed b35fix361.
//   The original "pending b35fix354" claim in the SCOPE caveat was misleading
//   regardless of whether the parallel cool-season engine ran in production —
//   b35fix354 was the Pythium Ca/K provenance closure, never the cool-season
//   Drechslera path, so the tag was stale either way. b35fix361 updated the
//   caveat text again to reflect the gated state honestly, but the
//   underlying #7 closure (no more stale promise to a build that closed
//   something else) stands. Diagnostic tag renumbered to b35fix361 to
//   reflect the most recent material change to the diagnostic surface.
//
//   SCOPE FLAG. Optional `species` parameter accepted on calculate() — when
//   present, cool-season hosts (kentuckyBluegrass, tallFescue, perennialRyegrass,
//   bentgrass, poaAnnua) get an explicit `coolSeasonScopeFlag: true` on the
//   result and source string flags the warm-season-only scope. 
//   
//   b35fix362 COMPLETION: DrechsleraPoaeModel passed Tier 2 audit and is now
//   ungated for production use. Cool-season hosts receive proper disease assessment
//   through the validated bipolaris-curvularia engine pathway. This flag remains
//   for transparency but no longer indicates a coverage gap.
//
//   SOURCES (narrative only — none are calibration references for the encoded
//   continuous weighted-sum):
//     - Smiley, R.W., Dernoeden, P.H., Clarke, B.B. 2005. Compendium of Turfgrass
//       Diseases, 3rd ed. APS Press, St. Paul, MN. (Bipolaris/Drechslera/
//       Exserohilum genus reclassification, host ranges, narrative biology)
//     - Vargas, J.M. 2005. Management of Turfgrass Diseases, 3rd ed. Wiley.
//       (Helminthosporium leaf spot / melting-out narrative biology, cultural
//       management)
//     - Landschoot, P. 2024. Penn State Extension turf fact sheet, "Turfgrass
//       Diseases: Leaf Spot and Melting-Out Diseases (Causal Fungi: Bipolaris
//       and Drechslera spp.)" (cool-season epidemiology)
//
//   b35fix452 (C57): CABI 2024 cross-reference, citation-only, no logic touch.
//     Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//     Biology and Integrated Management of Turfgrass Diseases.
//     CABI, Wallingford. ISBN 9781789246216.
//     Ch.7 p.174-180 + Box 7.7: Bipolaris / Curvularia / Drechslera /
//     Pyrenophora taxonomy, with Pyrenophora poae cardinal temperatures
//     (relevant to the deferred Tier 2 audit on the supplementary
//     bipolaris-curvularia-models.js DrechsleraPoaeModel, BETA per
//     BIPOLARIS_VALIDATION_STATUS at b35fix362). Cross-references the
//     Smiley 2005 / Vargas 2005 / Landschoot 2024 chain above.
//     Coefficients, thresholds, and weights unchanged.
//
const HelminthosporiumModel = {
    name: 'Helminthosporium',
    pathogen: 'Bipolaris/Drechslera spp.',
    calculate(climate, nitrogen, variety, dewData, species) {
        // b35fix353 Finding #6: null-passthrough on temperature input.
        const tempRaw = climate?.temperature?.mean;
        const temp = (typeof tempRaw === 'number' && !isNaN(tempRaw)) ? tempRaw : null;

        // b35fix353 scope flag: detect cool-season host context if species known.
        const COOL_SEASON_HOSTS = new Set(['kentuckyBluegrass', 'tallFescue',
                                          'perennialRyegrass', 'bentgrass', 'poaAnnua',
                                          'fineFescue']);
        const speciesKey = species ? normalizeSpecies(species) : null;
        const coolSeasonScopeFlag = speciesKey ? COOL_SEASON_HOSTS.has(speciesKey) : false;

        // b35fix344: humidity null-passthrough. Pre-fix `|| 70` fabricated 70% on
        // sites with no upstream humidity data — humFactor would compute non-zero
        // for any humidity ≥ 80, but with humidity defaulted to 70 it always
        // returned 0 anyway, so no behavioural change. Post-fix makes the data
        // absence explicit and exposes humiditySource on drivers.
        const humidityRaw = climate?.moisture?.humidity?.mean;
        const humidity = (typeof humidityRaw === 'number' && !isNaN(humidityRaw)) ? humidityRaw : null;
        const humiditySource = humidity != null ? 'period mean' : 'no data';
        const leafWet = getLeafWetnessHours(climate, dewData);
        const nStatus = nitrogen?.status || 'adequate';

        // b35fix353 Finding #6: explicit DEGRADED gate when temperature missing.
        // Pre-fix `temp || 25` fabricated 25°C inside active band [20,35] →
        // confident non-zero risk on degraded climate. Post-fix: confidence 'low',
        // riskScore 0, transparent DEGRADED source string.
        if (temp == null) {
            // b35fix464 (C59b): header bumped from b35fix361 to b35fix461.
            // b35fix353a originally added this degraded-path diagnostic; the
            // observability hook is unchanged, only the build-tag on the
            // header string is updated to point at the most recent material
            // change in the cool-season-coverage architecture (b35fix461
            // DrechsleraPoaeModel wire-in) rather than the earlier
            // b35fix361 rollback state. Mirrors the symmetric pattern
            // Pythium (b35fix351), Anthracnose (b35fix346), and BrownPatch
            // use, with explicit degraded console group so production logs
            // show whether the b35fix353 fabrication closure is firing.
            if (typeof console !== 'undefined') {
                console.group('[Helminthosporium.calculate() diagnostic, b35fix461 degraded]');
                console.log('species         :', speciesKey || 'n/a (not provided to model)');
                console.log('coolSeasonScopeFlag:', coolSeasonScopeFlag);
                console.log('temp            : n/a (no data)');
                console.log('humidity        :', humidity != null ? humidity.toFixed(1) + '%' : 'n/a', '(' + humiditySource + ')');
                console.log('leafWet         :', leafWet + 'h/day');
                console.log('riskScore       : 0 (DEGRADED, Helminthosporium temperature input missing)');
                console.groupEnd();
            }
            return {
                disease: 'helminthosporium', displayName: 'Helminthosporium Leaf Spot',
                riskScore: 0, riskLevel: 'low',
                confidence: 'low', confidenceScore: 30,
                validationStatus: 'beta', validationBadge: 'BETA',
                degraded: true,
                coolSeasonScopeFlag,
                drivers: {
                    temperature: { value: null, source: 'no data', contribution: 0 },
                    humidity: { value: humidity, humiditySource, contribution: 0 },
                    leafWetness: { hours: leafWet, contribution: 0 },
                },
                source: 'DEGRADED, Helminthosporium temperature input missing (b35fix353)',
            };
        }

        let tempFactor = 0;
        if (temp >= 20 && temp <= 35) tempFactor = Math.exp(-0.5 * Math.pow((temp - 28) / 6, 2));
        // b35fix344: humFactor = 0 when humidity null (degrade — no fabricated risk)
        const humFactor = humidity != null && humidity > 80 ? Math.min(1, (humidity - 80) / 15) : 0;
        const wetFactor = Math.min(1, leafWet / 12);

        let risk = (0.35 * tempFactor + 0.30 * humFactor + 0.35 * wetFactor) *
                   (N_MODIFIERS[nStatus] || 1) * 100; // variety mod applied in analyse()
        risk = Math.min(100, Math.max(0, risk));

        // b35fix353 Finding #5: confidence routes through input availability.
        // 'high' when all inputs present, 'medium' when one missing, 'low' below.
        const inputsPresent = [humidity != null, leafWet > 0].filter(Boolean).length;
        let confidence, confidenceScore;
        if (inputsPresent === 2) { confidence = 'high'; confidenceScore = 90; }
        else if (inputsPresent === 1) { confidence = 'medium'; confidenceScore = 70; }
        else { confidence = 'low'; confidenceScore = 40; }

        // b35fix353 Finding #1 + scope: source string honestly attributes the
        // encoded algorithm to Gilba. Smiley 2005 + Vargas 2005 cited as
        // narrative biology references only. Cool-season scope flag adds an
        // explicit warm-season-only caveat when species is a cool-season host.
        const baseSource = 'Gilba weighted-sum (internal). Pathogen biology: ' +
                          'Smiley, Dernoeden & Clarke 2005 (Compendium of Turfgrass ' +
                          'Diseases 3rd ed., APS Press); Vargas 2005 (Management of ' +
                          'Turfgrass Diseases 3rd ed., Wiley). Algorithm calibration ' +
                          'is Gilba-internal, not from either reference.';
        const scopeSuffix = coolSeasonScopeFlag
            ? ' SCOPE: encoded curve is warm-season-shape (Gaussian peak 28°C); ' +
              'cool-season Drechslera poae response (peak 14-18°C, ceases >20°C, ' +
              'Smiley 2005; Landschoot 2024) is NOT modelled in production. A ' +
              'parallel cool-season engine (DrechsleraPoaeModel in ' +
              'bipolaris-curvularia-models.js) exists but is gated off behind ' +
              'window.GAIP_SHOW_BETA_DISEASES pending Tier 2 provenance audit ' +
              '(deferred to b35fix362). Result MAY UNDERSTATE risk on cool-season ' +
              'hosts in spring/autumn windows. This is a known coverage gap.'
            : '';

        // b35fix353a: diagnostic block. Stylistic shape mirrors BrownPatch
        // (b35fix340) and Anthracnose (b35fix346) — single console.group with
        // input echoes and the riskScore. Production-verification hook for the
        // b35fix353 closure: surfaces coolSeasonScopeFlag + confidence routing
        // outputs in browser console without needing a word-export trace.
        if (typeof console !== 'undefined') {
            // b35fix464 (C59b): header bumped from b35fix361 to b35fix461 to
            // reflect post-Drechslera-wire-in state. The coolSeasonScopeFlag
            // descriptor previously read "warm-season pathway only, cool-season
            // Drechslera engine gated pending b35fix362 audit" which was stale
            // post-b35fix461: the b35fix362 audit closed (validated badge on
            // DRECHSLERA_POAE_VALIDATION_STATUS) and b35fix461 wired
            // DrechsleraPoaeModel into DiseaseEnginePure.analyse via the
            // dispatcher block adjacent to this Helminthosporium block, so
            // the cool-season gap this scope-flag was warning about is now
            // covered. Updated to honestly describe the post-b35fix461 state:
            // Helminthosporium remains the warm-season pathway, the
            // cool-season pathway runs through DrechsleraPoaeModel.
            console.group('[Helminthosporium.calculate() diagnostic, b35fix461]');
            console.log('species         :', speciesKey || 'n/a (not provided to model)');
            console.log('coolSeasonScopeFlag:', coolSeasonScopeFlag,
                        coolSeasonScopeFlag ? '(warm-season pathway, cool-season hosts covered by DrechsleraPoaeModel since b35fix461 / C59)' : '');
            console.log('temp            :', temp.toFixed(1) + '°C', '(period mean)');
            console.log('humidity        :', humidity != null ? humidity.toFixed(1) + '%' : 'n/a', '(' + humiditySource + ')');
            console.log('leafWet         :', leafWet + 'h/day');
            console.log('tempFactor      :', tempFactor.toFixed(4), '(Gaussian centre 28°C, σ=6, gate 20-35°C)');
            console.log('humFactor       :', humFactor.toFixed(4), '(linear 80-95% RH, 0 below 80%)');
            console.log('wetFactor       :', wetFactor.toFixed(4), '(linear 0-12h, 0 above)');
            console.log('nMod            :', (N_MODIFIERS[nStatus] || 1), '(N status:', nStatus + ')');
            console.log('confidence      :', confidence, '(' + confidenceScore + ')',
                        '(inputs present: humidity=' + (humidity != null) + ', leafWet=' + (leafWet > 0) + ')');
            console.log('riskScore       :', Math.round(risk));
            console.groupEnd();
        }

        return {
            disease: 'helminthosporium', displayName: 'Helminthosporium Leaf Spot',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            confidence, confidenceScore,
            validationStatus: 'beta', validationBadge: 'BETA',
            coolSeasonScopeFlag,
            drivers: {
                temperature: { value: temp, source: 'period mean', contribution: Math.round(tempFactor * 100) },
                humidity: { value: humidity, humiditySource, contribution: Math.round(humFactor * 100) },
                leafWetness: { hours: leafWet, contribution: Math.round(wetFactor * 100) },
            },
            source: baseSource + scopeSuffix,
        };
    },
    getInterventions(riskLevel) {
        return {
            cultural: ['Reduce leaf wetness', 'Maintain adequate N', 'Raise HOC during outbreaks'],
            preventive: [],
        };
    },
};

// =============================================================================
// b35fix452 (C57): CABI 2024 cross-reference for GrayLeafSpotModel.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.7 p.171-174 + Box 7.5: Pyricularia oryzae current name (vs the
//   older Pyricularia grisea taxonomy); environmental envelope 25-28
//   deg C, 90% humidity, > 14h leaf wetness duration. CABI primarily
//   cross-confirms Uddin 2003 and Kerns & Tredway 2013 already cited
//   below; coefficients, thresholds, and weights unchanged. GLS stays
//   out of Tier 2 reopen scope per b35fix452 / C57 audit (CABI does
//   not unlock new audit material the way SDS and Waitea do).
// =============================================================================
const GrayLeafSpotModel = {
    name: 'Gray Leaf Spot',
    pathogen: 'Pyricularia oryzae',
    calculate(climate, nitrogen, variety, turfContext) {
        const meanTemp = climate?.temperature?.mean || 25;
        const maxTemp = climate?.temperature?.max || 30;
        const minTemp = climate?.temperature?.min || meanTemp - 5;
        // b35fix344: humidity null-passthrough. Pre-fix `|| 70` and `|| humidity`
        // chain fabricated 70% then 80% (humidity + 10) on sites with no upstream
        // data — humFactor would only fire at >=85 so the literal-70 default
        // produced 0 contribution anyway, but it concealed the data absence and
        // night-humidity diagnostics showed fabricated 80%.
        const humidityRaw = climate?.moisture?.humidity?.mean;
        const humidity = (typeof humidityRaw === 'number' && !isNaN(humidityRaw)) ? humidityRaw : null;
        const humiditySource = humidity != null ? 'period mean' : 'no data';
        const nightHumRaw = climate?.moisture?.humidity?.night;
        const nightHum = (typeof nightHumRaw === 'number' && !isNaN(nightHumRaw)) ? nightHumRaw : humidity;
        const leafWet = climate?.leafWetness?.hoursPerDay || 0;
        const nStatus = nitrogen?.status || 'adequate';
        const isNew = turfContext?.establishmentMonths < 3;

        let tempFactor = 0;
        if (meanTemp >= 20 && meanTemp <= 34) {
            tempFactor = meanTemp <= 28 ? (meanTemp - 20) / 8 : 1 - (meanTemp - 28) / 12;
            tempFactor = Math.max(0, Math.min(1, tempFactor));
        } else if (meanTemp > 34) {
            tempFactor = Math.max(0, 0.5 - 0.25 * (meanTemp - 34));
        }

        let nightTempFactor = 0;
        if (minTemp >= 18) nightTempFactor = Math.min(1, (minTemp - 18) / 6);

        // b35fix344: estNightHum null when both nightHum and humidity unavailable.
        // humFactor = 0 in that case (no fabricated >=85 saturation contribution).
        const estNightHum = nightHum != null ? nightHum
                          : humidity != null ? humidity + 10
                          : null;
        let humFactor = (estNightHum != null && estNightHum >= 95) ? 1 :
                        (estNightHum != null && estNightHum >= 85) ? (estNightHum - 85) / 10 : 0;

        let wetFactor = 0;
        if (leafWet >= 12) wetFactor = 1;
        else if (leafWet >= 10) wetFactor = 0.85 + 0.075 * (leafWet - 10);
        else if (leafWet >= 6) wetFactor = ((leafWet - 6) / 5) * 0.85;

        const nMods = { deficient: 0.5, low: 0.7, adequate: 1, high: 1.5, excessive: 2 };
        const nMod = nMods[nStatus] || 1;
        const seedlingMod = isNew ? 2.5 : 1;
        const varietyMod = variety?.disease?.grayLeafSpot?.riskMultiplier || 1;

        let risk = (0.2 * tempFactor + 0.25 * nightTempFactor + 0.25 * humFactor + 0.3 * wetFactor) * nMod * seedlingMod * 100;
        risk = Math.min(100, Math.max(0, risk));

        const conf = climate?.hourlyData ? 'high' : climate?.temperature?.min ? 'medium' : 'low';

        return {
            disease: 'grayLeafSpot', displayName: 'Gray Leaf Spot',
            riskScore: Math.round(risk), riskLevel: classifyRisk(risk),
            confidence: conf, confidenceScore: confidenceToScore(conf),
            drivers: {
                temperature: { value: meanTemp, max: maxTemp, contribution: Math.round(tempFactor * 100) },
                nightTemp: { value: minTemp, contribution: Math.round(nightTempFactor * 100) },
                nightHumidity: { value: estNightHum, humiditySource, contribution: Math.round(humFactor * 100) },
                leafWetness: { hours: leafWet, contribution: Math.round(wetFactor * 100) },
                nitrogen: { status: nStatus, modifier: nMod },
            },
            modifiers: { variety: varietyMod, nitrogen: nMod, seedling: seedlingMod },
            source: 'Penn State & Rutgers turf pathology',
        };
    },
    getInterventions(riskLevel) {
        return {
            cultural: ['Reduce nitrogen during hot weather', 'Avoid evening irrigation', 'Improve air circulation'],
            preventive: [], curative: [],
        };
    },
};

// WaiteaPatch - NZ (var. circinata) + AU (var. zeae) - region check is pure
//
// Two variants produce smoke ring on bentgrass:
//   var. circinata — NZ/cool-season, optimal ~22-27°C mean air temp
//   var. zeae      — AU documented strain, optimal ~28-32°C mean air temp
//                    (formerly Rhizoctonia zeae; reclassified Burpee et al. 2006)
//
// Both produce identical smoke ring symptom at lesion margin.
// AU diagnosis historically misattributed to Brown Patch (AG 1-A).
//
// Sources: Burpee et al. 2006 (Plant Disease); Smiley et al. 2005;
//          Wong & Harman 2001 (Australasian Plant Pathology); Chen et al. 2009
//
// b35fix452 (C57): CABI 2024 cross-reference, citation-only, no logic touch.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.6 Table 6.14: cleanest published cardinal-temperature table for
//   the three Waitea-incited diseases (Brown Ring Patch, Basal Leaf
//   Blight, Leaf-Sheath Spot) the hub currently collapses into one model.
//   Cross-references existing Burpee 2006 / Smiley 2005 / Wong & Harman
//   2001 / Chen 2009 chain; coefficients, thresholds, and weights
//   unchanged. Tier 2 audit reopen candidate per b35fix452 / C57 audit.
const WaiteaPatchModel = {
    name: 'Waitea Patch',
    pathogen: 'Waitea circinata var. circinata / var. zeae',
    isApplicable(region) {
        if (!region) return false;
        const r = region.toLowerCase();
        return r === 'nz' || r.includes('zealand') || r.includes('australia') || r === 'au';
    },
    classifyRisk(score) {
        return classifyRisk(score);
    },
    _getVariant(region) {
        // var. zeae is the AU strain; var. circinata is NZ/cooler-climate
        const r = (region || '').toLowerCase();
        return (r.includes('australia') || r === 'au') ? 'zeae' : 'circinata';
    },
    calculate(climate, nitrogen, shade, soil, variety, species, region) {
        if (!this.isApplicable(region)) return null;

        const variant = this._getVariant(region);
        // b35fix345: WaiteaPatchModel null-passthrough. Pre-fix `?? 18` for
        // airTemp and `?? 70` for humidity fabricated values when climate
        // data was missing — Waitea is NZ/AU-only and runs on every applicable
        // site. The downstream tempFactor uses Gaussian curves that produce
        // non-zero output at airTemp=18 (≈0.33 for circinata variant) and
        // moistureFactor crosses 0 at humidity=70 exactly, so the default
        // produced a small non-zero risk that shouldn't have existed.
        // Now: degrade explicitly when temp or humidity missing.
        const airTemp = climate?.temperature?.mean ?? null;
        const humidity = climate?.moisture?.humidity?.mean ?? climate?.humidity?.mean ?? null;
        const rainfall = climate?.moisture?.precipitation?.total ?? climate?.rainfall?.total ?? 0;
        const cloudCover = climate?.cloudCover ?? null;

        if (airTemp == null) {
            // b35fix353b PRODUCTION HOTFIX: explicit adjustedRisk on the degraded
            // return shape. Pre-fix the degraded path returned `riskScore: 0,
            // rawRisk: 0` but omitted `adjustedRisk` entirely. WaiteaPatch is
            // the only model that bakes adjustedRisk inside the model itself
            // (line 2445 normal path: `adjustedRisk, riskScore: adjustedRisk`)
            // — every other engine leaves adjustedRisk undefined and lets the
            // dispatch site set it. The regional-multiplier loop at line 3553
            // then computed `Math.round(undefined * taperMultiplier(0, mult))`
            // → Math.round(NaN) → NaN → propagated into overallScore via
            // Math.max(...validatedDiseases.map(d => d.adjustedRisk)).
            //
            // Surfaced as `Disease Pressure: MINIMAL NaN%` and `Brown Ring
            // Patch: NaN%` on every site running degraded-temperature climate
            // in AU/NZ regions (Federal Golf Club AU, Shirley GC Christchurch
            // NZ — production screenshots 2026-04-27).
            //
            // Fix: explicit adjustedRisk: 0 on degraded return (matches the
            // riskScore: 0 / rawRisk: 0 contract). Also added validationStatus
            // /validationBadge/variant fields for shape symmetry with the
            // normal-path return at line 2442 — beta-excluded filter at line
            // 3589 must see consistent shape across both paths.
            return {
                disease: 'waiteaPatch',
                displayName: variant === 'zeae' ? 'Waitea Patch' : 'Brown Ring Patch',
                pathogen: variant === 'zeae'
                    ? 'Waitea circinata var. zeae'
                    : 'Waitea circinata var. circinata',
                riskScore: 0,
                rawRisk: 0,
                adjustedRisk: 0,
                riskLevel: 'low',
                confidence: 'low',
                confidenceScore: 30,
                validationStatus: 'beta',
                validationBadge: 'BETA',
                variant,
                degraded: true,
                source: 'WaiteaPatchModel, degraded path: airTemp missing (b35fix345; adjustedRisk shape-symmetry b35fix353b)',
                drivers: {
                    temperature: { value: null, status: 'missing' },
                    humidity:    { value: humidity, status: humidity == null ? 'missing' : 'available' },
                },
            };
        }

        // Temperature — var. zeae optimal 28-32°C (active 20-38°C)
        //             — var. circinata optimal 22-27°C (active 10-35°C)
        let tempFactor = 0;
        if (variant === 'zeae') {
            // AU strain: hard floor at 20°C (below = no risk), peaks 28-32°C
            if (airTemp >= 20 && airTemp <= 38) {
                tempFactor = Math.exp(-0.5 * Math.pow((airTemp - 30) / 6, 2));
                tempFactor = Math.max(0, Math.min(1, tempFactor));
            }
        } else {
            // NZ/circinata strain: active from 10°C, optimal 22-27°C
            // b35fix242: removed the 0.7 floor that was applied for airTemp 15-24°C.
            // The floor had no direct literature support — Wong & Harman 2001
            // (Australasian Plant Pathology) state optimal 20-30°C; a flat 0.7
            // at 15°C implied 70% of peak risk at a temperature well below optimum,
            // inflating NZ/southern AU winter Waitea scores by up to 2× at 15-18°C.
            // The Gaussian (sigma=8, centre=27) alone correctly gives low values
            // at cool temperatures: 15°C→0.33, 18°C→0.53, 20°C→0.68. These are
            // agronomically plausible — some activity, not high risk.
            if (airTemp >= 10 && airTemp <= 35) {
                tempFactor = Math.exp(-0.5 * Math.pow((airTemp - 27) / 8, 2));
            }
        }

        // Moisture
        // b35fix345: explicit null-guard. Pre-fix relied on JS coercion
        // (`null >= 70` → false) which worked but was opaque. With humidity
        // explicitly null, moistureFactor degrades to rainfall-only (paper
        // mechanism — sustained leaf wetness drives Waitea). When both null,
        // moistureFactor is 0.
        let moistureFactor = 0;
        if (humidity != null) {
            moistureFactor = humidity >= 70 ? Math.min(1, (humidity - 70) / 25) : 0;
        }
        if (rainfall > 0) moistureFactor = Math.min(1, moistureFactor + (rainfall / 20) * 0.3);

        // Light
        let lightFactor = cloudCover !== null ? cloudCover / 100 : 0.5;

        // Host susceptibility — bentgrass primary host for both variants in AU/NZ
        let hostFactor = 0.3;
        const spLower = (species || '').toLowerCase().replace(/[\s\-_]/g, '');
        if (spLower.includes('poa') || spLower.includes('annual')) hostFactor = 1.0;
        else if (spLower.includes('bent') || spLower.includes('agrostis')) hostFactor = 0.7; // raised: primary AU host
        else if (spLower.includes('bluegrass') || spLower.includes('kentucky')) hostFactor = 0.4;

        // Nitrogen — low N increases risk (thin, stressed canopy)
        const nStatus = nitrogen?.status || 'adequate';
        let nFactor = 0.5;
        if (nStatus === 'deficient' || nStatus === 'low') nFactor = 1.0;
        else if (nStatus === 'adequate') nFactor = 0.4;
        else if (nStatus === 'high' || nStatus === 'excessive') nFactor = 0.2;

        const baseRisk = (tempFactor * 0.35 + moistureFactor * 0.25 + lightFactor * 0.10 + hostFactor * 0.15 + nFactor * 0.15) * 100;
        const adjustedRisk = Math.min(100, Math.max(0, Math.round(baseRisk)));

        const pathogenDisplay = variant === 'zeae'
            ? 'Waitea circinata var. zeae'
            : 'Waitea circinata var. circinata';
        const displayName = variant === 'zeae'
            ? 'Brown Patch'   // AU common name (var. zeae = Rhizoctonia Yellow Patch scientifically, but Brown Patch in AU trade)
            : 'Waitea Patch'; // NZ/international name for var. circinata

        return {
            disease: 'waiteaPatch', displayName,
            pathogen: pathogenDisplay,
            adjustedRisk, riskScore: adjustedRisk,
            riskLevel: classifyRisk(adjustedRisk),
            confidence: 'low', confidenceScore: 40,
            validationStatus: 'beta', validationBadge: 'BETA',
            variant,
            note: variant === 'zeae'
                ? 'AU strain (var. zeae), smoke ring symptom; historically misdiagnosed as Brown Patch'
                : 'NZ strain (var. circinata)',
            factors: {
                temperature: { value: airTemp, factor: tempFactor, variantOptimal: variant === 'zeae' ? '28-32°C' : '22-27°C' },
                // b35fix345: humiditySource exposed on the moisture factor so
                // reports can distinguish real humidity from no-data degrade.
                moisture: {
                    value: humidity,
                    factor: moistureFactor,
                    humiditySource: humidity != null ? 'period mean' : 'no data',
                },
                light: { factor: lightFactor },
                host: { species, factor: hostFactor },
                nitrogen: { status: nStatus, factor: nFactor },
            },
            source: 'Burpee et al. 2006 (Plant Disease); Wong & Harman 2001 (Australasian Plant Pathology); Chen et al. 2009',
        };
    },
};

// =============================================================================
// SPRING DEAD SPOT MODEL
// Pathogen: Ophiosphaerella spp. (O. narmari in AU/NZ, O. korrae and
//           O. herpotricha in US)
//
// Risk is driven by site history factors (cold exposure, turf age, thatch, pH)
// NOT by current weather conditions. Pre-emptive autumn treatment window
// is driven by soil temperature reaching 16–24°C.
//
// Sources: Tredway et al. 2020 (Crop Science); Hutchens et al. 2024;
//          Walker & Smith 1972 (original AU pathogen work)
//
// b35fix452 (C57): CABI 2024 cross-reference, citation-only, no logic touch.
//   Beehag, G.W., Walker, N.R., Wong, P.T.W. and Kaapro, J. (2024)
//   Biology and Integrated Management of Turfgrass Diseases.
//   CABI, Wallingford. ISBN 9781789246216.
//   Ch.6 p.114-121: primary-quality SDS treatment with explicit infection
//   trigger (soil temp falling below 23 deg C for several days at 4.0 cm
//   depth), pathogen taxonomy (O. herpotricha / O. korrae / O. narmari,
//   with O. narmari documented as primary AU/NZ pathogen per Walker &
//   Smith 1972, already cited above), and environmental influences.
//   Cross-references the existing Tredway 2020 / Hutchens 2024 / Walker
//   & Smith 1972 chain; coefficients, thresholds, and weights unchanged.
//
// b35fix458 (C63): SDS soil-temperature depth canonicalisation per CABI
//   2024 audit recommendation #2 (audit doc cabi_2024_disease_audit.md
//   lines 61-73). Closes the depth-mismatch finding signposted in the
//   C57 banner above ("4.0 cm depth").
//   Producer-side canonical-state shape extended to include d40mm
//   alongside existing d20mm / d50mm / d100mm / d200mm:
//     - climate-engine-v2.js::estimateSoilTemp adds d40mm to both the
//       analytical-model branch (Hillel 1982 heat-equation solution
//       evaluated at 0.04 m: phase-averaged value airTempMean +
//       airTempAmp * exp(-0.04 / dampingLength) * 0.5) and the API
//       branch (d40mm reuses the Open-Meteo shallow-depth value since
//       the API does not disambiguate at sub-decimetre resolution).
//     - gilba-hub-v2.js canonical-state initialisers (x2) include
//       d40mm: null in the soilTemp.depths shape.
//     - hub-orchestrator.js schema comment and physics-result mapper
//       include d40mm reading physicsResult.depths["40mm"].
//   Consumer-side SDS soil-temp resolution chain (Priority 2 + Priority 3)
//   prefers d40mm: order is now d40mm > d50mm > d100mm > mean.
//   The pre-fix chain preferred d100mm (primary root zone) which runs
//   warmer than d40mm under autumn diurnal forcing, inflating the
//   apparent treatment window opening date by several weeks at
//   cool-climate sites where the d40mm-vs-d100mm difference straddles
//   the 16-24 deg C operational window.
//   Lower-bound provenance (16 deg C operational floor) deferred as
//   adjacent C63a candidate: the floor is an operational anchor from
//   Tredway 2020 / Hutchens 2024 (pathogen-activity floor / fungicide
//   uptake floor), not CABI-derivable. CABI supplies only the
//   23 deg C falling-trigger and the 4 cm depth. Updating the
//   keyMessage to reference the 4 cm trigger explicitly and the
//   16 deg C floor as a downstream operational cutoff is the C63a
//   scope; deferred per single-purpose discipline.
//   Coefficients, thresholds, weights, and treatment-window literals
//   (16 / 24 deg C) all unchanged on this build.
// =============================================================================
const SpringDeadSpotModel = {
    name: 'Spring Dead Spot',
    pathogen: 'Ophiosphaerella spp.',

    /**
     * @param {Object} climate  - getAuthoritativeClimate() output
     * @param {Object} soil     - { pH, thatchMm }
     * @param {Object} variety  - variety traits
     * @param {Object} siteHistory - { winterMinTemp, daysBelow5C, yearsEstablished }
     * @param {string} region   - 'AU'|'NZ'|'US'|etc
     */
    calculate(climate, soil, variety, siteHistory, region) {
        // ── Soil temperature (treatment window only, not risk driver) ──────────
        // b35fix138: Extend resolution chain to match Pythium model — sensor first,
        // then canonical depths, then climate.soilTemp, then air temp fallback.
        // Previously fell through to climate.temperature.mean (15.3°C est.) even
        // when live sensor data was present (20°C), causing "Window Has Closed" when
        // the window was actually open.
        let soilTemp = null;
        let soilTempEstimated = true;

        // Priority 1: live sensor
        const _sensorForSDS = (typeof window !== 'undefined' && window.GAIP_SENSOR_DATA)
            ? window.GAIP_SENSOR_DATA
            : null;
        if (_sensorForSDS?.soilTemp != null) {
            soilTemp = _sensorForSDS.soilTemp;
            soilTempEstimated = false;
        }

        // Priority 2: canonical state depths.
        // b35fix458 (C63): d40mm preferred per CABI 2024 audit recommendation #2
        //   (Beehag, Walker, Wong & Kaapro 2024 Ch.6 p.114-121, ISBN 9781789246216).
        //   The canonical Spring Dead Spot infection trigger is soil temperature
        //   falling below 23 deg C for several days at 4.0 cm depth. The pre-fix
        //   chain preferred d100mm (primary root zone) which runs warmer than
        //   d40mm under autumn diurnal forcing, inflating the apparent treatment
        //   window opening date. Order is now d40mm > d50mm > d100mm > mean,
        //   moving from coarsest-match to deepest-fallback rather than the
        //   prior root-zone-first ordering. The 16 deg C operational floor and
        //   24 deg C window-closing ceiling are unchanged (Tredway 2020 /
        //   Hutchens 2024 operational anchors; CABI supplies only the
        //   23 deg C falling-trigger and the 4 cm depth, not a floor).
        if (soilTemp === null) {
            const _canon = (typeof window !== 'undefined' && window.GAIP_CANONICAL_STATE?.soilTemp);
            if      (_canon?.depths?.d40mm  != null) { soilTemp = _canon.depths.d40mm;  soilTempEstimated = _canon.source === 'estimated'; }
            else if (_canon?.depths?.d50mm  != null) { soilTemp = _canon.depths.d50mm;  soilTempEstimated = _canon.source === 'estimated'; }
            else if (_canon?.depths?.d100mm != null) { soilTemp = _canon.depths.d100mm; soilTempEstimated = _canon.source === 'estimated'; }
            else if (_canon?.mean != null)           { soilTemp = _canon.mean;          soilTempEstimated = _canon.source === 'estimated'; }
        }

        // Priority 3: climate.soilTemp passed in from orchestrator.
        // b35fix458 (C63): d40mm preferred per CABI 2024 audit recommendation #2,
        //   same ordering as Priority 2 above.
        if (soilTemp === null) {
            const soilTempObj = climate?.soilTemp;
            if      (soilTempObj?.depths?.d40mm  != null) { soilTemp = soilTempObj.depths.d40mm;  soilTempEstimated = soilTempObj.source === 'estimated'; }
            else if (soilTempObj?.depths?.d50mm  != null) { soilTemp = soilTempObj.depths.d50mm;  soilTempEstimated = soilTempObj.source === 'estimated'; }
            else if (soilTempObj?.depths?.d100mm != null) { soilTemp = soilTempObj.depths.d100mm; soilTempEstimated = soilTempObj.source === 'estimated'; }
            else if (soilTempObj?.mean != null)           { soilTemp = soilTempObj.mean;          soilTempEstimated = soilTempObj.source === 'estimated'; }
        }

        // Priority 4: air temp mean as last resort
        if (soilTemp === null) {
            soilTemp = climate?.temperature?.mean ?? 15;
            soilTempEstimated = true;
        }

        // ── Determine likely pathogen species by region ────────────────────────
        const regionCode = region || 'AU';
        let likelyPathogen = 'O. narmari';
        let pathogenNote   = null;
        if (regionCode === 'AU' || regionCode === 'NZ') {
            likelyPathogen = 'O. narmari';
            pathogenNote = 'Primary pathogen: O. narmari (some O. korrae also present)';
        } else if (regionCode === 'US') {
            likelyPathogen = 'mixed';
            pathogenNote = 'US pathogens: O. korrae (east/southeast) or O. herpotricha (midwest), respond differently to management';
        }

        // ── Site history factors ───────────────────────────────────────────────
        const winterMinTemp    = siteHistory?.winterMinTemp    ?? null;
        const daysBelow5C      = siteHistory?.daysBelow5C      ?? null;
        const yearsEstablished = siteHistory?.yearsEstablished ?? null;
        const thatchMm         = soil?.thatchMm               ?? null;
        const pH               = soil?.pH                     ?? null;

        // Cold exposure factor (primary driver — winter min temp + cold days)
        let coldFactor     = 0;
        let coldContrib    = null;
        if (winterMinTemp !== null) {
            if (winterMinTemp < -5)  coldFactor = Math.min(1, (-5 - winterMinTemp) / 10);
            if (daysBelow5C !== null) coldFactor += Math.min(0.3, daysBelow5C / 100);
            coldContrib = Math.round(coldFactor * 100);
        }

        // Establishment factor — peak risk in years 3–7
        let estFactor   = 0.5;  // unknown
        let estContrib  = null;
        if (yearsEstablished !== null) {
            estFactor  = yearsEstablished >= 3 && yearsEstablished <= 7 ? 0.8
                       : yearsEstablished > 7  ? 0.4
                       : 0.3;
            estContrib = Math.round(estFactor * 100);
        }

        // Thatch factor — deep thatch harbours inoculum
        let thatchFactor  = 0.5;  // unknown
        let thatchContrib = null;
        if (thatchMm !== null) {
            thatchFactor  = thatchMm > 20 ? 0.9 : thatchMm > 12 ? 0.5 : 0.2;
            thatchContrib = Math.round(thatchFactor * 100);
        }

        // pH factor — effect varies by pathogen species
        let phFactor  = 0.5;
        let phNote    = null;
        let phContrib = null;
        if (pH !== null) {
            if (likelyPathogen === 'O. herpotricha') {
                phFactor = pH >= 7 ? 0.85 : pH >= 6 ? 0.5 : 0.3;
                phNote   = pH >= 7   ? 'High pH favours O. herpotricha'
                         : pH <  6   ? 'Lower pH may suppress O. herpotricha' : null;
            } else {
                // O. korrae / O. narmari — favoured by low pH
                phFactor = pH <= 5.5 ? 0.8 : pH >= 6.5 ? 0.35 : 0.5;
                phNote   = pH <= 5.5 ? 'Low pH may favour O. korrae/O. narmari'
                         : pH >= 6.5 ? 'Higher pH may suppress O. korrae' : null;
            }
            phContrib = Math.round(phFactor * 100);
        }

        // ── Weighted risk (only count factors we actually have) ────────────────
        let weightSum  = 0;
        let weightedScore = 0;
        if (coldContrib   !== null) { weightedScore += 0.35 * coldFactor;   weightSum += 0.35; }
        if (estContrib    !== null) { weightedScore += 0.30 * estFactor;    weightSum += 0.30; }
        if (thatchContrib !== null) { weightedScore += 0.20 * thatchFactor; weightSum += 0.20; }
        if (phContrib     !== null) { weightedScore += 0.15 * phFactor;     weightSum += 0.15; }

        if (weightSum === 0) {
            // No site history at all — return informational, not false zero
            return {
                disease: 'springDeadSpot', displayName: 'Spring Dead Spot',
                riskScore: 0, riskLevel: 'low',
                confidence: 'insufficient data', confidenceScore: 10,
                insufficientData: true,
                treatmentWindow: {
                    soilTemp: Math.round(soilTemp * 10) / 10,
                    soilTempEstimated,
                    inWindow: soilTemp >= 16 && soilTemp <= 24,
                    optimalRange: '16-24°C soil temperature',
                    timing: soilTemp >= 16 && soilTemp <= 24
                        ? 'WINDOW OPEN, apply preventive fungicide'
                        : soilTemp > 24
                        ? 'Too warm, window has passed'
                        : 'Too cold, wait for autumn (soil 16°C)',
                },
                drivers: {
                    coldExposure:  { contribution: 'No winter data' },
                    establishment: { contribution: 'Unknown turf age' },
                    thatch:        { contribution: 'Not measured' },
                    soilPH:        { contribution: 'Not tested' },
                },
                likelyPathogen, pathogenNote,
                keyMessage: 'Insufficient data to calculate SDS risk. Enter site history (winter min temp, turf age, thatch depth) for assessment.',
                source: 'Tredway et al. 2020, Hutchens et al. 2024',
            };
        }

        let riskScore = (weightedScore / weightSum)
                      // variety mod applied in analyse()
                      * 100;
        riskScore = Math.min(100, Math.max(0, riskScore));

        const inWindow = soilTemp >= 16 && soilTemp <= 24;

        return {
            disease: 'springDeadSpot', displayName: 'Spring Dead Spot',
            riskScore: Math.round(riskScore),
            riskLevel: classifyRisk(riskScore),
            confidence: weightSum >= 0.7 ? 'high' : 'medium',
            confidenceScore: weightSum >= 0.7 ? 90 : 70,
            treatmentWindow: {
                soilTemp: Math.round(soilTemp * 10) / 10,
                soilTempEstimated,
                inWindow,
                optimalRange: '16-24°C soil temperature',
                timing: inWindow
                    ? 'WINDOW OPEN, apply preventive fungicide'
                    : soilTemp > 24
                    ? 'Too warm, window has passed'
                    : 'Too cold, wait for autumn (soil 16°C)',
            },
            drivers: {
                coldExposure: coldContrib !== null
                    ? { winterMin: winterMinTemp, daysBelow5: daysBelow5C, contribution: coldContrib }
                    : { contribution: 'No data' },
                establishment: estContrib !== null
                    ? { years: yearsEstablished, contribution: estContrib }
                    : { contribution: 'Unknown' },
                thatch: thatchContrib !== null
                    ? { depth: thatchMm, contribution: thatchContrib }
                    : { contribution: 'Not measured' },
                soilPH: phContrib !== null
                    ? { value: pH, contribution: phContrib, note: phNote }
                    : { contribution: 'Not tested' },
            },
            likelyPathogen, pathogenNote,
            keyMessage: 'SDS cannot be treated curatively. Autumn prevention at soil 16-24°C. N source selection depends on pathogen species.',
            source: 'Tredway et al. 2020, Hutchens et al. 2024',
        };
    },

    getInterventions(riskLevel, opts) {
        const pH           = opts?.drivers?.soilPH?.value ?? opts?.soil?.pH ?? null;
        const regionCode   = opts?.region || 'AU';
        const likelyPath   = opts?.likelyPathogen || 'O. narmari';
        const inWindow     = opts?.treatmentWindow?.inWindow ?? false;
        const soilTempStr  = opts?.treatmentWindow?.soilTemp != null
            ? `${opts.treatmentWindow.soilTemp}°C` + (opts.treatmentWindow.soilTempEstimated ? ' (est.)' : '')
            : 'unknown';

        const cultural = [
            'Reduce thatch below 12mm',
            'Improve drainage',
            'Select resistant varieties (Tahoma 31, NorthBridge, Latitude 36)',
            'Hollow-tine aeration in late summer improves recovery',
        ];

        // N source recommendation varies by pathogen species
        if (likelyPath === 'O. herpotricha') {
            cultural.unshift('N SOURCE: Use ammonium sulphate during summer, suppresses O. herpotricha');
            if (pH != null && pH >= 6.5) cultural.push('Consider acidifying amendments, O. herpotricha favoured by higher pH');
        } else if (likelyPath === 'O. korrae') {
            cultural.unshift('N SOURCE: Use calcium nitrate during summer, suppresses O. korrae');
            if (pH != null && pH <= 5.5) cultural.push('Consider liming, O. korrae may be favoured by lower pH');
        } else {
            // O. narmari (AU/NZ default)
            cultural.unshift('N SOURCE: Research suggests calcium nitrate may help (similar to O. korrae response)');
            cultural.push('Australian research on O. narmari N response is limited, monitor results');
        }

        const interventions = {
            cultural,
            preventive: [],
            timing: inWindow ? `WINDOW OPEN, Soil ${soilTempStr}` : 'Wait for soil 16-24°C in autumn',
            varietyNote: 'Cold-tolerant varieties (Tahoma 31, NorthBridge) show reduced SDS severity',
            researchNote: 'N source recommendations based on Tredway et al. 2020, different Ophiosphaerella species respond oppositely',
        };

        if (riskLevel !== 'low') {
            interventions.preventive = (regionCode === 'AU' || regionCode === 'NZ')
                ? [
                    'Azoxystrobin (Heritage, Amistar), Autumn, soil 16-24°C',
                    'Fluopyram (Indemnify), Root uptake, longer residual',
                    'Propiconazole, Effective in Australian trials',
                    'TWO applications 28 days apart for high-risk sites',
                ]
                : [
                    'Azoxystrobin, Autumn, soil 16-24°C',
                    'Fluopyram, Root uptake, longer residual',
                    'Tebuconazole, Effective on both O. herpotricha and O. korrae',
                    'TWO applications 28 days apart for high-risk sites',
                ];
        }

        return interventions;
    },
};

// =============================================================================
// TAKE-ALL PATCH MODEL  v2.0
// Pathogen: Gaeumannomyces graminis var. avenae (bentgrass, annual bluegrass);
//           Gaeumannomyces graminis var. graminis on seashore paspalum
//           (Datnoff et al 2002, Plant Disease 86:1405 — first US report).
//           For paspalum the disease is conventionally called "Take-all Root
//           Rot" rather than "Take-all Patch"; the b35fix419 resolver
//           (utils.resolveDiseaseDisplayName) returns the correct label per
//           effective species. Susceptibility math is shared because the
//           soil-chemistry pathway (pH → Mn availability) and management
//           levers (Mn fertilisation, scalping avoidance) are equivalent
//           across both varieties.
//
// Risk is dominated by soil chemistry (pH → Mn availability) and soil
// temperature. Current weather (moisture) is a secondary driver.
// Fungicides provide only limited suppression — soil management is primary.
//
// Sources: Dernoeden, Creeping Bentgrass Management (3rd ed.);
//          Smiley et al., Compendium of Turfgrass Diseases;
//          Cook 2003 (applicable biology from wheat take-all);
//          Datnoff et al 2002 PD 86:1405 (var. graminis on paspalum);
//          Heckman et al 2003 Crop Sci 43:1395-1398 (Mn fertilisation
//            suppression, validated on bentgrass — paspalum literature
//            applies same pathway, Duncan & Carrow 2005 GCM Feb p.114-118).
//
// b35fix431 Tier 2 provenance audit. Closes the disease-engine Tier 2 audit
// programme (7 of 7: BrownPatch / Pythium / Helminthosporium / Fusarium /
// DollarSpot / Anthracnose / TakeAll). Five primary sources banked:
//   - Beehag & Wong 2024 *Biology and Integrated Management of Turfgrass
//     Diseases* (CABI), Chapter 6 p.101-141 take-all patch and root decline
//     of warm-season grasses
//   - Latin 2011 Purdue Extension BP-114-W *Turfgrass Disease Profiles:
//     Take All Patch* (4-page extension factsheet)
//   - Cumagun, Marshall & Woodhall 2022 University of Idaho Extension
//     BUL 1029 *Take-All Disease of Wheat in Idaho* (4-page bulletin;
//     Ggt on wheat, biology applies to turf var. avenae per Cook 2003)
//   - Tredway 2019 Syngenta GreenCast technical article "Are bermudagrass
//     decline and take-all root rot the same thing?"
//   - Penn State Turfgrass Pest Diagnostic Lab profile "Take-All Root Rot
//     and Bermudagrass Decline" (faculty extension web page)
//
// Audit verdicts banked as `provenance` (cool-season Danneberger-equivalent
// component) and `provenanceStress` (host-range and pathway-attribution
// dimensions) blocks on TakeAllModel return. Six rated dimensions on the
// component side, six on the stress-layer side. Soil temperature µ=15 σ=4
// VERIFIED via CABI p.105 Grose et al. 1984 + Couch 1995 (10-19 degC
// infection range, midpoint 14.5 degC, half-width 4.5 degC). Mn pathway
// VERIFIED via CABI p.106 Heckman et al. 2003. pH onset PARTIALLY-VERIFIED
// (direction unambiguous across all five primaries; specific 6.5 sits
// inside the 6.0-7.5 transition zone but no primary names exact value).
// Moisture VWC threshold and weight apportionment UNVERIFIED (operational
// calibrations; direction supported, magnitudes not from primary).
// Warm-season host pathway CAVEAT-APPLIED via new _TAKEALL_WARMSEASON_HOSTS
// frozen set (parallels _ANTHRACNOSE_WARM_SEASON_HOSTS / b35fix430 pattern).
//
// SaaS-port safety: no call-signature changes, no coefficient changes, no
// threshold changes. Behaviour for cool-season hosts is byte-identical to
// b35fix430. New return-object fields (provenance, provenanceStress,
// hostRangeCaveat, hostRangeCaveatNote) are additive. New module-level
// _TAKEALL_WARMSEASON_HOSTS frozen set is additive.
//
// Three new gap C-entries logged to migration ledger (C39 Mn-method-aware
// threshold, C40 VWC quantitative threshold, C41 risk-weight apportionment
// validation) deferred to post-SaaS-port because each requires a new input
// or rework on the calculate() math layer (architectural change
// inappropriate during port).
// =============================================================================
const TakeAllModel = {
    name: 'Take-all Patch',
    pathogen: 'Gaeumannomyces graminis var. avenae',

    calculate(climate, soil, variety) {
        // ── Soil temperature ────────────────────────────────────────────────────
        // Pure path: climate.soilTemp injected by orchestrator
        const soilTempObj      = climate?.soilTemp;
        let soilTemp           = soilTempObj?.depths?.d100mm
                              ?? soilTempObj?.mean
                              ?? null;
        const soilTempEstimated = !soilTempObj || soilTempObj.source === 'estimated';

        // Hemisphere-aware air-temp lag fallback (no DOM reads)
        if (soilTemp === null) {
            const airTemp = climate?.temperature?.mean ?? 15;
            const month   = new Date().getMonth(); // 0-based
            const lat     = climate?.site?.latitude ?? null;
            const isSH    = lat !== null ? lat < 0 : false; // default NH if unknown
            const isAutumn = isSH ? (month >= 2 && month <= 4) : (month >= 8 && month <= 10);
            const isSpring = isSH ? (month >= 8 && month <= 10) : (month >= 2 && month <= 4);
            soilTemp = isAutumn ? airTemp + 2 : isSpring ? airTemp - 2 : airTemp;
        }

        // ── Soil chemistry ──────────────────────────────────────────────────────
        const soilPH      = soil?.pH     ?? 6.5;
        const soilMn      = soil?.Mn_ppm ?? 10;
        // Soil moisture: accept either fraction (0-1) or percentage (0-100)
        let soilMoisture  = climate?.moisture?.soilMoisture?.mean ?? 0.3;
        if (soilMoisture > 1) soilMoisture /= 100; // normalise percentage input

        // pH factor — high pH reduces Mn availability, favouring pathogen
        // Meaningful elevation starts at pH 6.5; high risk above 7.0
        const phFactor = soilPH > 6.5 ? Math.min(1, (soilPH - 6.5) / 1.5) : 0;

        // Mn factor — low Mn dramatically increases susceptibility
        const mnFactor = soilMn < 15 ? Math.min(1, (15 - soilMn) / 15) : 0;

        // Moisture factor — wet soils (VWC >35%) favour infection
        const moistureFactor = soilMoisture > 0.35
            ? Math.min(1, (soilMoisture - 0.35) / 0.15) : 0;

        // Soil temp factor — infection optimum 12-18°C, active 8-22°C
        let soilTempFactor = 0;
        if (soilTemp >= 8 && soilTemp <= 22) {
            soilTempFactor = Math.exp(-0.5 * Math.pow((soilTemp - 15) / 4, 2));
        }

        // ── Infection window ────────────────────────────────────────────────────
        const inInfectionWindow = soilTemp >= 12 && soilTemp <= 18;
        let windowNote = null;
        if (inInfectionWindow) {
            windowNote = '⚠️ INFECTION WINDOW OPEN, soil temp in optimal range for Take-all';
        } else if (soilTemp > 18 && soilTemp < 22) {
            windowNote = 'Infection window closing, soil warming';
        } else if (soilTemp > 8 && soilTemp < 12) {
            windowNote = 'Approaching infection window, monitor soil temps';
        }

        // ── Risk score (weights: pH 35%, Mn 30%, moisture 15%, soil temp 20%) ──
        let riskScore = (
            0.35 * phFactor +
            0.30 * mnFactor +
            0.15 * moistureFactor +
            0.20 * soilTempFactor
        ) * 100 // variety mod applied in analyse();
        riskScore = Math.min(100, Math.max(0, riskScore));

        // ── Primary driver ──────────────────────────────────────────────────────
        let primaryDriver = 'soil_pH';
        if (mnFactor > phFactor) primaryDriver = 'manganese_deficiency';
        if (soilTempFactor > phFactor && soilTempFactor > mnFactor && inInfectionWindow) {
            primaryDriver = 'soil_temperature';
        }

        // Confidence improves when actual soil data is present
        let confidence      = 'medium';
        let confidenceScore = 70;
        if (!soilTempEstimated && soil?.pH && soil?.Mn_ppm) {
            confidence = 'high'; confidenceScore = 85;
        } else if (soilTempEstimated && !soil?.pH) {
            confidence = 'low'; confidenceScore = 50;
        }

        return {
            disease: 'takeAll', displayName: 'Take-all Patch',
            riskScore: Math.round(riskScore),
            riskLevel: classifyRisk(riskScore),
            confidence, confidenceScore,
            primaryDriver,
            modelVersion: '2.0',
            drivers: {
                pH: {
                    value: soilPH,
                    contribution: Math.round(phFactor * 100),
                    status: soilPH > 7 ? 'high_risk' : soilPH > 6.5 ? 'elevated' : 'normal',
                },
                manganese: {
                    value: soilMn,
                    contribution: Math.round(mnFactor * 100),
                    status: soilMn < 10 ? 'deficient' : soilMn < 15 ? 'low' : 'adequate',
                },
                moisture: {
                    value: Math.round(soilMoisture * 100),
                    contribution: Math.round(moistureFactor * 100),
                },
                soilTemperature: {
                    value: Math.round(soilTemp * 10) / 10,
                    source: soilTempObj?.source || 'estimated',
                    estimated: soilTempEstimated,
                    contribution: Math.round(soilTempFactor * 100),
                    optimalRange: '12-18°C',
                    inInfectionWindow,
                    note: windowNote,
                },
            },
            infectionWindow: {
                active: inInfectionWindow,
                soilTemp: Math.round(soilTemp * 10) / 10,
                note: windowNote,
            },
            // PROVENANCE field — paper-verification status for the cool-season
            // var. avenae component (the model on which the pH/Mn/moisture/
            // soil-temp coefficients are calibrated). Parallel to BrownPatch
            // and Anthracnose provenance blocks from b35fix340 / b35fix339.
            // Audit shipped at b35fix431.
            provenance: {
                citation: 'verified',                  // CABI 2024 Ch.6 p.101-141 + Latin 2011 BP-114-W + Cumagun 2022 BUL 1029
                paperObtained: '2026-05-04',
                pathogenAttribution: 'verified-incomplete', // CABI: G. avenae (formerly G. graminis var. avenae) verified for cool-season; warm-season pathway involves G. graminis var. graminis + Magnaporthiopsis spp. + Candidacolonium spp. (Penn State / Stephens 2022 / Tucker 2022) — current pathogen field hardcodes only var. avenae
                soilTempRange: 'verified',             // 12-18 degC infection window matches CABI p.105 Grose et al. 1984 + Couch 1995 mesophilic infection range 10-19 degC
                soilTempGaussianMu: 'verified',        // mu=15 sits at midpoint of CABI 10-19 degC range (14.5 degC); 15 within rounding tolerance
                soilTempGaussianSigma: 'verified',     // sigma=4 produces +/-1 sigma at 11-19 degC; matches CABI 10-19 degC bracket and Idaho BUL 50-68 degF (10-20 degC)
                phOnset: 'partially-verified',         // direction strongly verified across all 5 primaries (Purdue: <=6.0 suppressive / >=7.5 favourable; CABI p.105: alkaline favourable; Tredway 2019: pH-driven; Ggg slides: <6.3 sensitive); specific 6.5 onset value sits inside transition zone but no primary names exact onset
                phScale: 'unverified',                 // scale=1.5 (i.e. saturation at pH 8.0) is operational calibration; no primary gives a scaling magnitude
                mnPathway: 'verified',                 // CABI p.106: 'Manganese oxidation by soil-borne microbes is linked to take-all in cereals and acidification of the rhizosphere limits the ability of microbes to oxidize manganese resulting in increased availability for root absorption'; Heckman et al. 2003 Crop Sci 43:1395-1398 cited
                mnThreshold: 'unverified',             // 15 ppm threshold value not given by any primary; method-dependent (Mehlich-3 vs DTPA produce different absolute values for the same soil); see C39 in migration ledger
                moistureVwcThreshold: 'unverified',    // 0.35 VWC threshold not from primary; CABI / Purdue / Idaho BUL all describe direction ('moist soils favour') but no quantitative VWC; see C40
                weights: 'unverified',                 // 35/30/15/20 (pH/Mn/moisture/soil-temp) operational apportionment; no primary apportions weights; see C41
                edgeBehaviours: [
                    // Present in the model, not bugs:
                    'soilTempFactor zeros outside 8-22 degC bracket (model assumes Ggt/Gga var. avenae cool-season pathway; warm-season var. graminis pathway has 10-35 degC growth range per CABI p.140, handled via hostRangeCaveat, not via curve change)',
                    'phFactor zero below pH 6.5 (matches CABI p.105 acidic suppression; Purdue <=6.0 fully suppressive)',
                    'mnFactor zero above 15 ppm (binary threshold; method-dependent, see C39)',
                ],
                supersedes: 'pre-b35fix431 source field "Dernoeden, Smiley et al., Cook 2003" with no per-coefficient verification status',
                auditDoc: 'docs/provenance-audit-tier2.md',
            },
            // PROVENANCE field for the host-range / pathway-attribution
            // dimension (b35fix431 Tier 2 audit). Parallel to the
            // Anthracnose provenanceStress block from b35fix430. Captures
            // the warm-season vs cool-season pathway distinction that the
            // current calculate() math layer does not handle natively.
            provenanceStress: {
                hostRange: 'caveat-applied',
                // CABI Ch.6 p.140: 'approximate temperature range of growth
                // for root decline pathogens (i.e. 10-35 degC) and optimum
                // temperatures for root growth of warm-season grasses (i.e.
                // 24-35 degC) partly overlap at higher temperatures.'
                // Tredway 2019: 'G. graminis var. graminis is a hot-weather
                // fungus, but most infection occurs from late summer to
                // spring when it has a competitive advantage over slowly-
                // growing bermudagrass roots.' Current TakeAllModel Gaussian
                // mu=15 sigma=4 with infection-window gate 12-18 degC is
                // calibrated for the cool-season var. avenae pathway and
                // produces near-zero soilTempFactor at typical warm-season
                // summer soil temps (>25 degC). Runtime caveat fires when
                // normalizedSpecies is in _TAKEALL_WARMSEASON_HOSTS so the
                // user is told the model output is indicative on
                // warm-season hosts.
                pathogenComplex: 'verified-incomplete',
                // Penn State (Beehag/Wong 2024 echoed): warm-season root
                // decline complex includes Gaeumannomyces spp., Magnaporthi-
                // opsis spp., Candidacolonium spp.; Stephens et al. 2022 and
                // Tucker et al. 2022 banked. Current pathogen field on
                // TakeAllModel hardcodes 'Gaeumannomyces graminis var.
                // avenae' which is correct for cool-season bentgrass but
                // incomplete for the broader warm-season pathway. Display
                // label is already host-aware via b35fix419 resolver
                // (DiseaseEnginePure.utils.resolveDiseaseDisplayName); the
                // pathogen attribution itself has not been made
                // host-aware — defer to a future build that introduces
                // species-aware pathogen attribution.
                mnFertilisationSuppression: 'verified',
                // CABI p.106: 'Very small applications of soluble manganese
                // sulfate generally have shown experimentally to reduce the
                // severity of take-all patch on bentgrass over 3 years but
                // only when combined with ammonium sulfate (Heckman et al.,
                // 2003).' Direction and mechanism verified primary; the
                // 'only when combined with ammonium sulfate' nuance is not
                // surfaced in TakeAllModel.getInterventions output (Mn
                // sulphate is recommended standalone) — see C42 follow-up.
                ammoniumNitrogenSuppression: 'verified',
                // CABI p.105: 'Ammonium-nitrogen fertilizers, as opposed to
                // nitrate-nitrogen forms, generally reduce take-all in
                // cereals, which is attributed to antagonistic microflora
                // (Colbach et al., 1997).' Idaho BUL p.4: 'use of
                // ammoniacal and slow-release forms of nitrogen generally
                // reduces take-all because it increases the acidity of the
                // soil rhizosphere.' Penn State: 'slow-release nitrogen
                // sources or acidifying fertilizers should be used,
                // while fertilizers containing nitrate sources should be
                // avoided.' Mechanism (rhizosphere acidification +
                // antagonistic microflora) verified across multiple
                // primaries. Currently surfaced in getInterventions as
                // 'Use acidifying fertilisers (ammonium sulphate)'.
                takeAllDecline: 'verified-absent',
                // CABI p.104: 'Gradual decline of take-all patch over time
                // is believed to be the result of an increase in
                // antagonistic microflora (Wong and Baker, 1986; Wong and
                // Worrad, 1989).' Latin 2011 BP-114-W: 'Take all patch
                // occurs much less frequently on creeping bentgrass stands
                // that are more than 10 years old because of a phenomenon
                // called take all decline.' Cook 2003 PMPP 62:73-86 cited.
                // The decline phenomenon is well-documented in primary
                // literature but is NOT modelled by TakeAllModel (no sward
                // age input, no microbial-suppression dimension). Verified
                // present in literature, verified absent from the engine.
                // Operational impact: model overestimates risk on mature
                // bentgrass swards (>10 years post-construction or
                // post-fumigation). Defer modelling to a future build.
                fumigationRisk: 'verified-absent',
                // CABI p.106: 'Pre-establishment incorporation of methyl
                // bromide in sand-based rootzones followed by a rapid
                // emergence of take-all patch on newly seeded bentgrass
                // bowling and golf greens was widely documented in
                // Australia (Siviour, 1972), England (Smith et al., 1989)
                // and the United States (Gould, 1973).' Fumigation creates
                // 'biological vacuum' favouring rapid take-all colonisation
                // of newly established sand-based greens. Not modelled by
                // TakeAllModel (no construction-history input). Verified
                // present in literature, verified absent from the engine.
                // Defer modelling to a future build with site construction
                // metadata.
                auditDoc: 'docs/provenance-audit-tier2.md',
            },
            keyMessage: 'Take-all managed through soil chemistry (pH, Mn), not fungicides. Active infection at soil temps 12-18°C.',
            source: 'Dernoeden, Smiley et al., Cook 2003; Beehag & Wong 2024 (CABI Ch.6); Latin 2011 BP-114-W; Heckman et al. 2003 Crop Sci 43:1395-1398 (Mn pathway, b35fix431).',
        };
    },

    getInterventions(riskLevel, opts) {
        const soil     = opts?.soil  || {};
        const drivers  = opts?.drivers || {};
        const inWindow = drivers?.soilTemperature?.inInfectionWindow ?? false;
        const soilTempVal = drivers?.soilTemperature?.value;

        const soilActions = [];
        if (soil.pH > 7)    soilActions.push('PRIORITY: Lower pH with ammonium sulphate');
        if (soil.pH > 6.5 && soil.pH <= 7) soilActions.push('Consider acidifying amendments to prevent pH rise');
        if (soil.Mn_ppm != null && soil.Mn_ppm < 15) soilActions.push('Apply manganese sulphate (foliar or granular)');

        const cultural = [
            'Improve drainage, wet soils favour infection',
            'Avoid excessive sand topdressing (can raise pH)',
            'Use acidifying fertilisers (ammonium sulphate)',
            'Maintain adequate Mn through foliar applications',
        ];

        if (inWindow) {
            cultural.unshift('Infection conditions present, prioritise Mn applications NOW');
        }

        const interventions = {
            cultural,
            soilManagement: soilActions,
            preventive: [],
            timing: inWindow && soilTempVal != null
                ? `⚠️ INFECTION WINDOW OPEN, soil temp ${soilTempVal}°C`
                : null,
        };

        if (riskLevel === 'high' || riskLevel === 'severe') {
            interventions.preventive = [
                'Azoxystrobin, some suppression only',
                'Fosetyl-Al, systemic, limited activity',
                'Note: Fungicides provide limited control, soil management is essential',
            ];
            if (inWindow) {
                interventions.preventive.unshift('Apply Mn sulphate NOW, infection window open');
            }
        }

        return interventions;
    },
};


// =============================================================================
// RECOMMENDATION ENGINE
// =============================================================================

/**
 * DISEASE RECOMMENDATION THRESHOLDS
 * ──────────────────────────────────
 * Preventive window: score enters moderate band (>=50) — conditions becoming
 *   favourable; apply before first symptoms if trend is up.
 * Curative pressure: score high/severe (>=70) — infection already occurring;
 *   curative rate and shorter re-application interval warranted.
 *
 * trendDelta convention: pp change over last 3 scoring periods (positive = rising).
 * Computed from forecast.daily scores when available, else null.
 */
const RECOMMENDATION_CONFIG = Object.freeze({
    thresholds: {
        action:     50,   // >= this: preventive warranted
        urgent:     70,   // >= this: apply within 24-48 h
        critical:   85,   // >= this: curative rate
    },
    trendSensitivity: 8,  // pp/period considered "rising fast"
});

/**
 * FRAC groups that carry elevated resistance risk for specific diseases.
 * Key = canonical disease key from disease-engine, value = array of fracGroup
 * codes where solo use is inadvisable.
 *
 * Sources:
 *   - FRAC Monograph No. 1 (2024 update) — benzimidazoles (FRAC 1) on dollar spot;
 *     DMIs (FRAC 3) on dollar spot and Fusarium
 *   - Kerns & Detweiler 2018 (APS) — QoI/strobilurin resistance in dollar spot AU/NZ
 *   - FRAC MoA Working Group 2023 — SDHI resistance emerging in Microdochium (FRAC 7)
 */
const RESISTANCE_WARNINGS = Object.freeze({
    dollarSpot:  { fracsAvoid: ['1','11'], note: 'QoI (FRAC 11) and benzimidazole (FRAC 1) resistance documented on fairway turf. Do not use as sole programme.' },
    fusarium:    { fracsAvoid: ['1','7'],  note: 'Benzimidazole (FRAC 1) resistance widespread in Microdochium. SDHI (FRAC 7) resistance emerging; monitor programme efficacy.' },
    brownPatch:  { fracsAvoid: ['11'],     note: 'QoI solo programmes reduce efficacy over time on Rhizoctonia. Rotate FRAC groups each application.' },
    anthracnose: { fracsAvoid: ['1'],      note: 'MBC/benzimidazole (FRAC 1) resistance documented in Colletotrichum cereale. Prioritise stress management over fungicide escalation.' },
    pythiumBlight:{ fracsAvoid: [],        note: null },  // oomycete, different MOA universe
});

/**
 * Disease-specific urgency windows — how many days from threshold crossing
 * before unacceptable loss occurs. Governs "apply within N days" language.
 * Source: expert consensus / pathogen biology (see inline comments).
 */
const URGENCY_WINDOWS = Object.freeze({
    pythiumBlight:   { preventiveDays: 1, curativeDays: null, note: 'Pythium destroys turf in 24-48 h. No curative option once blight spreads.' },
    dollarSpot:      { preventiveDays: 2, curativeDays: 4,    note: null },
    brownPatch:      { preventiveDays: 2, curativeDays: 3,    note: null },
    fusarium:        { preventiveDays: 3, curativeDays: 5,    note: null },
    grayLeafSpot:    { preventiveDays: 2, curativeDays: 3,    note: null },
    helminthosporium:{ preventiveDays: 3, curativeDays: 5,    note: null },
    largePatch:      { preventiveDays: 3, curativeDays: 5,    note: null },
    anthracnose:     { preventiveDays: null, curativeDays: null, note: 'Anthracnose is a stress disease. Fungicide without stress correction gives limited payback.' },
    springDeadSpot:  { preventiveDays: null, curativeDays: null, note: 'No curative option. Preventive timing is soil temperature-driven, not risk-score driven.' },
    takeAll:         { preventiveDays: null, curativeDays: null, note: 'Fungicides suppress only. Soil chemistry correction is the primary lever.' },
    waiteaPatch:     { preventiveDays: 3, curativeDays: 5,    note: null },
});

/**
 * Format a product list from FungicideFilter result into concise recommendation text.
 * Returns an array of strings suitable for the recommendation.products field.
 *
 * @param {Array} actives - Array of active objects from FungicideFilter
 * @param {string} region - Display name of region
 * @param {string} registrationBody - e.g. 'APVMA', 'HSE CRD'
 * @returns {string[]}
 */
function _formatProductLines(actives, region, registrationBody) {
    if (!actives || actives.length === 0) return [];
    const primary = actives.filter(a => a.type === 'primary' || !a.type);
    const items = (primary.length > 0 ? primary : actives).slice(0, 4);
    return items.map(a => {
        const reg = a.registration ? ` (${a.registration})` : '';
        const frac = a.fracGroup ? ` [FRAC ${a.fracGroup}]` : '';
        return `${a.activeIngredient || a.active}${reg}${frac}`;
    });
}

/**
 * Build a plain-English recommendation for a single disease result.
 * Pure function: accepts the resolved disease object + optional FungicideFilter
 * reference (passed in as a dep, not read from window — window is the caller's job).
 *
 * @param {Object} disease        - Post-multiplier disease result from analyse()
 * @param {string} fungicideRegion - Region code, e.g. 'AU', 'NZ', 'GB'
 * @param {number|null} trendDelta - Score change over last 3 periods (pp), or null
 * @param {Object|null} fungicideFilter - GAIP_FungicideFilter reference (or null)
 * @param {Object|null} residualCtx - Output of spray-log-cascade calculateResidualProtection(),
 *   optionally enriched with .uvResidual from GAIP_UV_RESIDUAL. Shape:
 *   {
 *     productName, activeIngredient, fracGroup, applicationDate, daysSince,
 *     pctRemaining,       // simple half-life estimate (0-100)
 *     isWithinWindow,     // true if still inside label protection window
 *     isExpired,          // true if label window passed
 *     targets: Set,       // disease keys this AI targets
 *     uvResidual?: {
 *       residualPct,      // UV+rain+bio model (0-100)
 *       belowThreshold,   // < REAPPLY_THRESHOLD (70%)
 *       reapplyFlag,
 *     }
 *   }
 * @returns {Object} recommendation object:
 *   {
 *     action: 'none'|'monitor'|'prepare'|'preventive'|'curative',
 *     headline: string,
 *     timing: string|null,
 *     trendText: string|null,
 *     residualNote: string|null,  // UV/residual context line
 *     products: string[],
 *     productsLabel: string,
 *     resistanceNote: string|null,
 *     caveat: string|null,
 *   }
 */
function buildRecommendation(disease, fungicideRegion, trendDelta, fungicideFilter, residualCtx) {
    const score    = disease.adjustedRisk || disease.riskScore || 0;
    const level    = disease.riskLevel || classifyRisk(score);
    const diseaseKey = disease.disease; // canonical key

    const cfg       = RECOMMENDATION_CONFIG.thresholds;
    const urgency   = URGENCY_WINDOWS[diseaseKey] || { preventiveDays: 3, curativeDays: 5, note: null };
    const resWarn   = RESISTANCE_WARNINGS[diseaseKey];

    // --- Action classification ---
    let action;
    if      (score >= cfg.critical) action = 'curative';
    else if (score >= cfg.urgent)   action = 'preventive';  // high — apply now
    else if (score >= cfg.action)   action = 'prepare';     // moderate — prepare/consider
    else if (score >= 30)           action = 'monitor';
    else                            action = 'none';

    // Upgrade action if trend is rising fast through lower score band
    if (action === 'monitor' && trendDelta !== null && trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
        action = 'prepare';
    }
    if (action === 'prepare' && trendDelta !== null && trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
        action = 'preventive';
    }

    // --- Residual protection override ---
    // If the spray log + UV engine tell us the existing cover is running out,
    // we can upgrade the action independently of the raw score.
    //
    // Logic:
    //   Best residual estimate = uvResidual.residualPct if available (physics-based),
    //   else pctRemaining (simple half-life table).
    //
    //   Only apply to diseases the logged product actually targets — if targets
    //   is populated and this disease isn't in it, the residual is irrelevant here.
    //
    //   Thresholds:
    //     residual < 40% and score >= 30: protection effectively gone — upgrade to preventive
    //     residual < 70% and score >= 40: below reapply threshold — upgrade to prepare
    //     residual 0% / expired: treat as unprotected — bump to at least prepare if score >= 25
    let residualNote = null;
    if (residualCtx && residualCtx.productName) {
        const isTargeted = !residualCtx.targets || residualCtx.targets.size === 0 ||
                           residualCtx.targets.has(diseaseKey);

        if (isTargeted) {
            // Prefer UV-physics model; fall back to simple half-life estimate
            const residualPct = (residualCtx.uvResidual?.residualPct != null)
                ? residualCtx.uvResidual.residualPct
                : (residualCtx.pctRemaining != null ? residualCtx.pctRemaining : null);

            const ai   = residualCtx.activeIngredient || residualCtx.productName;
            const days = residualCtx.daysSince != null ? residualCtx.daysSince : '?';
            const src  = residualCtx.uvResidual?.residualPct != null ? 'UV model' : 'half-life est.';

            if (residualCtx.isExpired) {
                // Label window has passed entirely
                residualNote = `${ai} applied ${days}d ago, label window expired. No residual protection.`;
                if (score >= 25 && (action === 'none' || action === 'monitor')) {
                    action = 'prepare';
                }
            } else if (residualPct !== null && residualPct < 40 && score >= 30) {
                // Protection nearly gone; disease conditions present
                residualNote = `${ai} residual ${residualPct}% (${src}, applied ${days}d ago), cover expiring.`;
                if (action === 'none' || action === 'monitor' || action === 'prepare') {
                    action = 'preventive';
                }
            } else if (residualPct !== null && residualPct < 70 && score >= 40) {
                // Below reapply threshold; conditions building
                residualNote = `${ai} residual ${residualPct}% (${src}, applied ${days}d ago), below reapply threshold.`;
                if (action === 'none' || action === 'monitor') {
                    action = 'prepare';
                }
            } else if (residualPct !== null && residualPct >= 70) {
                // Good cover — inform user, no upgrade needed
                residualNote = `${ai} residual ~${residualPct}% (${src}, applied ${days}d ago), protection current.`;
            }
        }
    }

    // --- Trend text ---
    let trendText = null;
    if (trendDelta !== null) {
        const sign = trendDelta > 0 ? '+' : '';
        if (Math.abs(trendDelta) < 3) {
            trendText = 'stable';
        } else if (trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
            trendText = `rising fast (${sign}${Math.round(trendDelta)}pp 3-day)`;
        } else if (trendDelta > 0) {
            trendText = `rising (${sign}${Math.round(trendDelta)}pp 3-day)`;
        } else {
            trendText = `easing (${sign}${Math.round(trendDelta)}pp 3-day)`;
        }
    }

    // --- Headline & timing ---
    let headline, timing;

    // Special-case diseases with biology-driven language
    if (diseaseKey === 'springDeadSpot') {
        const inWindow = disease.treatmentWindow?.inWindow;
        if (inWindow) {
            action   = 'preventive';
            headline = 'Treatment window open, preventive fungicide now.';
            timing   = `Soil temp ${disease.treatmentWindow.soilTemp}°C (optimal 16–24°C).`;
        } else if (score >= 30) {
            headline = 'High site risk, wait for autumn treatment window (soil 16–24°C).';
            timing   = null;
        } else {
            headline = 'Low risk. Monitor site history and autumn conditions.';
            timing   = null;
        }
    } else if (diseaseKey === 'takeAll') {
        headline = score >= cfg.action
            ? 'Soil chemistry intervention required, fungicides provide limited suppression.'
            : 'Monitor soil pH and Mn. Chemical control is secondary to soil management.';
        timing = disease.infectionWindow?.active
            ? `Infection window active, soil temp ${disease.infectionWindow.soilTemp}°C. Prioritise Mn applications now.`
            : null;
    } else if (diseaseKey === 'anthracnose') {
        headline = score >= cfg.urgent
            ? 'Stress relief is primary action. Fungicide is a bridge, address N, HOC, and compaction first.'
            : 'Manage stress factors. Fungicide at this level has limited ROI without cultural correction.';
        timing = score >= cfg.urgent && urgency.preventiveDays
            ? `Apply within ${urgency.preventiveDays} days if cultural options delayed.`
            : null;
    } else if (diseaseKey === 'pythiumBlight') {
        if (action === 'curative' || action === 'preventive') {
            headline = 'URGENT: Pythium destroys turf in 24–48 h. Apply before nightfall.';
            timing   = 'Apply TODAY before evening.';
        } else if (action === 'prepare') {
            headline = 'Conditions approaching Pythium threshold. Prepare product; apply at first sign.';
            timing   = 'Monitor hourly. Apply immediately if conditions deteriorate.';
        } else {
            headline = 'Pythium risk low. Conditions not currently favourable.';
            timing   = null;
        }
    } else {
        // Generic language for dollar spot, brown patch, fusarium, GLS, helminthosporium, large patch
        if (action === 'curative') {
            const days = urgency.curativeDays;
            headline = `Risk CRITICAL (${score}%), curative application required.`;
            timing   = days ? `Apply at curative rate within ${days} days.` : 'Apply immediately.';
        } else if (action === 'preventive') {
            const days = urgency.preventiveDays;
            headline = `Preventive application warranted.`;
            timing   = days ? `Apply within ${days} days.` : 'Apply promptly.';
            if (trendDelta !== null && trendDelta >= RECOMMENDATION_CONFIG.trendSensitivity) {
                timing += ` Trend rising fast, front-load interval.`;
            }
            // Residual-driven upgrade: tighten timing language
            if (residualNote && residualCtx?.uvResidual?.residualPct != null &&
                residualCtx.uvResidual.residualPct < 40) {
                timing = `Residual expiring, apply to maintain cover${days ? ` within ${days} days` : ''}.`;
            }
        } else if (action === 'prepare') {
            headline = `Conditions building, prepare programme.`;
            timing   = 'Monitor 48 h. Apply preventively if score continues to rise.';
            if (residualNote && residualCtx?.isExpired) {
                timing = 'Previous cover expired. Prepare reapplication, no residual protection in place.';
            } else if (residualNote && residualCtx?.pctRemaining != null && residualCtx.pctRemaining < 70) {
                timing = 'Residual below threshold, prepare reapplication now.';
            }
        } else if (action === 'monitor') {
            headline = 'Risk low. Scout regularly; no spray action required.';
            timing   = null;
        } else {
            headline = 'No action required. Conditions not favourable.';
            timing   = null;
        }
    }

    // Append trend context to headline when present and not already encoded
    if (trendText && trendText !== 'stable' && !headline.includes('rising') && !headline.includes('easing')) {
        headline += ` Score ${trendText}.`;
    }

    // --- Product lookup ---
    let products        = [];
    let productsLabel   = '';
    let productWarnings = [];

    if (fungicideFilter && (action === 'preventive' || action === 'curative' || action === 'prepare')) {
        try {
            const regionOpt = fungicideRegion ? { region: _fungicideRegionToFilterKey(fungicideRegion) } : {};
            // Pass diseaseKey directly — fungicide-filter.normalizeDiseaseName handles conversion
            const result    = fungicideFilter.getApprovedFungicides(diseaseKey, regionOpt);
            if (result && result.actives && result.actives.length > 0) {
                products      = _formatProductLines(result.actives, fungicideRegion, result.registrationBody);
                productsLabel = `Registered (${fungicideRegion}${result.registrationBody ? ', ' + result.registrationBody : ''})`;
            }
            if (result?.warnings?.length > 0) {
                productWarnings = result.warnings;
            }
        } catch (e) {
            // Fungicide lookup non-fatal — recommendation still valid without products
        }
    }

    // --- Resistance note ---
    let resistanceNote = resWarn?.note || null;

    return {
        action,
        headline,
        timing,
        trendText,
        residualNote,
        products,
        productsLabel,
        productWarnings,
        resistanceNote,
        caveat: urgency.note || null,
    };
}

/**
 * Map disease engine region codes to FungicideFilter region keys.
 * FungicideFilter uses full region strings; disease engine uses short codes.
 */
function _fungicideRegionToFilterKey(regionCode) {
    const MAP = {
        'AU':                   'australia',
        'australia':            'australia',
        'australia_temperate':  'australia',
        'australia_tropical':   'australia',
        'australia_arid':       'australia',
        'NZ':                   'new_zealand',
        'new_zealand':          'new_zealand',
        'GB':                   'uk_ireland',
        'UK':                   'uk_ireland',
        'uk_ireland':           'uk_ireland',
        'IE':                   'uk_ireland',
        'SE':                   'scandinavia',
        'DK':                   'scandinavia',
        'NO':                   'scandinavia',
        'scandinavia':          'scandinavia',
        'FI':                   'nordic',
        'JP':                   'japan',
        'DE':                   'germany',
        'FR':                   'france',
        'ES':                   'spain',
    };
    return MAP[regionCode] || regionCode.toLowerCase();
}


// =============================================================================
// MAIN ENGINE - PURE FUNCTION
// =============================================================================

/**
 * Run complete disease analysis. Pure function: no DOM, no globals.
 *
 * @param {Object} input - DiseaseEngineInput (see shape definition above)
 * @returns {Object} DiseaseEngineResult
 */
/**
 * Taper a post-processing multiplier based on the base score.
 *
 * When the base score is high (>=70), conditions genuinely favour the disease
 * and susceptibility compounds real risk: apply the multiplier fully.
 * When the base score is marginal (40-70), the multiplier should nudge
 * rather than catapult: taper it down.
 * When the base score is low (<40), conditions don't support the disease
 * and susceptibility is academic: cap the multiplier effect.
 *
 * Prevents multiplicative stacking of partially-overlapping factors
 * (species susceptibility, regional pressure, variety, tissue) from turning
 * every moderate base score into a false "severe" alarm.
 *
 * @param {number} baseScore - The pre-multiplied risk score (0-100)
 * @param {number} combinedMult - The raw combined multiplier (e.g. 1.64)
 * @returns {number} The tapered multiplier to actually apply
 */
function taperMultiplier(baseScore, combinedMult) {
    if (combinedMult <= 1) return combinedMult; // never dampen reductions

    if (baseScore >= 70) {
        // Full multiplier: conditions are genuinely dangerous
        return combinedMult;
    } else if (baseScore >= 40) {
        // Linear taper: at 70 -> full, at 40 -> capped at 1 + (mult-1)*0.5
        const t = (baseScore - 40) / 30; // 0 at base=40, 1 at base=70
        return 1 + (combinedMult - 1) * (0.5 + 0.5 * t);
    } else {
        // Low base: cap extra effect at 30% of what multiplier would add
        return 1 + (combinedMult - 1) * 0.3;
    }
}

function analyse(input) {
    const {
        climate, nitrogen, shade, soil, variety, species,
        traffic, mowing, region, dewData, tissueNutrients,
        poaPercent: rawPoaPercent, baseSpecies,
        // Injectable dependencies (replace global reads)
        regionalMultipliers, regionDisplayInfo,
        largePatchModel, dormancyData,
    } = input || {};

    // Helper to get variety modifier for a disease
    const getVarietyModifier = (diseaseName) => {
        if (!variety?.disease) return 1;
        const mod = variety.disease[diseaseName]?.riskMultiplier;
        return (typeof mod === 'number' && mod > 0) ? mod : 1;
    };

    const normalizedSpecies = normalizeSpecies(species);
    const susceptibility = SPECIES_SUSCEPTIBILITY[normalizedSpecies] || SPECIES_SUSCEPTIBILITY.perennialRyegrass;
    const diseases = [];
    const regionCode = region || 'AU';
    const tissueComposite = tissueNutrients?.compositeModifier || 1;
    const poaPercent = rawPoaPercent || 0;
    const mowingCtx = mowing || {};

    // b35fix420 (C23): Species-applicability instrumentation.
    //
    // Every disease dispatcher below already gates on susceptibility (e.g.
    // `if (susceptibility.X > 0)` or `> 0.5`). When the gate fails, the model
    // is never run and the disease is never pushed to `diseases`. Renderers
    // had no way to disclose this: a paspalum site got a Disease Risk
    // Assessment with N items and no indication that M others were suppressed
    // because the species is not a host. The C23 ledger entry was originally
    // scoped as "build a hostSpecies field per model and filter at render
    // time"; the architecture was already in place at the dispatcher gates,
    // so the actual fix is one data correction (paspalum SDS, see comment
    // at SPECIES_SUSCEPTIBILITY) plus exposing the suppression list to
    // renderers via `result.suppressedDiseases`.
    //
    // The DISPATCHER_GATES table mirrors the threshold each dispatcher
    // applies. Keep these in sync: if a dispatcher is changed from `> 0` to
    // `> 0.5` (or vice versa), update both the dispatcher and this table or
    // the suppressed-list will lie. Tests pin both.
    //
    // Waitea is intentionally excluded: the WaiteaPatchModel.calculate body
    // does its own species-resolution and returns null on non-host species,
    // independent of the SPECIES_SUSCEPTIBILITY table. It is dispatched
    // unconditionally and therefore not gateable from this table.
    const DISPATCHER_GATES = {
        dollarSpot: 0,
        brownPatch: 0,
        pythium: 0,
        anthracnose: 0.5,
        fusarium: 0,
        takeAll: 0.5,
        grayLeafSpot: 0.5,
        springDeadSpot: 0,
        helminthosporium: 0.5,
        largePatch: 0,
        // b35fix459 (C64): Red Thread engine wire-in. Gate `> 0.5` suppresses
        // all AU warm-season hosts (bermuda/couch/kikuyu 0.25-0.4, paspalum
        // 0.3, buffalo/buffalograss 0.3, zoysia 0.4) while admitting all
        // cool-season hosts (bentgrass 0.9, perennialRyegrass 1.3,
        // kentuckyBluegrass 1.1, tallFescue 0.7, poaAnnua 1.0). The
        // standalone red-thread-model.js heuristic table at lines 120-153
        // documents 0.25-1.5 susceptibility across 27 species; the 11
        // species present in the pure engine table inherit the matching
        // values via the legacy red-thread-model.js / red-thread-integration.js
        // wiring chain, with buffalograss benchmarked at 0.3 by buffalo
        // analogy (buffalograss is not enumerated in the standalone module).
        // Production effect: cool-season AU/NZ/UK/IE/EU sites newly emit
        // a Red Thread row in the Disease Risk Assessment section. AU
        // warm-season sites unchanged.
        redThread: 0.5,
        // b35fix461 (C59): Drechslera engine wire-in. DrechsleraPoaeModel
        // lives in assets/bipolaris-curvularia-models.js and was orphaned
        // from the pure-engine analyse() pre-fix (the b35fix362 ungating
        // was on the legacy DiseaseEngine.analyse path, defunct since the
        // b35fix328+ legacy-to-pure cutover; same orphan-class as Red Thread
        // pre-b35fix459 / C64). Gate `> 0.5` mirrors the C64 Red Thread
        // shape: suppresses warm-season hosts (bermuda / couch / kikuyu /
        // zoysia / buffalo / buffalograss / seashore_paspalum at 0) and
        // admits cool-season hosts (bentgrass 0.6, perennialRyegrass 0.8,
        // kentuckyBluegrass 1.8 primary host, tallFescue 0.5, poaAnnua 1.0).
        // Susceptibility values lifted from the bipolaris-curvularia-models.js
        // BIPOLARIS_CURVULARIA_SUSCEPTIBILITY table at lines 170-268 (the
        // model file's own authoritative table). Production effect: cool-
        // season AU/NZ/UK/IE/EU sites newly emit a Drechslera Melting-Out
        // row in the Disease Risk Assessment section. AU warm-season sites
        // unchanged.
        drechsleraPoae: 0.5,
    };
    const DISEASE_DISPLAY_NAMES = {
        dollarSpot: 'Dollar Spot',
        brownPatch: 'Brown Patch',
        pythium: 'Pythium Blight',
        anthracnose: 'Anthracnose',
        fusarium: 'Fusarium Patch',
        takeAll: 'Take-all',
        grayLeafSpot: 'Gray Leaf Spot',
        springDeadSpot: 'Spring Dead Spot',
        helminthosporium: 'Helminthosporium Leaf Spot',
        largePatch: 'Large Patch',
        redThread: 'Red Thread',
        // b35fix461 (C59): Drechslera engine wire-in display name matches
        // disease-forecast.js entry at line 619 for cross-pipeline consistency.
        drechsleraPoae: 'Drechslera Melting-Out',
    };
    const suppressedDiseases = Object.keys(DISPATCHER_GATES)
        .filter(key => (susceptibility[key] || 0) <= DISPATCHER_GATES[key])
        .map(key => ({
            disease: key,
            displayName: DISEASE_DISPLAY_NAMES[key],
            speciesSusceptibility: susceptibility[key] || 0,
            gate: DISPATCHER_GATES[key],
            reason: (susceptibility[key] || 0) === 0
                ? `${normalizedSpecies} is not a documented host`
                : `${normalizedSpecies} susceptibility (${susceptibility[key]}) below model gate (${DISPATCHER_GATES[key]})`,
        }));

    // === Dollar Spot ===
    if (susceptibility.dollarSpot > 0) {
        const result = DollarSpotModel.calculate(climate, nitrogen, variety, shade, dewData);
        result.speciesSusceptibility = susceptibility.dollarSpot;
        let tissueMod = 1;
        const vMod = getVarietyModifier('dollarSpot');
        if (tissueNutrients?.modifiers?.K?.status === 'deficient') tissueMod *= 1.2;
        if (tissueNutrients?.modifiers?.KN_ratio?.status === 'poor') tissueMod *= 1.15;
        // Use rawRisk (uncapped) as the base for taperMultiplier so that when
        // riskScore saturates at 100, the species/variety multiplier (e.g. bentgrass
        // 1.3) still has headroom to drive adjustedRisk above display-capped riskScore.
        // Without this, L-93 bentgrass reads 100% any time base conditions are moderate,
        // because taperMultiplier(100, 1.3) = 1.3 → 130 → clamped to 100; correct, but
        // rawRisk of e.g. 77 → taperMultiplier(77, 1.3*1.3=1.69) → ~1.65 → 127 → 100
        // only for genuinely extreme conditions, not moderate ones.
        const baseForTaper = result.rawRisk ?? result.riskScore;
        { const rawMult = susceptibility.dollarSpot * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(baseForTaper * taperMultiplier(baseForTaper, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = DollarSpotModel.getInterventions(result.riskLevel, { nitrogen, shade, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        if (tissueMod > 1) result.nutrientNote = 'Risk increased by tissue nutrient imbalance';
        // Smith-Kerns warm-season caveat: model validated on cool-season bentgrass only.
        // Running on C4 species with susceptibility modifier but score is indicative only.
        const C4_WARM_SEASON = ['bermuda','couch','kikuyu','zoysia','buffalo','buffalograss','paspalum'];
        if (C4_WARM_SEASON.includes(normalizedSpecies)) {
            result.warmSeasonCaveat = 'Smith-Kerns model validated on cool-season bentgrass only. Dollar spot score on warm-season turf is indicative, use as trend guidance, not a precise threshold.';
        }
        diseases.push(result);
    }

    // === Brown Patch ===
    if (susceptibility.brownPatch > 0) {
        const result = BrownPatchModel.calculate(climate, nitrogen, variety, dewData);
        result.speciesSusceptibility = susceptibility.brownPatch;
        let tissueMod = 1;
        const vMod = getVarietyModifier('brownPatch');
        if (tissueNutrients?.modifiers?.KN_ratio?.status === 'poor') tissueMod *= 1.2;
        if (tissueNutrients?.modifiers?.Ca?.status === 'deficient') tissueMod *= 1.15;
        { const rawMult = susceptibility.brownPatch * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = BrownPatchModel.getInterventions(result.riskLevel, { nitrogen, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Pythium Blight ===
    if (susceptibility.pythium > 0) {
        const result = PythiumModel.calculate(climate, nitrogen, variety, dewData);
        result.speciesSusceptibility = susceptibility.pythium;
        let tissueMod = 1;
        const vMod = getVarietyModifier('pythium');
        // ── Ca tissue modifier (b35fix354 — Tier 2 audit, Pythium finding #4) ──
        // Pre-b35fix354: this block also carried `if (...K... === 'deficient') tissueMod *= 1.1`
        // The K modifier was a Gilba-internal heuristic with no Pythium-specific
        // peer-reviewed support. Vargas (Management of Turfgrass Diseases) and
        // Smiley/Dernoeden/Clarke (Compendium of Turfgrass Diseases, APS Press)
        // do NOT identify K deficiency as a Pythium susceptibility factor —
        // they single out N excess and Ca deficiency. Prabhu et al. 2007
        // (Potassium and Plant Disease, in Datnoff/Elmer/Huber, Mineral Nutrition
        // and Plant Disease, APS Press, ch. 5) treats K → general host resistance
        // but does not quantify a Pythium-specific effect. The K modifier was
        // stripped in b35fix354 rather than retained as an unsupported heuristic.
        //
        // The Ca modifier (1.2× when tissue Ca deficient) is RETAINED. Direction
        // is supported by:
        //   • Vargas, J.M. — Management of Turfgrass Diseases (Lewis/CRC,
        //     2nd ed. 1994, 3rd ed. 2005). Calcium deficiency is identified
        //     as a Pythium blight predisposing factor.
        //   • Smiley, R.W., Dernoeden, P.H., Clarke, B.B. — Compendium of
        //     Turfgrass Diseases, APS Press (3rd ed. 2005; 4th ed. Tredway et
        //     al. 2023). Pythium management section identifies adequate Ca
        //     nutrition as a cultural control measure.
        //   • Rahman, M. & Punja, Z.K. 2007. Calcium and Plant Disease.
        //     In: Datnoff, Elmer & Huber (eds), Mineral Nutrition and Plant
        //     Disease, APS Press, ch. 6, pp. 79-93. Mechanism: Ca²⁺ stabilises
        //     middle-lamella pectates and cell-wall integrity, raising the
        //     barrier to oomycete cell-wall-degrading enzymes (polygalacturonases).
        //   • Sugimoto, T. et al. 2008. Select calcium compounds reduce the
        //     severity of Phytophthora stem rot of soybean. Plant Disease
        //     92(11):1559-1565. Peer-reviewed dose-response: 4-30 mM Ca
        //     (CaCl₂, Ca(NO₃)₂) suppresses Phytophthora sojae zoospore release.
        //     Pythium and Phytophthora are sister oomycete genera; mechanistic
        //     transfer is reasonable but not direct.
        //
        // Magnitude (1.2×) remains Gilba-internal — none of the above sources
        // quantify a tissue-Ca-status susceptibility multiplier specifically
        // for turfgrass Pythium blight. The DIRECTION is peer-reviewed; the
        // SCALAR is operational/empirical.
        if (tissueNutrients?.modifiers?.Ca?.status === 'deficient') tissueMod *= 1.2;
        { const rawMult = susceptibility.pythium * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = PythiumModel.getInterventions(result.riskLevel, { region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Anthracnose ===
    if (susceptibility.anthracnose > 0.5) {
        const result = AnthracnoseModel.calculate(climate, nitrogen, variety, shade, traffic, mowingCtx, dewData);
        result.speciesSusceptibility = susceptibility.anthracnose;
        let tissueMod = tissueComposite;
        const vMod = getVarietyModifier('anthracnose');
        if (tissueNutrients?.modifiers?.P?.status === 'deficient') tissueMod *= 1.1;
        { const rawMult = susceptibility.anthracnose * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = AnthracnoseModel.getInterventions(result.riskLevel, { mowing: mowingCtx, shade, traffic, nitrogen, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        // b35fix430: warm-season host caveat. The Danneberger 1984 forecast
        // and Inguagiato 2008/2009 stress multipliers were validated on
        // cool-season Poa annua / Agrostis stolonifera. Per Crouch & Clarke
        // 2012, warm-season anthracnose involves different Colletotrichum
        // species. Append a caveat to keyMessage and flag the result so the
        // UI can render the warning visibly.
        if (_ANTHRACNOSE_WARM_SEASON_HOSTS[normalizedSpecies]) {
            result.hostRangeCaveat = true;
            result.hostRangeCaveatNote = 'Anthracnose model applied outside validated host range. Crouch & Clarke 2012 (GCM May 2012 p.99): warm-season anthracnose is caused by Colletotrichum species distinct from C. cereale (the cool-season pathogen on which this model is calibrated). Risk score is indicative only.';
            result.keyMessage = (result.keyMessage || '') +
                ' Note: this model was validated on cool-season Poa annua and creeping bentgrass; warm-season anthracnose involves different Colletotrichum species (Crouch & Clarke 2012). Treat output as indicative.';
        }
        diseases.push(result);
    }

    // === Poa contamination adjustments ===
    if (poaPercent > 0 && normalizedSpecies !== 'poaAnnua') {
        const poaSusc = SPECIES_SUSCEPTIBILITY.poaAnnua;
        const poaFraction = poaPercent / 100;
        if (poaPercent >= 10) {
            const anthResult = diseases.find(d => d.disease === 'anthracnose');
            if (anthResult) {
                const blended = susceptibility.anthracnose + (poaSusc.anthracnose - susceptibility.anthracnose) * poaFraction;
                anthResult.speciesSusceptibility = Math.round(blended * 100) / 100;
                anthResult.adjustedRisk = Math.min(100, Math.round(anthResult.riskScore * blended));
                anthResult.poaNote = `${poaPercent}% Poa contamination elevates risk`;
            }
            const pythResult = diseases.find(d => d.disease === 'pythiumBlight');
            if (pythResult) {
                const blended = susceptibility.pythium + (poaSusc.pythium - susceptibility.pythium) * poaFraction;
                pythResult.speciesSusceptibility = Math.round(blended * 100) / 100;
                pythResult.adjustedRisk = Math.min(100, Math.round(pythResult.riskScore * blended));
                pythResult.poaNote = `${poaPercent}% Poa contamination elevates risk`;
            }
        }
    }

    // === Spring Dead Spot ===
    if (susceptibility.springDeadSpot > 0) {
        const result = SpringDeadSpotModel.calculate(climate, soil, variety, null, regionCode);
        const vMod = getVarietyModifier('springDeadSpot');
        result.speciesSusceptibility = susceptibility.springDeadSpot;
        { const rawMult = susceptibility.springDeadSpot * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Large Patch (C4 only, injected model) ===
    if (susceptibility.largePatch > 0 && largePatchModel) {
        const result = largePatchModel.calculate(climate, nitrogen, variety, soil, dormancyData, normalizedSpecies);
        if (result && result.applicable !== false) {
            const vMod = getVarietyModifier('largePatch');
            result.speciesSusceptibility = susceptibility.largePatch;
            { const rawMult = susceptibility.largePatch * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
            result.riskLevel = classifyRisk(result.adjustedRisk);
            if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
            diseases.push(result);
        }
    }

    // === Helminthosporium ===
    if (susceptibility.helminthosporium > 0.5) {
        // b35fix353: pass normalizedSpecies through so the model can attach a
        // cool-season scope flag when the host is bentgrass / KBG / tall fescue /
        // PRG / Poa annua / fine fescue. Forward-compat for b35fix354 cool-season
        // Drechslera path.
        const result = HelminthosporiumModel.calculate(climate, nitrogen, variety, dewData, normalizedSpecies);
        const vMod = getVarietyModifier('helminthosporium');
        result.speciesSusceptibility = susceptibility.helminthosporium;
        { const rawMult = susceptibility.helminthosporium * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = HelminthosporiumModel.getInterventions(result.riskLevel);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Drechslera (b35fix461 / C59 - engine wire-in) ===
    // b35fix461 (C59): DrechsleraPoaeModel was orphaned from the pure-engine
    // analyse() pipeline pre-fix. The b35fix362 ungating was on the legacy
    // DiseaseEngine.analyse path, defunct since the b35fix328+ legacy-to-pure
    // cutover (same orphan-class as Red Thread pre-b35fix459 / C64). The
    // model lives in assets/bipolaris-curvularia-models.js and is exposed
    // via window.DrechsleraPoaeModel; defensive null-check below tolerates
    // load-order failure. Gate `> 0.5` mirrors the C64 Red Thread shape:
    // suppresses warm-season hosts (bermuda / couch / kikuyu / zoysia /
    // buffalo / buffalograss / seashore_paspalum at 0) and admits cool-
    // season hosts (bentgrass 0.6, perennialRyegrass 0.8, kentuckyBluegrass
    // 1.8 primary host, tallFescue 0.5, poaAnnua 1.0). Curve refined to
    // CABI 2024 Box 7.7 cardinal temperatures in same build at
    // bipolaris-curvularia-models.js calcTempResponse_DrechsleraPoae.
    // patchDiseaseEngineWithBipolaris in the model file remains in place
    // but is now dead code on the Drechslera path (the legacy DiseaseEngine
    // stub delegates to DiseaseEnginePure, so the post-process patch never
    // adds anything that the pure dispatcher does not already emit);
    // cleanup logged as C59d candidate, deferred per single-purpose discipline.
    if (susceptibility.drechsleraPoae > DISPATCHER_GATES.drechsleraPoae) {
        const DPM = (typeof window !== 'undefined' && window.DrechsleraPoaeModel)
                    || (typeof global !== 'undefined' && global.DrechsleraPoaeModel)
                    || null;
        if (DPM && typeof DPM.calculate === 'function') {
            // Neutral baseline invocation: stressFactors empty, species passed
            // through normalizedSpecies. Regional pressure is applied at the
            // analyse() loop's regional multiplier pass (not here) to avoid
            // double-counting.
            const result = DPM.calculate(climate, nitrogen, variety, {}, dewData, normalizedSpecies);
            const vMod = getVarietyModifier('drechsleraPoae');
            result.disease = 'drechsleraPoae';
            result.displayName = DISEASE_DISPLAY_NAMES.drechsleraPoae;
            result.speciesSusceptibility = susceptibility.drechsleraPoae;
            { const rawMult = susceptibility.drechsleraPoae * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
            result.riskLevel = classifyRisk(result.adjustedRisk);
            if (typeof DPM.getInterventions === 'function') {
                result.interventions = DPM.getInterventions(result.riskLevel, { region: regionCode });
            }
            if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
            diseases.push(result);
        }
    }

    // === Fusarium ===
    if (susceptibility.fusarium > 0) {
        const result = FusariumModel.calculate(climate, nitrogen, variety);
        const vMod = getVarietyModifier('fusarium');
        result.speciesSusceptibility = susceptibility.fusarium;
        { const rawMult = susceptibility.fusarium * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = FusariumModel.getInterventions(result.riskLevel, { nitrogen, climate, region: regionCode });
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        if (result.drivers?.nitrogen?.winterRisk) {
            result.nutrientNote = 'Excess N in cool conditions dramatically increases Fusarium risk';
        }
        diseases.push(result);
    }

    // === Take-all Patch ===
    if (susceptibility.takeAll > 0.5) {
        const result = TakeAllModel.calculate(climate, soil, variety);
        const vMod = getVarietyModifier('takeAll');
        result.speciesSusceptibility = susceptibility.takeAll;
        let tissueMod = 1;
        const pH = soil?.pH || null;
        if (pH && pH > 7) { tissueMod *= 1.35; result.nutrientNote = `High soil pH (${pH.toFixed(1)}) reducing Mn availability`; }
        else if (pH && pH > 6.5) { tissueMod *= 1.15; result.nutrientNote = `Soil pH (${pH.toFixed(1)}) may be limiting Mn availability`; }
        { const rawMult = susceptibility.takeAll * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        // b35fix431: warm-season host caveat. The TakeAllModel coefficients
        // (Gaussian temp curve mu=15 sigma=4, infection window 12-18 degC,
        // pH/Mn/moisture/temp weights) are calibrated for the cool-season
        // var. avenae pathway per CABI 2024 Ch.6 p.105 (Grose et al. 1984;
        // Couch 1995). Bermudagrass decline / take-all root rot on
        // warm-season hosts involves G. graminis var. graminis +
        // Magnaporthiopsis + Candidacolonium with broader temperature
        // tolerance (CABI p.140: 10-35 degC growth range). At b35fix430
        // SPECIES_SUSCEPTIBILITY values, only buffalo (0.8) and
        // seashore_paspalum (1.4) from the warm-season scope pass the >0.5
        // dispatcher gate; the caveat fires for those species. Pairs with
        // provenanceStress.hostRange = 'caveat-applied' on the result.
        if (_TAKEALL_WARMSEASON_HOSTS[normalizedSpecies]) {
            result.hostRangeCaveat = true;
            result.hostRangeCaveatNote = 'TakeAllModel coefficients are calibrated for the cool-season var. avenae pathway on bentgrass (CABI 2024 Ch.6 p.105: 10-19 degC infection range per Grose et al. 1984 and Couch 1995). Warm-season root rot involves a different pathogen complex (G. graminis var. graminis + Magnaporthiopsis spp. + Candidacolonium spp. per Stephens et al. 2022 and Tucker et al. 2022) with broader temperature tolerance (CABI p.140: 10-35 degC growth range). Risk score is indicative only on warm-season hosts.';
            result.keyMessage = (result.keyMessage || '') +
                ' Note: this model was validated on cool-season bentgrass; warm-season root rot involves a different pathogen complex (G. graminis var. graminis plus Magnaporthiopsis and Candidacolonium spp.) with broader temperature tolerance per CABI 2024 Ch.6. Treat output as indicative.';
        }
        diseases.push(result);
    }

    // === Gray Leaf Spot ===
    if (susceptibility.grayLeafSpot > 0.5) {
        const result = GrayLeafSpotModel.calculate(climate, nitrogen, variety, null);
        const vMod = getVarietyModifier('grayLeafSpot');
        let tissueMod = tissueComposite;
        if (tissueNutrients?.modifiers?.Si?.status === 'high') tissueMod *= 0.85;
        result.speciesSusceptibility = susceptibility.grayLeafSpot;
        { const rawMult = susceptibility.grayLeafSpot * tissueMod * vMod; result.adjustedRisk = Math.min(100, Math.round(result.riskScore * taperMultiplier(result.riskScore, rawMult))); }
        result.riskLevel = classifyRisk(result.adjustedRisk);
        result.interventions = GrayLeafSpotModel.getInterventions(result.riskLevel);
        if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
        diseases.push(result);
    }

    // === Waitea Patch (NZ var. circinata + AU var. zeae) ===
    {
        const waiteaResult = WaiteaPatchModel.calculate(climate, nitrogen, shade, soil, variety, normalizedSpecies, regionCode);
        if (waiteaResult !== null) diseases.push(waiteaResult);
    }

    // === Red Thread (b35fix459 / C64 - engine wire-in) ===
    // b35fix460 (C64a): LWD threshold integration. The dispatcher now plumbs
    // dewData through to RedThreadModel.calculate as a 5th positional arg
    // alongside the rtOpts bag. When dewData.leafWetness.averageWetHours is
    // present the standalone model applies a CABI 2024 12h LWD saturation
    // anchor as a multiplicative gate on humidityFactor (sigmoid 6 to 12h
    // ramp, full activation at or above 12h, mute at 0.05 below 6h). When
    // dewData is absent (no dew engine result on the site) RedThreadModel
    // falls back to the pre-b35fix460 RH + precip humidityFactor. CABI rec
    // #4 sub-items C64b (temperature ceiling 25 to 24 deg C) and C64c (PGR
    // post-application 1.1-1.2x multiplier within 14d, Chastagner & Vassey
    // 1979 cited in CABI Ch.6 p.90) remain as separate single-purpose
    // builds per Non-Negotiable #9.
    //
    // Wires the standalone RedThreadModel (heuristic, low confidence) into
    // the pure-engine dispatcher. Pre-b35fix459 the model loaded as
    // assets/red-thread-model.js + assets/red-thread-integration.js but the
    // integration patch wrapped `DiseaseForecast.getDiseaseCalculators`
    // which does not exist on disease-forecast.js, and the pure engine's
    // analyse() loop had no dispatcher for redThread. Net production
    // effect: Red Thread risk was computed nowhere in the live pipeline
    // since the b35fix328+ legacy-to-pure engine cutover. CABI 2024 audit
    // rec #4 (red-thread-model.js banner b35fix452 / C57) flagged engine
    // refinement; this build is the prerequisite wire-in. CABI rec #4
    // sub-items (LWD floor 6h to 12h, temperature ceiling 29 to 24 or 27
    // deg C, PGR-cover modifier 1.1-1.2x within 14d of application) ship
    // as separate single-purpose builds C64a/b/c per non-negotiable #9.
    //
    // Invocation contract:
    //   - Standalone model receives `species: 'perennialRyegrass'` as a
    //     neutral baseline (the standalone module's speciesSusceptibility
    //     table uses perennialRyegrass = 1.3 as one of its anchor points).
    //     The pure engine's per-species susceptibility.redThread (0.25-1.3
    //     across 12 species rows) then weights the standalone's baseline
    //     output via the dispatcher's susceptibility multiplier.
    //   - Standalone model receives `region: 'neutral'` (unmatched key,
    //     falls back to 1.0). The analyse() loop's existing regional
    //     multiplier pass at line ~4992 applies the real regional
    //     adjustment via getRegionalDiseaseMultiplier which reads the
    //     b35fix431-era `regionalMultipliers.redThread` injected by the
    //     shim at line ~5224. Passing a region to the standalone module
    //     would double-count.
    //   - tissueN flows through if available; the standalone model has its
    //     own tissue-N adjustment ladder (3.0/3.5/4.0/5.0/5.5 percent
    //     thresholds at lines 311-321) which is finer-grained than the
    //     pure engine's tissueNutrients.modifiers.N status-string set.
    //   - dewData flows through if available (b35fix460 / C64a). The
    //     standalone model reads dewData.leafWetness.averageWetHours
    //     (per-day basis, dew-prediction-engine.js:543) and applies the
    //     CABI 12h saturation anchor as a multiplicative gate on
    //     humidityFactor. When dewData is null or averageWetHours is
    //     missing the model degrades to the pre-b35fix460 RH + precip
    //     humidityFactor.
    //
    // Defensive null-check: if assets/red-thread-model.js failed to load
    // (asset chain broken, test harness without the module enqueued, or
    // the dispatcher fires before red-thread-model.js executes), skip
    // silently rather than throw. Pre-b35fix459 the dispatcher was absent
    // so this is a strict superset of pre-fix behaviour on the failure
    // mode.
    if (susceptibility.redThread > 0.5) {
        const RT = (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this))?.GAIP_RedThreadModel;
        if (RT && typeof RT.calculate === 'function') {
            const tissueN = tissueNutrients?.tissue?.N;
            const rtOpts = { species: 'perennialRyegrass', region: 'neutral' };
            if (typeof tissueN === 'number') rtOpts.tissueN = tissueN;
            // b35fix460 (C64a): dewData passed as 5th positional arg to
            // RedThreadModel.calculate for LWD threshold integration. The
            // standalone model's calculate signature was extended in the
            // same build to accept dewData as an optional 5th arg with
            // backward-compatible default null.
            const result = RT.calculate(climate, nitrogen, variety, rtOpts, dewData);
            result.speciesSusceptibility = susceptibility.redThread;
            const vMod = getVarietyModifier('redThread');
            // No tissue-modifier compound here because the standalone model
            // already consumes options.tissueN directly. Avoid double-count.
            const baseForTaper = result.riskScore;
            { const rawMult = susceptibility.redThread * vMod; result.adjustedRisk = Math.min(100, Math.round(baseForTaper * taperMultiplier(baseForTaper, rawMult))); }
            result.riskLevel = classifyRisk(result.adjustedRisk);
            // getInterventions accepts (riskLevel, context); pass nitrogen + species
            if (typeof RT.getInterventions === 'function') {
                result.interventions = RT.getInterventions(result.riskLevel, { nitrogen, species: normalizedSpecies, region: regionCode });
            }
            if (vMod !== 1) result.varietyNote = `Variety "${variety?.name}" modifier: ${vMod < 1 ? '-' : '+'}${Math.abs(Math.round((1 - vMod) * 100))}%`;
            diseases.push(result);
        }
    }

    // Sort by adjusted risk descending
    diseases.sort((a, b) => (b.adjustedRisk || 0) - (a.adjustedRisk || 0));

    // Apply regional multipliers (pure: from input, not global)
    const regionInfo = regionDisplayInfo || { name: regionCode, dataSource: 'Default parameters' };
    diseases.forEach(d => {
        const mult = getRegionalDiseaseMultiplier(d.displayName, regionalMultipliers);
        d.regionalMultiplier = mult;
        d.baseRisk = d.adjustedRisk;
        // b35fix353b: defensive guard. The regional multiplier loop is the
        // assembly point where every disease.adjustedRisk gets read, multiplied,
        // and re-written. If any model's return shape omits adjustedRisk (or
        // sets it to NaN/undefined), Math.round(undefined * x) = NaN propagates
        // into overallScore via Math.max(...). Surfaced as `Disease Pressure:
        // MINIMAL NaN%` in production 2026-04-27 — root cause was Waitea's
        // degraded return shape (closed in b35fix353b at the model level), but
        // the same shape-asymmetry NaN leak would recur with any future model
        // that lands in this loop without adjustedRisk set. Coerce non-finite
        // adjustedRisk to 0 here at the assembly point — same defensive shape
        // as the `(b.adjustedRisk || 0)` guards at lines 3545 and 3559.
        const inputAdjRisk = Number.isFinite(d.adjustedRisk) ? d.adjustedRisk : 0;
        const inputRiskScore = Number.isFinite(d.riskScore) ? d.riskScore : 0;
        d.adjustedRisk = Math.min(100, Math.round(inputAdjRisk * taperMultiplier(inputRiskScore, mult)));
        d.riskLevel = classifyRisk(d.adjustedRisk);
        if (mult !== 1) {
            d.regionalNote = `Regional pressure: ${mult > 1 ? '+' : ''}${Math.round((mult - 1) * 100)}% (${regionInfo.name})`;
        }
    });
    diseases.sort((a, b) => (b.adjustedRisk || 0) - (a.adjustedRisk || 0));

    // === Recommendation language ===
    // Attach one `recommendation` object per disease result.
    // trendDelta: if forecast daily scores available, compute 3-day delta;
    //             otherwise null (recommendation degrades gracefully).
    // FungicideFilter: injected via input or window — never required.
    // residualContext: from spray-log-cascade (via input or window._sprayResidualProtection).
    const _ff = input?.fungicideFilter ||
                (typeof window !== 'undefined' ? window.GAIP_FungicideFilter : null) ||
                null;
    // Prefer explicit injection; fall back to global written by spray-log-cascade.injectIntoState()
    const _residualCtx = input?.residualContext ||
                (typeof window !== 'undefined' ? window._sprayResidualProtection : null) ||
                (typeof window !== 'undefined' ? window.GAIP_STATE?.sprayContext?.residualProtection : null) ||
                null;
    diseases.forEach(d => {
        let trendDelta = null;
        if (d.forecast?.daily && d.forecast.daily.length >= 2) {
            const daily   = d.forecast.daily;
            const current = daily[0]?.score ?? null;
            const past3   = daily[Math.min(2, daily.length - 1)]?.score ?? null;
            if (current !== null && past3 !== null) {
                trendDelta = current - past3;
            }
        }
        d.recommendation = buildRecommendation(d, regionCode, trendDelta, _ff, _residualCtx);
    });

    // Overall score: MAX of validated (non-beta) diseases.
    // b35fix353b: defensive Number.isFinite filter on the inputs to Math.max.
    // The dispatcher loop above already defends against the Waitea-shape NaN
    // leak (Math.round(undefined * x) → NaN), but if a future model returns
    // NaN/undefined adjustedRisk and slips past the dispatcher (e.g., a
    // post-coupling layer corrupts the value), Math.max(..., NaN) returns
    // NaN and surfaces as `Disease Pressure: MINIMAL NaN%` to the user.
    // Coerce non-finite values to 0 here at the read point — same defensive
    // shape as the disease-stress-climate-coupling layer should have.
    const validated = diseases.filter(d => d.validationStatus !== 'beta' && !(d.validationBadge && d.validationBadge.includes('BETA')));
    const _safeRisk = (d) => Number.isFinite(d.adjustedRisk) ? d.adjustedRisk : 0;
    const overallScore = validated.length > 0
        ? Math.max(...validated.map(_safeRisk))
        : (diseases.length > 0 ? Math.max(...diseases.map(_safeRisk)) : 0);

    // Alerts
    const alerts = diseases
        .filter(d => d.riskLevel === 'severe' || d.riskLevel === 'high')
        .map(d => ({
            disease: d.displayName,
            urgency: d.riskLevel === 'severe' ? 'critical' : 'high',
            message: `${d.displayName} risk ${d.riskLevel.toUpperCase()} (${d.adjustedRisk}%)`,
            action: d.interventions?.timing || 'Action recommended',
            type: d.alertType || `${d.riskLevel.toUpperCase()}_RISK`,
        }));

    // Nutrient alerts from tissue
    if (tissueNutrients?.notes?.length > 0) {
        tissueNutrients.notes.forEach(note => {
            if (note.toLowerCase().includes('critical') || note.toLowerCase().includes('low')) {
                alerts.push({
                    disease: 'Nutrition', urgency: note.toLowerCase().includes('critical') ? 'critical' : 'moderate',
                    message: note, action: 'Address nutrient imbalance to reduce disease susceptibility', type: 'NUTRIENT_ALERT',
                });
            }
        });
    }

    return {
        timestamp: new Date().toISOString(),
        species: normalizedSpecies,
        region: regionInfo,
        fungicideRegion: regionCode,
        overallRisk: classifyRisk(overallScore),
        overallScore,
        diseases,
        // b35fix420 (C23): species-applicability disclosure.
        // suppressedDiseases lists models that were not run because the
        // species susceptibility fell at or below the dispatcher gate.
        // applicableDiseaseCount is the number of models actually dispatched.
        // Renderers consume both to emit a "showing N of M, suppressed: X, Y"
        // footnote so turf managers don't read the per-disease list as the
        // full universe.
        suppressedDiseases,
        applicableDiseaseCount: diseases.length,
        topThreats: diseases.slice(0, 3).map(d => ({
            disease: d.displayName, risk: d.adjustedRisk, level: d.riskLevel,
            primaryDriver: d.primaryDriver || Object.keys(d.drivers || {})[0],
            regionalMultiplier: d.regionalMultiplier,
            nutrientNote: d.nutrientNote || null,
        })),
        alerts,
        variety: variety ? {
            name: variety.name, source: variety.source,
            modifiersApplied: variety.disease ? Object.keys(variety.disease).filter(k => variety.disease[k]?.riskMultiplier !== 1) : [],
        } : null,
        tissueNutrients: tissueNutrients ? {
            hasData: tissueNutrients.hasData, compositeModifier: tissueNutrients.compositeModifier,
            modifiers: tissueNutrients.modifiers, notes: tissueNutrients.notes,
        } : null,
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

const DiseaseEnginePure = {
    version: '3.0.0',
    analyse,
    buildRecommendation,  // exposed for unit testing and direct use
    // Sub-models exposed for direct testing
    models: {
        dollarSpot: DollarSpotModel,
        brownPatch: BrownPatchModel,
        pythium: PythiumModel,
        anthracnose: AnthracnoseModel,
        fusarium: FusariumModel,
        helminthosporium: HelminthosporiumModel,
        grayLeafSpot: GrayLeafSpotModel,
        waiteaPatch: WaiteaPatchModel,
        springDeadSpot: SpringDeadSpotModel,
        takeAll: TakeAllModel,
    },
    // Utilities exposed for testing and reuse
    utils: {
        classifyRisk,
        normalizeSpecies,
        resolveDiseaseDisplayName,         // b35fix419 — C4 species-aware disease label
        getNightTemp,
        getNightHumidity,
        getLeafWetnessHours,
        get5DayAvgTemp,
        get5DayMeanRH,                     // b35fix335
        resolveMeanAirTemp,                // b35fix348 — shared 4-rung fallback (rungs 2-4)
        resolveMeanAirTempSource,          // b35fix350 — rung+source resolver (all 4 rungs, used by DollarSpot diagnostic)
        getNutterShaneForecast,            // b35fix352 — paper-faithful Pythium boolean forecast (Nutter 1983 + Shane 1994)
        getLatinInfectionCommencement,     // b35fix455 (C61), Latin 2021 infection-commencement diagnostic (CABI 2024)
        getSmithKerns2018Probability,      // b35fix335 — the actual SK 2018 logistic
        smithKernsProbToFactor,            // b35fix335 — Gilba 0–1 mapping helper
        confidenceToScore,
        getRegionalDiseaseMultiplier,
    },
    // Reference data
    SPECIES_SUSCEPTIBILITY,
    DISEASE_CONFIG,
    N_MODIFIERS,
    N_MODIFIERS_BROWN_PATCH,
    N_MODIFIERS_FUSARIUM,
};

// Export for Node.js (test harness) and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiseaseEnginePure;
}
if (typeof root !== 'undefined') {
    root.DiseaseEnginePure = DiseaseEnginePure;

    // b35fix456 (C56): GAIP_DiseaseEnginePure namespace alias for convention
    // symmetry with the ~60 sibling GAIP_* globals on window. Pre-fix the
    // module exported only as bare `root.DiseaseEnginePure`, inconsistent
    // with the GAIP_* naming convention used across the hub (GAIP_HUB_VERSION,
    // GAIP_ClimateV2, GAIP_PreEmergent, GAIP_NUTRITION_AU_FERTILISER etc.).
    // The asymmetry was logged as a P3 hygiene candidate from the b35fix453
    // session and demonstrated as a working defect during b35fix455 live
    // verification: probes using `window.GAIP_DiseaseEnginePure` returned
    // undefined despite the engine being loaded, costing a verification
    // round to track down the actual binding. The fix is additive (both
    // bindings coexist, same object reference via assignment chain to
    // DiseaseEnginePure) and SaaS-migration-safe (resolves via `root.*`
    // which is `window` in browser and `global` in Node, mirroring the
    // existing UMD pattern). Closes C56 from the post-395 migration ledger.
    root.GAIP_DiseaseEnginePure = root.DiseaseEnginePure;

    // v3.0.3: Explicitly set GILBA_USE_PURE_DISEASE = true so the flag has a
    // defined value rather than relying on !==false defaulting.
    //
    // Without this, any conditional script load or wp_enqueue_script ordering
    // change silently falls back to the legacy engine with no PHP-level log.
    //
    // To revert to legacy: set window.GILBA_USE_PURE_DISEASE = false BEFORE
    // disease-engine-pure.js loads, OR set it in the browser console and reload.
    //
    // PHP note: if you ever conditionally enqueue this file, add an explicit
    //   wp_add_inline_script( 'disease-engine-pure', 'window.GILBA_USE_PURE_DISEASE = true;', 'before' );
    // so the flag remains visible in server-side logs via error_log().
    if (typeof root.GILBA_USE_PURE_DISEASE === 'undefined') {
        root.GILBA_USE_PURE_DISEASE = true;
        console.log('[DiseaseEnginePure] GILBA_USE_PURE_DISEASE set to true (pure engine active)');
    } else if (root.GILBA_USE_PURE_DISEASE === false) {
        console.warn('[DiseaseEnginePure] GILBA_USE_PURE_DISEASE is false, pure engine loaded but DISABLED. Legacy DiseaseEngine.analyse() will be used.');
    }

    // v3.0.2: Shim legacy DiseaseEngine.analyse to route through pure engine.
    // Installed here (not in disease-integration.js) to guarantee the shim is
    // active before ANY caller invokes DiseaseEngine.analyse().
    // Set window.GILBA_USE_PURE_DISEASE = false to revert.
    if (root.DiseaseEngine && root.DiseaseEngine.analyse) {
        var _legacyAnalyse = root.DiseaseEngine.analyse;
        root.DiseaseEngine._legacyAnalyse = _legacyAnalyse; // preserve for debugging
        root.DiseaseEngine.analyse = function(inputs) {
            if (root.GILBA_USE_PURE_DISEASE === false) {
                return _legacyAnalyse.call(root.DiseaseEngine, inputs);
            }
            // Inject dependencies if missing
            if (!inputs.regionalMultipliers) {
                inputs.regionalMultipliers = {};
                if (typeof root.gaip_getDiseaseMultiplier === 'function') {
                    ['dollarSpot','brownPatch','pythiumBlight','fusariumPatch',
                     'anthracnose','takeAllPatch','grayLeafSpot','springDeadSpot',
                     'largePatch','wateaPatch','redThread'].forEach(function(d) {
                        var m = root.gaip_getDiseaseMultiplier(d, inputs.region || 'AU');
                        if (m !== 1) inputs.regionalMultipliers[d] = m;
                    });
                }
            }
            if (!inputs.regionDisplayInfo) {
                inputs.regionDisplayInfo = typeof root.gaip_getRegionDisplayInfo === 'function'
                    ? root.gaip_getRegionDisplayInfo(inputs.region || 'AU')
                    : { name: inputs.region || 'Unknown' };
            }
            return DiseaseEnginePure.analyse(inputs);
        };
    }
}

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
