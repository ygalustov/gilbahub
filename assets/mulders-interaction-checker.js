/**
 * mulders-interaction-checker.js — v1.1.0
 *
 * Mulder's Chart nutrient interaction checker for GAIP Hub.
 * Runs after MLSN/SLAN/NH4OAc sufficiency check and flags antagonistic
 * interactions that raw sufficiency numbers alone cannot detect.
 *
 * Architecture:
 *   nutrients[] (from mlsn-progressive-disclosure.js convertMLSNToProgressive)
 *       → normaliseToBasis(nutrients, methodology)   [unit conversion]
 *       → checkMuldersInteractions(normalised, context)  [interaction graph]
 *       → returns Map<nutrientSymbol, MuldersFlag[]>
 *
 * The flags are consumed by renderMLSNDiagnosticCard() which injects them
 * into the existing card's "why" section alongside tissue conflict badges.
 *
 * Methodology handling:
 *   MLSN / SLAN   — values already in mg/kg (ppm). No conversion needed.
 *   Ammonium acetate (Hill Labs NZ) — exchangeable cations in cmol/kg.
 *                   K, Ca, Mg, Na are converted to mg/kg for ratio checking
 *                   using atomic weights: K=39.1, Ca=40.1, Mg=24.3, Na=23.0.
 *
 * Interaction graph source:
 *   Marschner H (2012) Mineral Nutrition of Higher Plants, 3rd ed. Academic Press.
 *   Kopittke PM & Menzies NW (2007) A review of the use of the basic cation
 *     saturation ratio and the "ideal" soil. Soil Sci Soc Am J 71:259-265.
 *   Carrow RN, Waddington DV, Rieke PE (2001) Turfgrass Soil Fertility and
 *     Chemical Problems. John Wiley & Sons. Chapter 5 explicitly recommends
 *     sufficiency-level (SLAN/MLSN) over BCSR for turf interpretation.
 *   Leiva Soto A et al. (2023) Calcium-magnesium ratios did not affect crop
 *     yields in a 6-year field experiment. Soil Sci Soc Am J 87:1373-1385.
 *   Bowman DC et al. (2006) Soil and plant tissue testing for turfgrass.
 *     In: Handbook of Turfgrass Management and Physiology. CRC Press.
 *
 * b35fix439 (v1.1.0): OQ-Mulder closure. Ca:Mg rule retired. The previous
 * Ca:Mg threshold (7.0 mass ratio, severeAt 12.0) was attributed to
 * Carrow & Duncan (1998), but that text is a salinity/sodicity reference
 * (Salt-Affected Turfgrass Sites) and the Ca:Mg discussion there concerns
 * Ca displacement of Na on the exchange complex, not Ca-induced Mg
 * suppression. The ratio rule traces structurally to BCSR, which Kopittke
 * & Menzies (2007) reviewed and found unsupported by yield data, and
 * Leiva Soto et al. (2023) confirmed in a 6-year corn/soybean field
 * trial. K:Mg, K:Ca, and Mg:K rules retained because those are
 * Marschner-grounded uptake-carrier antagonisms, not BCSR-derived.
 * The K:Mg co-citation to Carrow & Duncan (1998) was the same
 * misattribution and has been stripped.
 *
 * @author Gilba Solutions
 * @version 1.1.0
 */

