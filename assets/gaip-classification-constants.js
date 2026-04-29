/**
 * gaip-classification-constants.js — v1.0.0
 *
 * Single source of truth for soil threshold data and methodology selection
 * across the GAIP Hub.
 *
 * -----------------------------------------------------------------------------
 * MLSN (Minimum Level for Sustainable Nutrition) thresholds
 * -----------------------------------------------------------------------------
 * Published values from:
 *   Woods, M.S., Stowell, L.J., Gelernter, W.D. (2016)
 *   "Minimum soil nutrient guidelines for turfgrass developed from Mehlich 3
 *   soil test results." PeerJ Preprints 4:e2144v1.
 *   https://doi.org/10.7287/peerj.preprints.2144v1
 *
 * Values as published by the PACE Turf / Asian Turfgrass Center MLSN program
 * and the GCSAA IPM Planning Guide.
 *
 * Historical note: prior to b35fix301a the MLSN sulphur threshold was
 * hardcoded as 7 ppm in five files (tissue-corrective-engine-pure.js,
 * nutrient-demand-engine.js, nutrient-trend.js, hub-tissue-v3.js,
 * scenario-presets.js) and 6 ppm in two (nutrition-calendar.js,
 * nutrition-summary-integration.js). b35fix301a standardises on the published
 * value of 7 ppm; the S:6 entries were drift away from the canonical guideline.
 *
 * -----------------------------------------------------------------------------
 * SLAN (Sufficiency Level of Available Nutrients) ranges
 * -----------------------------------------------------------------------------
 * Traditional sufficiency approach. Source: Carrow, R.N., Waddington, D.V.,
 * Rieke, P.E. (2001) "Turfgrass Soil Fertility and Chemical Problems."
 *
 * -----------------------------------------------------------------------------
 * AA (Ammonium Acetate) thresholds
 * -----------------------------------------------------------------------------
 * Hill Labs NZ standard soil test interpretation ranges. Upper bound of "low"
 * range = minimum sufficiency threshold. Soil texture-dependent for K and Mg
 * (sands vs others). P uses Olsen extraction.
 *
 * -----------------------------------------------------------------------------
 * Retest policy
 * -----------------------------------------------------------------------------
 * Gilba Solutions practice standard (Spencer 2026). Present in this module for
 * the b35fix301b portfolio summary adapter; not consumed in 301a.
 * CEC < 3 meq/100g (sand profiles, low buffering):  365 days
 * CEC >= 3 meq/100g or CEC missing (all others):    1095 days (3 years)
 *
 * -----------------------------------------------------------------------------
 * @version 1.0.0 (b35fix301a)
 * @author  Gilba Solutions
 */
(function (global) {
  "use strict";

  var VERSION = "1.0.0";

  // ==========================================================================
  // DATA TABLES
  // ==========================================================================

  /**
   * MLSN thresholds (Mehlich-3 extraction).
   * Woods, Stowell, Gelernter 2016 (PeerJ Preprints 4:e2144v1).
   * Published via PACE Turf MLSN program and GCSAA IPM Planning Guide.
   */
  var MLSN_THRESHOLDS = {
    P:  21,    // ppm Mehlich-3
    K:  37,    // ppm
    Ca: 331,   // ppm
    Mg: 47,    // ppm
    S:  7,     // ppm sulfate-S
    Fe: 2,     // ppm
    Mn: 1,     // ppm
    Zn: 1,     // ppm
    Cu: 0.3,   // ppm
    B:  0.3    // ppm
  };

  /**
   * SLAN sufficiency ranges (Carrow et al. 2004 sufficiency-band methodology).
   *
   * b35fix333 — provenance correction. PRE-b35fix333 this constant claimed
   * "Throssell USGA 2009" as the source for ranges P=25–50, K=75–150,
   * Ca=500–1000, Mg=60–200, S=12–30. Verification 2026-04-25 confirmed the
   * Throssell, Lyman, Johnson, Stacey, Brown 2009 Applied Turfgrass Science
   * papers (DOI 10.1094/ATS-2009-0129-01-RS water use; DOI 10.1094/
   * ATS-2009-1203-01-RS nutrient use) are GCSAA Golf Course Environmental
   * Profile SURVEY papers. They do not contain SLAN sufficiency ranges.
   * The previous numbers were LLM-generated approximations wrapped in a
   * fabricated citation. Per Gilba non-negotiable #1 (no fabricated
   * agronomic values), the source has been corrected to the actual published
   * SLAN ranges paper, and the numbers shift to match what is published.
   *
   * b35fix333 — methodology adoption (Spencer decision 2026-04-25, Option 1):
   * single ranges set, "other soils" / high-CEC values across the board
   * (sand-vs-other split deferred to b35fix334).
   *
   * b35fix325 — methodology consolidation (single SSOT for SLAN). Retained.
   *
   * Source: Carrow, R.N., Stowell, L., Gelernter, W., Davis, S., Duncan, R.R.,
   *         Skorulski, J. (2004). "Clarifying soil testing: III. SLAN
   *         sufficiency ranges and recommendations." Golf Course Management
   *         72(1):194-198.
   * Verified via two independent secondary sources 2026-04-25: Florida 2021
   * Balanced Approach Agronomic Program Planning Guide page 9 Table 3 (which
   * cites Carrow 2004 GCM directly), and a Crop Science paper summarising
   * Carrow 2004 SLAN guidelines (upper bounds Ca=751, Mg=121, P=55, K=117,
   * S=41 confirm rounding of the published Table 1).
   *
   * Methodology:
   *   below floor:    deficit — apply removal + lift to floor (over 2 years)
   *   floor..ceiling: sufficient — apply removal only
   *   above ceiling:  high — apply 0 (suppress)
   *
   * Status terminology (per Gilba style decision 2026):
   *   < floor × 0.5:        Deficient
   *   floor × 0.5 .. floor: Deficient
   *   floor .. ceiling:     Sufficient
   *   > ceiling:            Excessive
   *
   * Carrow 2004 Table 1 also publishes a sand vs other-soils split for K and
   * Mg specifically. b35fix334 will encode the split. Until then, "other
   * soils" / high-CEC values are used for all samples (Option 1).
   *
   * Carrow et al. 2004 Table 1 published values (Mehlich-3 extractant unless noted):
   *   P (Mehlich-3):  27–54 ppm  (sand and other soils both)
   *   P (Bray P1):    15–30 ppm
   *   P (Olsen):      12–28 ppm
   *   K:              50–116 ppm sand / 75–176 ppm other     <-- Option 1 uses other
   *   Ca:             500–750 ppm
   *   Mg:             60–120 ppm sand / 70–140 ppm other     <-- Option 1 uses other
   *   S:              15–40 ppm
   * MLSN benchmarks for cross-reference: P=21, K=37, Ca=331, Mg=47, S=7.
   *
   * Comparison to pre-b35fix333 v11.5.0 encoded values (which were unsourced):
   *   P  was 25–50  → now 27–54   (small shift, lifts floor and ceiling slightly)
   *   K  was 75–150 → now 75–176  (floor unchanged; ceiling widens — fewer "above ceiling" classifications)
   *   Ca was 500–1000 → now 500–750 (floor unchanged; ceiling tightens — some previously in-range samples may classify above ceiling)
   *   Mg was 60–200 → now 70–140  (floor lifts 10; ceiling tightens 60 — both directions)
   *   S  was 12–30  → now 15–40   (floor lifts 3; ceiling lifts 10 — some "in range" low-S samples will reclassify "below floor", triggering S-recon synthesis where it didn't before)
   *
   * NOTE: pre-b35fix325 the engine used a single-midpoint Carrow 2001 SLAN
   * methodology (K target = 117 ppm or 112 ppm depending on file — the
   * four-way disagreement that triggered this consolidation). All readers
   * now route through this module; SLAN_THRESHOLDS retains backward-compat
   * single-value access but those values are NOW the floors of the Carrow
   * 2004 ranges.
   */
  var SLAN_RANGES = {
    P:  { floor: 27,  ceiling: 54,  citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range', extraction: 'Mehlich-3' },
    K:  { floor: 75,  ceiling: 176, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range', extraction: 'Mehlich-3' },
    Ca: { floor: 500, ceiling: 750, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range', extraction: 'Mehlich-3' },
    Mg: { floor: 70,  ceiling: 140, citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range', extraction: 'Mehlich-3' },
    S:  { floor: 15,  ceiling: 40,  citation: 'Carrow et al. (2004). GCM 72(1):194-198.', methodology: 'SLAN-Carrow-2004-range', extraction: 'Mehlich-3' }
  };

  /**
   * SLAN backward-compat single-value table.
   *
   * b35fix333: sourced from SLAN_RANGES floors (Carrow 2004), not Throssell.
   * Pre-existing readers (tissue-corrective-engine-pure.js, nutrition-calendar.js)
   * use SLAN_THRESHOLDS.K as a single sufficiency-floor number — under
   * Carrow 2004 that number is 75 (unchanged from pre-b35fix333 by coincidence
   * since 75 happens to match Carrow 2004's "other soils" K floor exactly).
   * Other floors shift: P 25→27, Mg 60→70, S 12→15. Ca floor 500 unchanged.
   *
   * Trace minor elements (Fe, Mn, Zn, Cu, B) retained as before — Carrow 2004
   * Table 1 covers macronutrients only; trace floors come from established
   * turfgrass tissue/soil norms.
   */
  var SLAN_THRESHOLDS = {
    P:  SLAN_RANGES.P.floor,
    K:  SLAN_RANGES.K.floor,
    Ca: SLAN_RANGES.Ca.floor,
    Mg: SLAN_RANGES.Mg.floor,
    S:  SLAN_RANGES.S.floor,
    Fe: 2,
    Mn: 1,
    Zn: 1,
    Cu: 0.3,
    B:  0.3
  };

  /**
   * Ammonium Acetate thresholds (Hill Labs NZ).
   * Texture-dependent for K and Mg. P uses Olsen extraction.
   */
  var AA_THRESHOLDS = {
    sands:  { P: 12, K: 75,  Ca: 500, Mg: 100, S: 30, Fe: 40, Mn: 5, Zn: 1, Cu: 0.5, B: 0.3 },
    others: { P: 12, K: 100, Ca: 500, Mg: 140, S: 30, Fe: 40, Mn: 5, Zn: 1, Cu: 0.5, B: 0.3 }
  };

  /**
   * P threshold pH-adjustment bands (Mehlich-3).
   * Base MLSN value (21 ppm) applies when pH is in the 6.0-7.5 range;
   * P availability is reduced at acid and alkaline extremes, so the
   * sufficiency threshold is lifted accordingly.
   *
   * Previously duplicated in hub-tissue-v3.js and nutrition-summary-integration.js.
   */
  var P_PH_ADJUSTMENTS = [
    { maxPh: 5.5, threshold: 35 },
    { maxPh: 6.0, threshold: 28 },
    { maxPh: 7.5, threshold: 21 },   // base MLSN
    { maxPh: 8.0, threshold: 32 },
    { maxPh: 99,  threshold: 40 }
  ];

  /**
   * Retest-due policy. CEC-banded. Consumed by the portfolio summary
   * adapter in b35fix301b; present here so the constants module owns the
   * policy data from the start.
   */
  var RETEST_POLICY = {
    low_cec:  { threshold_max: 3, interval_days: 365  },   // CEC < 3
    heavier:  { threshold_min: 3, interval_days: 1095 }    // CEC >= 3 or missing
  };

  // ==========================================================================
  // RESOLVERS
  // ==========================================================================

  /**
   * Return the soil nutrient threshold table for the given methodology.
   * Replaces the local resolver previously held by tissue-corrective-engine-pure.js.
   *
   * @param {string} methodology   - "mlsn" | "slan" | "ammonium_acetate" | "aa"
   * @param {string} [soilTexture] - "sands" | "others" (only used for AA)
   * @returns {Object} threshold table keyed by nutrient symbol
   */
  function getSoilThresholds(methodology, soilTexture) {
    var m = (methodology || "mlsn").toLowerCase();
    if (m === "slan") return SLAN_THRESHOLDS;
    if (m === "ammonium_acetate" || m === "ammoniumacetate" || m === "aa") {
      var texture = (soilTexture || "sands").toLowerCase();
      return AA_THRESHOLDS[texture === "others" ? "others" : "sands"];
    }
    return MLSN_THRESHOLDS;
  }

  /**
   * Apply pH-based adjustment to a P threshold.
   * Returns the adjusted threshold, or the base threshold if pH is unknown.
   *
   * @param {number} basePThreshold - the P threshold before adjustment
   * @param {number} [soilPH]       - soil pH value
   * @returns {number}
   */
  function adjustPForPh(basePThreshold, soilPH) {
    if (soilPH == null) return basePThreshold;
    for (var i = 0; i < P_PH_ADJUSTMENTS.length; i++) {
      if (soilPH < P_PH_ADJUSTMENTS[i].maxPh) {
        return P_PH_ADJUSTMENTS[i].threshold;
      }
    }
    return basePThreshold;
  }

  /**
   * b35fix325 — Return the full SLAN sufficiency-range table.
   * b35fix333 — Source corrected to Carrow et al. 2004 GCM (was fabricated Throssell).
   * For consumers that need both floor AND ceiling (engine, threshold attachment,
   * K Reconciliation renderer caption). Single-value backward-compat readers
   * continue to use getSoilThresholds('slan') / SLAN_THRESHOLDS directly.
   */
  function getSlanRanges() {
    return SLAN_RANGES;
  }

  // ==========================================================================
  // EXPORT
  // ==========================================================================

  global.GilbaClassificationConstants = {
    VERSION: VERSION,
    MLSN_THRESHOLDS: MLSN_THRESHOLDS,
    SLAN_THRESHOLDS: SLAN_THRESHOLDS,
    SLAN_RANGES: SLAN_RANGES,
    AA_THRESHOLDS: AA_THRESHOLDS,
    P_PH_ADJUSTMENTS: P_PH_ADJUSTMENTS,
    RETEST_POLICY: RETEST_POLICY,
    getSoilThresholds: getSoilThresholds,
    getSlanRanges: getSlanRanges,
    adjustPForPh: adjustPForPh
  };

}(typeof window !== "undefined" ? window : this));