(function (global) {
  "use strict";

  // =========================================================================
  // INTERACTION GRAPH
  // Each entry: suppressor excess → suppressed nutrient becomes less available.
  // threshold: ratio (suppressor/suppressed in mg/kg) at which effect is significant.
  // severity: 'moderate' | 'high' — drives badge colour (amber | red).
  // citation: short reference string for "why" section.
  // =========================================================================

  var MULDER_INTERACTIONS = [
    // ── Cation antagonisms (most important for turf) ─────────────────────
    {
      suppressor: "K",
      suppressed: "Mg",
      ratio: "K:Mg",
      threshold: 2.5, // mass ratio mg/kg:mg/kg; >2.5 agronomically significant
      severeAt: 5.0, // >5.0 high severity
      severity: "moderate",
      message: "Elevated K:Mg ratio, excess K competitively suppresses Mg uptake at root level.",
      detail:
        "K and Mg share cation uptake carriers (high-affinity transport). K:Mg >2.5 (mass ratio) reduces Mg absorption even when soil Mg is above sufficiency threshold. Common on sand profiles with high K fertiliser programs or calcareous irrigation water.",
      citation: "Marschner 2012",
    },
    {
      suppressor: "K",
      suppressed: "Ca",
      ratio: "K:Ca",
      threshold: 0.5, // K:Ca mass ratio
      severeAt: 1.0,
      severity: "moderate",
      message: "Elevated K:Ca ratio, excess K can suppress Ca translocation to shoot tips.",
      detail:
        "Ca mobility in the phloem is limited; excess K at root level reduces Ca uptake efficiency. Most significant under low-transpiration conditions (shade, dew periods).",
      citation: "Marschner 2012",
    },
    // ── Ca:Mg rule retired in b35fix439 (v1.1.0) ─────────────────────────
    // The previous Ca:Mg rule (threshold 7.0, severeAt 12.0, citation
    // "Carrow & Duncan 1998; Kopittke & Menzies 2007") has been removed.
    // Carrow & Duncan (1998) is "Salt-Affected Turfgrass Sites" — a
    // salinity/sodicity reference; its Ca:Mg discussion concerns Ca
    // displacement of Na on the exchange complex, not Ca-induced Mg
    // suppression. The threshold itself traces structurally to BCSR,
    // which Kopittke & Menzies (2007) reviewed and found unsupported by
    // yield data, and Leiva Soto et al. (2023) confirmed null in a
    // 6-year corn/soybean field trial (SSSAJ 87:1373-1385). Surviving
    // K:Mg, K:Ca, and Mg:K rules are Marschner-grounded uptake-carrier
    // antagonisms, not BCSR-derived, and are retained.
    // ────────────────────────────────────────────────────────────────────
    {
      suppressor: "Mg",
      suppressed: "K",
      ratio: "Mg:K",
      threshold: 4.0, // Mg:K mass ratio; very high Mg can suppress K
      severeAt: 8.0,
      severity: "moderate",
      message: "Elevated Mg:K ratio, excess Mg may suppress K uptake.",
      detail:
        "Less common than K→Mg suppression but occurs on dolomite-heavy or heavily magnesited soils. Turf shows K deficiency symptoms (tip scorch, poor stress tolerance) despite adequate soil K.",
      citation: "Marschner 2012",
    },
    // ── Phosphorus antagonisms ────────────────────────────────────────────
    {
      suppressor: "P",
      suppressed: "Zn",
      ratio: "P:Zn",
      threshold: 100, // P:Zn mass ratio
      severeAt: 200,
      severity: "moderate",
      message: "Elevated P:Zn ratio, excess P can induce Zn deficiency.",
      detail:
        "High soil P inhibits Zn solubilisation and root uptake. Significant on alkaline sands receiving high P inputs. Zn deficiency in turf presents as shortened internodes and pale new growth.",
      citation: "Marschner 2012; Bowman et al. 2006",
    },
    {
      suppressor: "P",
      suppressed: "Fe",
      ratio: "P:Fe",
      threshold: 10,
      severeAt: 20,
      severity: "moderate",
      message: "Elevated P:Fe ratio, excess P can precipitate Fe in the rhizosphere.",
      detail:
        "P reacts with Fe³⁺ to form insoluble iron phosphates, reducing Fe availability regardless of total soil Fe. Common on alkaline profiles after P fertilisation.",
      citation: "Marschner 2012",
    },
    {
      suppressor: "P",
      suppressed: "Cu",
      ratio: "P:Cu",
      threshold: 500,
      severeAt: 1000,
      severity: "moderate",
      message: "Elevated P:Cu ratio, excess P may reduce Cu availability.",
      detail:
        "Similar mechanism to P:Zn. Cu deficiency in turf is rare but presents as wilting and blue-green discolouration under high P regimes.",
      citation: "Marschner 2012",
    },
    // ── Iron / Manganese / Zinc interactions ─────────────────────────────
    {
      suppressor: "Fe",
      suppressed: "Mn",
      ratio: "Fe:Mn",
      threshold: 2.5,
      severeAt: 5.0,
      severity: "moderate",
      message: "Elevated Fe:Mn ratio, excess Fe can suppress Mn uptake.",
      detail:
        "Fe and Mn compete for the same root uptake pathway (IRT transporters). High Fe (common after Fe-acidification programs or high-Fe irrigation water) reduces Mn availability. Mn deficiency presents as interveinal chlorosis on young leaves.",
      citation: "Marschner 2012",
    },
    {
      suppressor: "Mn",
      suppressed: "Fe",
      ratio: "Mn:Fe",
      threshold: 2.0,
      severeAt: 4.0,
      severity: "moderate",
      message: "Elevated Mn:Fe ratio, excess Mn can suppress Fe uptake.",
      detail:
        "High Mn (common at low pH <5.5) competes with Fe for uptake. Fe deficiency under acid conditions is often Mn-induced rather than absolute Fe deficiency. Check pH.",
      citation: "Marschner 2012",
    },
    {
      suppressor: "Zn",
      suppressed: "Fe",
      ratio: "Zn:Fe",
      threshold: 0.5,
      severeAt: 1.0,
      severity: "moderate",
      message: "Elevated Zn:Fe ratio, excess Zn may interfere with Fe uptake.",
      detail: "Less common; occurs after heavy Zn fungicide applications (zineb, mancozeb) on low-Fe sandy soils.",
      citation: "Marschner 2012",
    },
    // ── Nitrogen form interactions ────────────────────────────────────────
    // Note: N form (NH4 vs NO3) is not typically measured in a standard soil
    // test, so this interaction is flagged based on context (species, season)
    // rather than a ratio. Handled separately in _checkNitrogenFormContext().
  ];

  // =========================================================================
  // ATOMIC WEIGHTS for cmol/kg → mg/kg conversion (ammonium acetate)
  // =========================================================================

  var ATOMIC_WEIGHTS = {
    K: 39.1,
    Ca: 40.08,
    Mg: 24.31,
    Na: 22.99,
    // Monovalent: mg/kg = cmol/kg × atomic_weight × 10
    // Divalent:   mg/kg = cmol/kg × atomic_weight × 5
  };

  var VALENCE = { K: 1, Ca: 2, Mg: 2, Na: 1 };

  // =========================================================================
  // UNIT NORMALISATION
  // =========================================================================

  /**
   * Convert nutrients array to a flat mg/kg map regardless of methodology.
   * @param {Array} nutrients — array of { nutrient, actual, ... }
   * @param {string} methodology — 'mlsn' | 'slan' | 'ammonium_acetate'
   * @returns {Object} map of { K: number, Ca: number, Mg: number, ... } in mg/kg
   */
  function normaliseToBasis(nutrients, methodology) {
    var basis = {};
    var isAA = methodology === "ammonium_acetate";

    nutrients.forEach(function (n) {
      var sym = n.nutrient;
      var raw = parseFloat(n.actual);
      if (isNaN(raw) || raw <= 0) return;

      if (isAA && ATOMIC_WEIGHTS[sym] && VALENCE[sym]) {
        // cmol/kg → mg/kg
        // mg/kg = cmol/kg × (atomic_weight / valence) × 10
        basis[sym] = raw * (ATOMIC_WEIGHTS[sym] / VALENCE[sym]) * 10;
      } else {
        // MLSN / SLAN already in mg/kg
        basis[sym] = raw;
      }
    });

    return basis;
  }

  // =========================================================================
  // INTERACTION CHECKER
  // =========================================================================

  /**
   * Check all Mulder interactions against the normalised basis.
   * @param {Object} basis — mg/kg map from normaliseToBasis()
   * @param {Object} context — mlsn context object (methodology, soilPH, etc.)
   * @returns {Object} map of { nutrientSymbol: [MuldersFlag, ...] }
   *   MuldersFlag: { ratio, value, threshold, severity, message, detail, citation }
   */
  // =========================================================================
  // EXTRACTANT-pH COMPATIBILITY
  // Bray 1, Bray 2, and Mehlich-3 over-extract P at pH > 7.5 because
  // acid-based extractants dissolve calcium phosphates that are not
  // plant-available. This inflates P values, causing false P→Fe, P→Zn,
  // P→Cu ratio flags. Olsen (NaHCO3) is the correct extractant above pH 7.5.
  // Source: Havlin et al. (2014) Soil Fertility and Fertilizers, 8th ed.;
  //         Pierzynski et al. (2005) Soils and Environmental Quality, 3rd ed.
  // =========================================================================
  var P_SENSITIVE_EXTRACTANTS = ["mehlich_3", "mehlich3", "mehlich-3", "bray1", "bray_1", "bray 1", "bray2", "bray_2", "bray 2"];
  var P_RULES = ["P:Zn", "P:Fe", "P:Cu"]; // ratio strings that involve P as suppressor

  function _isExtractantPHIncompatible(context) {
    var ext = ((context && context.extractant) || "").toLowerCase().replace(/\s+/g, "_");
    var pH  = parseFloat((context && context.soilPH) || 0);
    if (!ext || !pH) return false;
    var isPSensitive = P_SENSITIVE_EXTRACTANTS.some(function(e) { return ext.indexOf(e.replace(/\s+/g,"_")) !== -1; });
    return isPSensitive && pH >= 7.5;
  }

  function checkMuldersInteractions(basis, context) {
    var flags = {}; // keyed by suppressed nutrient symbol
    var pHIncompat = _isExtractantPHIncompatible(context); // b35fix267

    MULDER_INTERACTIONS.forEach(function (rule) {
      var supVal = basis[rule.suppressor];
      var suppdVal = basis[rule.suppressed];

      if (supVal == null || suppdVal == null || suppdVal <= 0) return;

      var ratioValue = supVal / suppdVal;

      if (ratioValue >= rule.threshold) {
        var severity = ratioValue >= rule.severeAt ? "high" : "moderate";

        // b35fix267: Downgrade P-based flags to advisory when extractant is
        // pH-incompatible (Mehlich-3 or Bray at pH >= 7.5). P is over-extracted
        // at high pH — the ratio reflects lab artefact, not agronomic reality.
        var extractantCaveat = null;
        if (pHIncompat && rule.suppressor === "P" && P_RULES.indexOf(rule.ratio) !== -1) {
          severity = "advisory";
          extractantCaveat = "Extractant-pH caveat: " + ((context && context.extractant) || "Mehlich-3/Bray") +
            " over-extracts P at pH " + ((context && context.soilPH) || ">7.5") +
            ". This ratio may reflect lab artefact rather than plant-available P. " +
            "Request Olsen-P retest if P antagonism is suspected. " +
            "Source: Havlin et al. (2014) Soil Fertility and Fertilizers, 8th ed.";
        }

        var flag = {
          suppressor: rule.suppressor,
          suppressed: rule.suppressed,
          ratio: rule.ratio,
          value: Math.round(ratioValue * 10) / 10,
          threshold: rule.threshold,
          severity: severity,
          message: rule.message,
          detail: rule.detail + (extractantCaveat ? " ⚠️ " + extractantCaveat : ""),
          citation: rule.citation + (extractantCaveat ? "; Havlin et al. 2014" : ""),
          extractantCaveat: extractantCaveat || null,
        };

        if (!flags[rule.suppressed]) flags[rule.suppressed] = [];
        flags[rule.suppressed].push(flag);
      }
    });

    // N form context check (not ratio-based)
    var nFormFlags = _checkNitrogenFormContext(basis, context);
    if (nFormFlags.length > 0) {
      if (!flags["K"]) flags["K"] = [];
      if (!flags["Ca"]) flags["Ca"] = [];
      if (!flags["Mg"]) flags["Mg"] = [];
      nFormFlags.forEach(function (f) {
        flags[f.suppressed] = flags[f.suppressed] || [];
        flags[f.suppressed].push(f);
      });
    }

    return flags;
  }

  /**
   * NH4-form nitrogen suppresses K, Ca, Mg uptake by competing for cation
   * exchange sites. Flag when context suggests heavy ammonium program
   * (e.g. urea/ammonium sulfate dominant, warm season C4 grass) without
   * nitrification inhibitors.
   * This is context-driven, not ratio-driven — no reliable soil test value.
   */
  function _checkNitrogenFormContext(basis, context) {
    var flags = [];
    // Only flag if: N program >150 kg/ha/yr AND C4 or mixed turf AND no
    // tissue test to confirm uptake (conservative — don't flag if we can't confirm).
    // We do not have NH4:NO3 ratio from a standard soil test, so we note
    // this as an advisory rather than a confirmed interaction.
    var nProgram = context && context.nProgram;
    var turfType = context && context.turfType;
    if (nProgram && nProgram > 150 && turfType === "warm-season") {
      var advisory = {
        suppressor: "NH₄-N",
        suppressed: "K", // flagged on K card as contextual advisory
        ratio: "N program context",
        value: null,
        threshold: null,
        severity: "advisory",
        message: "High N program on warm-season turf: verify N form split to minimise NH₄ competition with K, Ca, Mg.",
        detail:
          "Ammonium-form N (urea, ammonium sulfate) competes with K⁺, Ca²⁺, and Mg²⁺ for root cation uptake sites. At >150 kg N/ha/yr on C4 turf without nitrification inhibitors, cation uptake suppression is likely. Ensure 30–50% of N is nitrate form or use NBPT-stabilised urea.",
        citation: "Marschner 2012; Carrow & Duncan 1998",
      };
      flags.push(advisory);
    }
    return flags;
  }

  // =========================================================================
  // RENDERING
  // =========================================================================

  /**
   * Render a Mulder's interaction badge for injection into a nutrient card.
   * @param {Array} flags — MuldersFlag[] for this nutrient
   * @returns {string} HTML string
   */
  function renderMuldersBadge(flags) {
    if (!flags || flags.length === 0) return "";

    var hasHigh = flags.some(function (f) {
      return f.severity === "high";
    });
    var hasAdvisory = flags.every(function (f) {
      return f.severity === "advisory";
    });

    var bgColor = hasHigh ? "var(--gaip-critical-bg)" : hasAdvisory ? "var(--gaip-info-bg)" : "var(--gaip-warning-bg)";
    var borderColor = hasHigh ? "#fca5a5" : hasAdvisory ? "var(--gaip-info-bg)" : "var(--gaip-warning-border)";
    var iconColor = hasHigh ? "#dc2626" : hasAdvisory ? "#3b82f6" : "#d97706";

    var badgeId = "mulders-" + flags[0].suppressed + "-" + Date.now();

    var flagsHTML = flags
      .map(function (f) {
        var ratioStr = f.value != null ? f.ratio + " = " + f.value + " (threshold: " + f.threshold + ")" : f.ratio;
        return (
          '<div style="margin-bottom:8px;">' +
          '<div style="font-weight:600;font-size:11px;color:' +
          iconColor +
          ';margin-bottom:3px;">' +
          f.message +
          "</div>" +
          '<div style="font-size:10px;color:var(--gaip-text-secondary);margin-bottom:3px;">' +
          ratioStr +
          "</div>" +
          '<div style="font-size:10px;color:var(--gaip-text);line-height:1.4;">' +
          f.detail +
          "</div>" +
          '<div style="font-size:9px;color:var(--gaip-text-muted);margin-top:3px;">' +
          f.citation +
          "</div>" +
          "</div>"
        );
      })
      .join('<hr style="border:none;border-top:1px solid ' + borderColor + ';margin:6px 0;">');

    return (
      '<div class="gaip-mulders-badge" style="' +
      "background:" +
      bgColor +
      ";" +
      "border:1px solid " +
      borderColor +
      ";" +
      "border-radius:6px;" +
      "padding:8px 10px;" +
      "margin-top:8px;" +
      '">' +
      '<div style="font-size:10px;font-weight:700;color:' +
      iconColor +
      ';margin-bottom:6px;letter-spacing:0.3px;">' +
      "MULDER INTERACTION" +
      (flags.length > 1 ? "S (" + flags.length + ")" : "") +
      "</div>" +
      flagsHTML +
      "</div>"
    );
  }

  /**
   * Render a compact summary banner for the top of the soil card
   * listing all detected interactions at a glance.
   * @param {Object} allFlags — full flags map from checkMuldersInteractions()
   * @returns {string} HTML string, or '' if no interactions
   */
  function renderMuldersSummaryBanner(allFlags) {
    var entries = [];
    Object.keys(allFlags).forEach(function (sym) {
      allFlags[sym].forEach(function (f) {
        entries.push(f);
      });
    });

    if (entries.length === 0) return "";

    var hasHigh = entries.some(function (f) {
      return f.severity === "high";
    });
    var bgColor = hasHigh ? "var(--gaip-critical-bg)" : "var(--gaip-warning-bg)";
    var borderColor = hasHigh ? "#fca5a5" : "var(--gaip-warning-border)";
    var titleColor = hasHigh ? "#dc2626" : "#d97706";

    var items = entries
      .map(function (f) {
        var icon = f.severity === "high" ? "🔴" : f.severity === "advisory" ? "🔵" : "🟡";
        var ratioStr = f.value != null ? " (" + f.ratio + "=" + f.value + ")" : "";
        return icon + " " + f.suppressor + "→" + f.suppressed + ratioStr;
      })
      .join(" &nbsp;·&nbsp; ");

    return (
      '<div class="gaip-mulders-summary" style="' +
      "background:" +
      bgColor +
      ";" +
      "border:1px solid " +
      borderColor +
      ";" +
      "border-left:3px solid " +
      titleColor +
      ";" +
      "border-radius:6px;" +
      "padding:8px 12px;" +
      "margin-bottom:10px;" +
      "font-size:11px;" +
      '">' +
      '<span style="font-weight:700;color:' +
      titleColor +
      ';">Mulder interactions detected: </span>' +
      '<span style="color:var(--gaip-text);">' +
      items +
      "</span>" +
      '<span style="color:var(--gaip-text-muted);font-size:10px;margin-left:8px;">(see individual nutrient cards for detail)</span>' +
      "</div>"
    );
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Main entry point. Call after convertMLSNToProgressive() has parsed
   * the nutrients array but before renderMLSNProgressiveDisclosure() runs.
   *
   * Usage in mlsn-progressive-disclosure.js convertMLSNToProgressive():
   *
   *   const muldersResult = window.GilbaMulders
   *       ? window.GilbaMulders.analyse(nutrients, context)
   *       : { flags: {}, summaryBanner: '', nutrientBadges: {} };
   *
   *   // Then pass muldersResult.nutrientBadges into renderMLSNDiagnosticCard()
   *   // and prepend muldersResult.summaryBanner to the cards grid.
   *
   * @param {Array}  nutrients  — array of nutrient objects with .actual values
   * @param {Object} context    — mlsn context object from extractMLSNContext()
   * @returns {{ flags, summaryBanner, nutrientBadges }}
   */
  function analyse(nutrients, context) {
    var methodology = (context && context.methodology) || "mlsn";
    var basis = normaliseToBasis(nutrients, methodology);
    var flags = checkMuldersInteractions(basis, context);

    // ── RECYCLED WATER OVERLAYS ──────────────────────────────────────────
    // Inject irrigation-driven antagonisms from RecycledWaterNutrientEngine
    // These are stored on window.__GAIP_RECYCLED_WATER_OVERLAYS__ by
    // water-progressive-disclosure-WITH-SOIL-INTERACTION.js after each run.
    var rwOverlays = (typeof window !== 'undefined' && window.__GAIP_RECYCLED_WATER_OVERLAYS__) || [];
    rwOverlays.forEach(function(overlay) {
      var sym = overlay.suppressed;
      if (!flags[sym]) flags[sym] = [];
      flags[sym].push({
        suppressor: overlay.suppressor,
        suppressed: sym,
        ratio:      overlay.suppressor + '→' + sym,
        value:      null,
        threshold:  null,
        severity:   overlay.severity,
        message:    overlay.message,
        detail:     null,
        citation:   overlay.citation,
        source:     'recycled-water' // distinguishes from soil ratio flags
      });
    });

    var nutrientBadges = {};
    Object.keys(flags).forEach(function (sym) {
      nutrientBadges[sym] = renderMuldersBadge(flags[sym]);
    });

    return {
      flags: flags,
      summaryBanner: renderMuldersSummaryBanner(flags),
      nutrientBadges: nutrientBadges,
      basis: basis, // exposed for Word export / AI interpretation
    };
  }

  // =========================================================================
  // EXPORT
  // =========================================================================

  global.GilbaMulders = {
    version: "1.1.0",
    analyse: analyse,
    // Expose internals for testing
    normaliseToBasis: normaliseToBasis,
    checkMuldersInteractions: checkMuldersInteractions,
    INTERACTIONS: MULDER_INTERACTIONS,
  };

  console.log("[GilbaMulders] v1.1.0 loaded, " + MULDER_INTERACTIONS.length + " interactions defined");
})(window);
