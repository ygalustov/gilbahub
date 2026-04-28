/* =========================================================================
   Gilba Soil-Tissue Integration Engine
   Version: 1.0
   Purpose: Cross-validate soil test results (MLSN or SLAN) with tissue 
            test results to diagnose true deficiency vs. uptake constraint
   Author: Gilba Solutions
   Date: December 2024
   ========================================================================= */

(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GilbaSoilTissueIntegration = factory();
})(typeof self !== "undefined" ? self : this, function() {
  "use strict";

  // Nutrient mapping: soil ppm to tissue %/ppm
  var NUTRIENTS = ["P", "K", "Ca", "Mg", "S", "Fe", "Mn", "Zn", "Cu", "B"];

  /**
   * Cross-validate soil and tissue results for a single nutrient
   * @param {string} nutrient - Element symbol (e.g., "K")
   * @param {object} soilStatus - Soil status from MLSN or SLAN {band, value}
   * @param {object} tissueStatus - Tissue test status {band, value}
   * @param {object} context - Additional context {waterQuality, pH, etc}
   * @returns {object} Diagnostic interpretation
   */
  function diagnoseNutrient(nutrient, soilStatus, tissueStatus, context) {
    context = context || {};
    
    // Handle missing data
    if (!soilStatus || !tissueStatus) {
      return {
        nutrient: nutrient,
        diagnosis: "INSUFFICIENT_DATA",
        interpretation: "Complete both soil and tissue tests for " + nutrient + " diagnosis",
        priority: 4,
        recommendations: ["Obtain missing test data"]
      };
    }

    var soilBand = soilStatus.band || "Missing";
    var tissueBand = tissueStatus.band || "Missing";
    
    // Both adequate - ideal situation
    if ((soilBand === "Adequate" || soilBand === "High") && 
        (tissueBand === "Sufficient" || tissueBand === "High")) {
      return {
        nutrient: nutrient,
        diagnosis: "OPTIMAL",
        interpretation: "Both soil supply and plant uptake are adequate",
        priority: 5,
        action: "MAINTAIN",
        recommendations: ["Continue current fertility program", "Monitor with routine testing"]
      };
    }

    // Low tissue with adequate/high soil = UPTAKE CONSTRAINT
    if ((soilBand === "Adequate" || soilBand === "High") && 
        (tissueBand === "Deficient" || tissueBand === "Marginal")) {
      return diagnoseUptakeConstraint(nutrient, soilStatus, tissueStatus, context);
    }

    // Both low = TRUE DEFICIENCY
    if ((soilBand === "Deficient" || soilBand === "Borderline") && 
        (tissueBand === "Deficient" || tissueBand === "Marginal")) {
      return diagnoseTrueDeficiency(nutrient, soilStatus, tissueStatus, context);
    }

    // Adequate tissue with low soil = RECENT FERTILIZER or SOIL TEST ISSUE
    if ((soilBand === "Deficient" || soilBand === "Borderline") && 
        (tissueBand === "Sufficient" || tissueBand === "High")) {
      return diagnoseRecentFertilization(nutrient, soilStatus, tissueStatus, context);
    }

    // High tissue with low soil = OVER-FERTILIZATION or IMBALANCE
    if ((soilBand === "Deficient" || soilBand === "Borderline") && 
        tissueBand === "High") {
      return diagnoseOverFertilization(nutrient, soilStatus, tissueStatus, context);
    }

    // Both high = EXCESS
    if (soilBand === "High" && tissueBand === "High") {
      return diagnoseExcess(nutrient, soilStatus, tissueStatus, context);
    }

    // Default case - provide basic interpretation
    return {
      nutrient: nutrient,
      diagnosis: "MIXED_STATUS",
      interpretation: "Soil: " + soilBand + ", Tissue: " + tissueBand,
      priority: 3,
      recommendations: ["Review recent fertiliser applications", "Consider re-testing in 30 days"]
    };
  }

  /**
   * Diagnose uptake constraint (adequate soil, low tissue)
   */
  function diagnoseUptakeConstraint(nutrient, soilStatus, tissueStatus, context) {
    var causes = [];
    var recommendations = [];
    var severity = tissueBand === "Deficient" ? "SEVERE" : "MODERATE";

    // General uptake constraint causes
    causes.push("Adequate soil " + nutrient + " but poor plant uptake");
    
    // Nutrient-specific diagnoses
    if (nutrient === "K") {
      if (context.highNa || context.highSalinity) {
        causes.push("High salinity (Na) inhibiting K uptake");
        recommendations.push("Address salinity: improve drainage, leach salts, adjust irrigation water");
      }
      if (context.highCa || context.highMg) {
        causes.push("Cation competition (Ca/Mg) reducing K uptake");
      }
      recommendations.push("Foliar K application (0.5-1.0 kg K/100m²) for immediate relief");
    } else if (nutrient === "P") {
      if (context.highpH || context.pH > 7.5) {
        causes.push("High pH limiting P availability (fixation as Ca-phosphates)");
        recommendations.push("Consider acidifying fertilisers (ammonium sulphate)");
      }
      if (context.lowpH || context.pH < 5.5) {
        causes.push("Low pH fixing P as Fe/Al phosphates");
        recommendations.push("Lime application to raise pH to 6.0-6.5");
      }
      recommendations.push("Foliar P application for rapid response");
    } else if (nutrient === "Fe" || nutrient === "Mn" || nutrient === "Zn") {
      if (context.highpH || context.pH > 7.0) {
        causes.push("High pH reducing " + nutrient + " availability");
        recommendations.push("Foliar application of chelated " + nutrient);
        recommendations.push("Acidifying fertilisers to lower rootzone pH");
      }
      if (context.highP) {
        causes.push("High P interfering with " + nutrient + " uptake");
      }
    }

    // Root health factors (apply to all nutrients)
    causes.push("Possible root health issues:");
    causes.push("• Compaction limiting root exploration");
    causes.push("• Root disease or nematode damage");
    causes.push("• Shallow rooting from drought/heat stress");
    causes.push("• Poor soil aeration");

    // Priority recommendations
    recommendations.unshift("PRIORITY: Investigate root zone health");
    recommendations.push("Core aerification if compaction present");
    recommendations.push("Review irrigation water quality (check ECw, SAR, Na)");
    recommendations.push("Check for root pathogens or nematodes");
    recommendations.push("AVOID: Adding more soil " + nutrient + " (won't fix uptake problem)");
    recommendations.push("Re-test: Tissue in 14 days, Soil in 30 days");

    return {
      nutrient: nutrient,
      diagnosis: "UPTAKE_CONSTRAINT",
      severity: severity,
      interpretation: causes.join("; "),
      priority: 1,
      action: "FIX_UPTAKE_FIRST",
      soilValue: soilStatus.value,
      tissueValue: tissueStatus.value,
      recommendations: recommendations
    };
  }

  /**
   * Diagnose true deficiency (low soil, low tissue)
   */
  function diagnoseTrueDeficiency(nutrient, soilStatus, tissueStatus, context) {
    var recommendations = [];
    var severity = (soilStatus.band === "Deficient" && tissueStatus.band === "Deficient") ? "SEVERE" : "MODERATE";

    recommendations.push("Confirmed " + nutrient + " deficiency (both soil and plant low)");
    recommendations.push("IMMEDIATE: Foliar application for rapid plant response");
    recommendations.push("SHORT-TERM: Soluble fertiliser for quick soil correction");
    recommendations.push("LONG-TERM: Soil amendment to build reserve levels");

    // Nutrient-specific recommendations
    if (nutrient === "K") {
      recommendations.push("Apply potassium sulphate (0-0-50): 150-300 kg/ha");
      recommendations.push("Foliar K (potassium acetate or nitrate): 0.5-1.0 kg K/100m²");
    } else if (nutrient === "P") {
      recommendations.push("Apply monoammonium phosphate (MAP): 100-200 kg/ha");
      recommendations.push("Foliar P (phosphoric acid): 0.3-0.5 kg P/100m²");
    } else if (nutrient === "Ca") {
      // Use integrated Ca amendment decision engine
      var caDecision = (typeof selectCaAmendment === 'function')
        ? selectCaAmendment(
            context.soil || {},
            context.mgDecision || {},
            context.waterQuality || {},
            { deficitKgHa: soilStatus.deficitKgHa || 0, ratioVsMLSN: soilStatus.ratioVsMLSN || 0.5 }
          )
        : null;
      if (caDecision) {
        recommendations.push("Ca amendment: " + caDecision.primaryProduct.name +
          " — " + (caDecision.primaryProduct.rate || '500-1000 kg/ha'));
        recommendations.push("Rationale: " + caDecision.reasoning);
        if (caDecision.alternativeProduct) {
          recommendations.push("Alternative: " + caDecision.alternativeProduct.name +
            (caDecision.alternativeProduct.notes ? ' — ' + caDecision.alternativeProduct.notes : ''));
        }
        caDecision.rationale.forEach(function(r) { recommendations.push(r); });
      } else {
        // Fallback if engine not loaded
        var soilPH = context.soil ? (context.soil.pH_cacl2 || context.soil.pH_water || 0) : 0;
        if (soilPH > 7.5) {
          recommendations.push("Apply gypsum (calcium sulphate): 500-1000 kg/ha — lime contraindicated at pH " + soilPH.toFixed(1));
        } else if (soilPH > 0 && soilPH < 6.0) {
          recommendations.push("Apply calcitic lime — corrects Ca deficit and low pH simultaneously");
          recommendations.push("Calcitic lime preferred over dolomite when Mg is adequate");
        } else {
          recommendations.push("Apply gypsum (calcium sulphate): 500-1000 kg/ha");
          recommendations.push("Consider calcitic lime if slight pH lift acceptable");
        }
      }
    } else if (nutrient === "Mg") {
      // Use integrated Mg amendment decision engine (Gilba Mg decision chart)
      var mgDecision = (typeof selectMgAmendment === 'function')
        ? selectMgAmendment(
            context.soil || {},
            context.weather || {},
            { deficitKgHa: soilStatus.deficitKgHa || 0, ratioVsMLSN: soilStatus.ratioVsMLSN || 0.5 },
            context
          )
        : null;
      if (mgDecision) {
        recommendations.push("Mg amendment pathway: " + mgDecision.pathway.replace(/_/g, ' '));
        recommendations.push("Primary product: " + mgDecision.primaryProduct.name +
          " (" + (mgDecision.primaryProduct.analysis || '') + ")");
        recommendations.push("Rate: " + (mgDecision.primaryProduct.rate || '100-200 kg/ha'));
        recommendations.push("Rationale: " + mgDecision.reasoning);
        if (mgDecision.limeRequired) {
          recommendations.push("⚠ Lime also required — pH correction needed alongside Mg amendment");
        }
        if (mgDecision.foliarBridge) {
          recommendations.push("Foliar bridge: " + mgDecision.foliarBridge);
        }
        mgDecision.modifyingFactors.forEach(function(f) {
          recommendations.push("⚠ Modifying factor: " + f);
        });
        if (mgDecision.alternativeProduct) {
          recommendations.push("Alternative: " + mgDecision.alternativeProduct.name +
            (mgDecision.alternativeProduct.notes ? ' — ' + mgDecision.alternativeProduct.notes : ''));
        }
        // Store decision on context for Ca engine to use (avoids double-recommending dolomite)
        context.mgDecision = mgDecision;
      } else {
        // Fallback if engine not loaded
        var soilPH_mg = context.soil ? (context.soil.pH_cacl2 || context.soil.pH_water || 0) : 0;
        if (soilPH_mg >= 7.5) {
          recommendations.push("Apply kieserite (MgSO₄·H₂O, 16% Mg): 100-200 kg/ha — dolomite contraindicated at high pH");
        } else if (soilPH_mg > 0 && soilPH_mg < 6.0) {
          recommendations.push("Apply dolomite: addresses Mg deficit and low pH simultaneously");
          recommendations.push("Foliar MgSO₄ 2-3 kg/100L as bridge while dolomite reacts");
        } else {
          recommendations.push("Apply kieserite (MgSO₄·H₂O, 16% Mg): 100-200 kg/ha");
          recommendations.push("Foliar MgSO₄ 2 kg/100L for rapid response");
        }
      }
    } else if (nutrient === "S") {
      recommendations.push("Apply ammonium sulphate: 100-200 kg/ha (provides N+S)");
      recommendations.push("Or potassium sulphate if N not needed");
    } else if (nutrient === "Fe" || nutrient === "Mn" || nutrient === "Zn" || nutrient === "Cu") {
      recommendations.push("Foliar chelated " + nutrient + " (EDTA or EDDHA form)");
      recommendations.push("Soil application less effective (esp. if pH > 7.0)");
    }

    recommendations.push("Monitor response: Tissue test in 21-28 days");
    recommendations.push("Soil re-test in 60 days to verify reserve buildup");

    return {
      nutrient: nutrient,
      diagnosis: "TRUE_DEFICIENCY",
      severity: severity,
      interpretation: "Confirmed deficiency - both soil reserve and plant tissue are low",
      priority: 1,
      action: "IMMEDIATE_CORRECTION",
      soilValue: soilStatus.value,
      tissueValue: tissueStatus.value,
      recommendations: recommendations
    };
  }

  /**
   * Diagnose recent fertilization (low soil, adequate tissue)
   */
  function diagnoseRecentFertilization(nutrient, soilStatus, tissueStatus, context) {
    return {
      nutrient: nutrient,
      diagnosis: "RECENT_FERTILIZATION",
      interpretation: "Low soil " + nutrient + " but adequate plant tissue - likely recent fertiliser application not yet reflected in soil test, or soil test method doesn't capture plant-available pool",
      priority: 3,
      action: "MONITOR",
      soilValue: soilStatus.value,
      tissueValue: tissueStatus.value,
      recommendations: [
        "Plant tissue shows adequate " + nutrient + " status",
        "Recent fertiliser likely meeting plant demand",
        "Continue current fertility program",
        "Re-test soil in 30 days to confirm reserve buildup",
        "If soil remains low, consider MLSN threshold recalibration",
        "Or switch to tissue-guided fertility (less soil-dependent)"
      ]
    };
  }

  /**
   * Diagnose over-fertilization
   */
  function diagnoseOverFertilization(nutrient, soilStatus, tissueStatus, context) {
    var warnings = [];
    
    if (nutrient === "N") {
      warnings.push("Excess N reduces carbohydrate reserves");
      warnings.push("Increases disease susceptibility (Pythium, leaf spot)");
      warnings.push("Reduces heat/drought tolerance");
      warnings.push("Increases thatch production");
    } else if (nutrient === "K") {
      warnings.push("Excess K can induce Mg deficiency (cation competition)");
    } else if (nutrient === "P") {
      warnings.push("Excess P can induce Fe, Zn deficiency");
      warnings.push("Environmental concern (runoff)");
    }

    return {
      nutrient: nutrient,
      diagnosis: "OVER_FERTILIZATION",
      interpretation: "High tissue " + nutrient + " despite low soil - indicates recent heavy fertilization or luxury consumption",
      priority: 2,
      action: "REDUCE_INPUTS",
      soilValue: soilStatus.value,
      tissueValue: tissueStatus.value,
      warnings: warnings,
      recommendations: [
        "Reduce or eliminate " + nutrient + " applications temporarily",
        "Allow plant to utilize excess tissue " + nutrient,
        "Monitor for induced deficiencies of other nutrients",
        "Re-test tissue in 30 days to verify reduction",
        "Resume balanced fertility once tissue normalizes"
      ]
    };
  }

  /**
   * Diagnose excess (both soil and tissue high)
   */
  function diagnoseExcess(nutrient, soilStatus, tissueStatus, context) {
    return {
      nutrient: nutrient,
      diagnosis: "EXCESS",
      interpretation: "Both soil and tissue " + nutrient + " are excessive - high risk of toxicity or induced deficiencies",
      priority: 2,
      action: "CEASE_INPUTS",
      soilValue: soilStatus.value,
      tissueValue: tissueStatus.value,
      recommendations: [
        "STOP all " + nutrient + " applications immediately",
        "Monitor for toxicity symptoms",
        "Check for induced deficiencies of antagonistic nutrients",
        "Heavy irrigation may help leach excess (if drainage adequate)",
        "For extreme cases, consider rootzone modification",
        "Re-test in 60 days minimum before resuming " + nutrient + " inputs"
      ]
    };
  }

  /**
   * Generate integrated soil-tissue analysis report
   * @param {object} mlsnResults - MLSN analysis results
   * @param {object} tissueResults - Tissue test results
   * @param {object} soilData - Raw soil data (pH, ECw, etc)
   * @returns {object} Integrated diagnostic report
   */
  function integrateAnalysis(mlsnResults, tissueResults, soilData) {
    if (!mlsnResults || !tissueResults) {
      return {
        success: false,
        error: "Both MLSN and tissue test results required"
      };
    }

    var diagnostics = [];
    var context = {
      pH: soilData.pH_water || null,
      highpH: soilData.pH_water > 7.5,
      lowpH: soilData.pH_water < 5.5,
      highSalinity: soilData.ecw > 2.0,
      highNa: soilData.Na_ppm > 100,
      highP: mlsnResults.P && mlsnResults.P.band === "High",
      highCa: mlsnResults.Ca && mlsnResults.Ca.band === "High",
      highMg: mlsnResults.Mg && mlsnResults.Mg.band === "High"
    };

    // Diagnose each nutrient
    NUTRIENTS.forEach(function(nutrient) {
      var soilStatus = mlsnResults[nutrient];
      var tissueStatus = tissueResults.status && tissueResults.status[nutrient];
      
      if (soilStatus || tissueStatus) {
        var diagnosis = diagnoseNutrient(nutrient, soilStatus, tissueStatus, context);
        diagnostics.push(diagnosis);
      }
    });

    // Sort by priority (1 = highest priority)
    diagnostics.sort(function(a, b) {
      return a.priority - b.priority;
    });

    // Generate summary
    var critical = diagnostics.filter(function(d) { return d.priority === 1; });
    var attention = diagnostics.filter(function(d) { return d.priority === 2; });
    
    return {
      success: true,
      diagnostics: diagnostics,
      summary: {
        critical: critical.length,
        needsAttention: attention.length,
        optimal: diagnostics.filter(function(d) { return d.diagnosis === "OPTIMAL"; }).length
      },
      priorityActions: critical.map(function(d) {
        return d.nutrient + ": " + d.action;
      })
    };
  }

  // =========================================================================
  //  AMENDMENT PRODUCT DECISION ENGINES
  //  Implements Gilba Mg Decision Chart + integrated Ca logic
  //  Author: Gilba Solutions — March 2026
  // =========================================================================

  /**
   * selectMgAmendment — routes through Gilba Mg decision chart
   * Pathways: HIGH_PH_INDUCED | LOW_CEC_SAND | LOW_PH_AL_MG_ANTAGONISM | HIGH_OM | GENERAL
   */
  function selectMgAmendment(soil, weather, mgStatus, context) {
    soil     = soil     || {};
    weather  = weather  || {};
    mgStatus = mgStatus || {};
    context  = context  || {};

    var pH        = soil.pH_cacl2 || soil.pH_water || 0;
    var cec       = soil.CEC || 0;
    var loi       = soil.LOI || soil.OM_pct || 0;
    var construct = (soil.construction || '').toLowerCase();
    var kPpm      = soil.K_ppm || (soil.ppm && soil.ppm.K)  || 0;
    var mgPpm     = soil.Mg_ppm || (soil.ppm && soil.ppm.Mg) || 0;
    var rainfall  = weather.annualRainfall_mm || 0;
    var soilTemp  = context.soilTemp_C || weather.avgTemp_C || 15;
    var deficit   = mgStatus.deficitKgHa || 0;
    var nForm     = (context.nForm || '').toLowerCase();

    var rationale = [];
    var primaryProduct, altProduct, limeRequired, urgency, foliarBridge;

    // --- Modifying factors (bottom panel of chart) ---
    var modifyingFactors = [];
    var kMgRatio = mgPpm > 0 ? kPpm / mgPpm : 0;
    if (kMgRatio > 0.3) {
      modifyingFactors.push('Excess K (K:Mg ' + kMgRatio.toFixed(2) +
        ') — K-Mg antagonism suppressing uptake; reduce K inputs alongside Mg correction');
    }
    if (nForm.includes('urea') || nForm.includes('ammonium') || nForm.includes('nh4') || nForm.includes('sulphate')) {
      modifyingFactors.push('N as urea/ammonium — rhizosphere acidification reduces Mg uptake; ' +
        'consider nitrate-N to reduce cation competition');
    }
    if (rainfall > 800 || (construct.includes('sand') && rainfall > 600)) {
      modifyingFactors.push('High rainfall (' + (rainfall || 'high') + ' mm/yr) — Mg leaching risk; split applications required');
    }
    if (soilTemp < 12) {
      modifyingFactors.push('Low soil temp (' + soilTemp.toFixed(1) +
        '°C) — Mg uptake reduced <12°C; soluble kieserite/Epsom more available than dolomite');
    }

    // --- High pH / calcareous (chart left branch: MgSO4 only) ---
    var isHighPH      = pH >= 7.5;
    var isCalcareous  = pH >= 7.8 || construct.includes('calcareous') || construct.includes('limestone');
    if (isHighPH || isCalcareous) {
      limeRequired = false;
      primaryProduct = {
        name: 'Kieserite (MgSO₄·H₂O)', analysis: '16% Mg, 22% S',
        solubility: '67,890 mg/L', saltIndex: 39, pHEffect: 'None',
        rate: deficit > 0 ? (deficit / 0.16).toFixed(0) + ' kg/ha kieserite to supply ' + deficit.toFixed(0) + ' kg Mg/ha'
                          : '100–200 kg/ha maintenance',
        notes: 'Dolomite/MgCO₃ contraindicated — further alkalises already-high pH'
      };
      altProduct = {
        name: 'Epsom Salts (MgSO₄·7H₂O)', analysis: '10% Mg, 13% S', solubility: '104,200 mg/L',
        notes: 'Faster than kieserite; higher salt index (44) — lower rates or foliar only'
      };
      rationale.push('High pH (' + pH.toFixed(1) + '): Ca-Mg antagonism induced; MgSO₄ only');
      rationale.push('Dolomite contraindicated — raises pH further, worsens Ca-Mg displacement at high pH');
      if (isCalcareous) rationale.push('Calcareous rootzone — carbonate Mg products ineffective');
      foliarBridge = 'Foliar MgSO₄ 2–4 kg/100L — rapid correction while soil kieserite reacts';
      urgency = deficit > 20 ? 'IMMEDIATE' : 'SHORT-TERM';
      return {
        pathway: 'HIGH_PH_INDUCED', primaryProduct: primaryProduct, alternativeProduct: altProduct,
        limeRequired: false, urgency: urgency, foliarBridge: foliarBridge,
        modifyingFactors: modifyingFactors, rationale: rationale,
        reasoning: 'High pH / excessive liming induced Ca-Mg antagonism. MgSO₄ only — carbonate forms contraindicated.'
      };
    }

    // --- Non-calcareous soils ---
    var isSandRootzone = construct.includes('sand') || construct.includes('usga') ||
                         construct.includes('push') || cec < 5;
    var isLowCECSand   = isSandRootzone || cec < 5;
    var isLowPH        = pH > 0 && pH < 5.8;
    var isSlightLowPH  = pH >= 5.8 && pH < 6.2;
    var isHighOM       = loi > 4.0;

    limeRequired = pH > 0 && pH < 6.0;

    // --- High OM checked FIRST (parallel branch in chart — OM mechanism differs from Al antagonism) ---
    // High OM at low pH routes to OM branch (kieserite + separate lime), not Al-Mg branch
    if (isHighOM) {
      rationale.push('High organic matter (' + loi.toFixed(1) + '% LOI) — Mg bound to OM exchange sites; availability pH and cation-competition dependent');
      if (!limeRequired) {
        primaryProduct = {
          name: 'Dolomite (MgCO₃·CaCO₃)', analysis: '12% Mg, 14–32% Ca',
          pHEffect: 'Slight increase', saltIndex: 0.8,
          rate: deficit > 0 ? (deficit / 0.12).toFixed(0) + ' kg/ha dolomite' : '500–1000 kg/ha soil amendment',
          notes: 'High-OM buffered soil — dolomite slow sustained release appropriate; reacts well in high-buffer environment'
        };
        altProduct = { name: 'Kieserite (MgSO₄·H₂O)', analysis: '16% Mg, 22% S',
          notes: 'For faster response or if K:Mg antagonism present (sulphate avoids pH increase)' };
        rationale.push('pH adequate: dolomite suits high-OM high-buffer soil');
        foliarBridge = 'Foliar MgSO₄ 2 kg/100L if visual chlorosis present';
        urgency = 'SHORT-TERM';
      } else {
        primaryProduct = {
          name: 'Kieserite (MgSO₄·H₂O)', analysis: '16% Mg, 22% S',
          pHEffect: 'None',
          rate: deficit > 0 ? (deficit / 0.16).toFixed(0) + ' kg/ha kieserite + separate calcitic lime for pH'
                            : '100–200 kg/ha kieserite + calcitic lime separately',
          notes: 'Separate products in high-OM acidic soil — avoids dolomite over-supplying Ca in high-Ca exchangeable system'
        };
        altProduct = { name: 'Calcitic lime + Epsom Salts',
          notes: 'Calcitic lime for pH; Epsom salts for rapid Mg — both faster-acting than dolomite' };
        rationale.push('High OM + low pH: separate kieserite + calcitic lime preferred over dolomite');
        rationale.push('Dolomite in high-OM acid soil risks excess Ca on exchange sites');
        foliarBridge = 'Foliar MgSO₄ 2–3 kg/100L while soil products react';
        urgency = 'SHORT-TERM';
      }
      return {
        pathway: 'HIGH_OM', primaryProduct: primaryProduct, alternativeProduct: altProduct,
        limeRequired: limeRequired, urgency: urgency, foliarBridge: foliarBridge,
        modifyingFactors: modifyingFactors, rationale: rationale,
        reasoning: 'High OM soil Mg deficiency — Mg availability pH and cation-competition dependent.'
      };
    }

    // --- Low CEC sand (chart centre-left) ---
    if (isLowCECSand && !isLowPH) {
      rationale.push('Low CEC sand rootzone (CEC ' + (cec > 0 ? cec.toFixed(1) : '<5') + ' meq/100g)');
      rationale.push('Low nutrient retention — soluble Mg forms most reliable');
      if (!limeRequired) {
        primaryProduct = {
          name: 'Kieserite (MgSO₄·H₂O)', analysis: '16% Mg, 22% S',
          pHEffect: 'None',
          rate: deficit > 0 ? (deficit / 0.16).toFixed(0) + ' kg/ha kieserite — split into 2–3 applications (leaching risk)'
                            : '100–150 kg/ha — light splits in sand rootzone',
          notes: 'MgSO₄ preferred in sand — no pH effect, rapid availability, consistent supply'
        };
        altProduct = { name: 'Epsom Salts (MgSO₄·7H₂O)', analysis: '10% Mg, 13% S',
          notes: 'Higher solubility; useful for fertigation or foliar supplementation' };
        rationale.push('pH adequate (' + pH.toFixed(1) + '): no lime required');
        foliarBridge = 'Foliar MgSO₄ 2 kg/100L as bridge; soil kieserite for reserve building';
        urgency = deficit > 15 ? 'IMMEDIATE' : 'SHORT-TERM';
      } else {
        primaryProduct = {
          name: 'Dolomite (MgCO₃·CaCO₃)', analysis: '12% Mg, 14–32% Ca',
          solubility: '9.8 mg/L', saltIndex: 0.8, pHEffect: 'Increases pH',
          rate: deficit > 0 ? (deficit / 0.12).toFixed(0) + ' kg/ha dolomite + pH correction benefit'
                            : '500–1000 kg/ha for combined Mg + pH correction',
          notes: 'Addresses Mg deficit and low pH simultaneously'
        };
        altProduct = { name: 'Kieserite (MgSO₄·H₂O)', analysis: '16% Mg, 22% S',
          notes: 'Use if faster Mg response needed alongside separate calcitic lime' };
        rationale.push('pH low (' + pH.toFixed(1) + '): lime needed — dolomite corrects Mg and pH together');
        foliarBridge = 'Foliar MgSO₄ 2 kg/100L while dolomite reacts (4–8 weeks)';
        urgency = 'SHORT-TERM';
      }
      return {
        pathway: 'LOW_CEC_SAND', primaryProduct: primaryProduct, alternativeProduct: altProduct,
        limeRequired: limeRequired, urgency: urgency, foliarBridge: foliarBridge,
        modifyingFactors: modifyingFactors, rationale: rationale,
        reasoning: 'Low CEC sand rootzone — Mg leaches readily; soluble MgSO₄ preferred.'
          + (limeRequired ? ' pH correction also needed — dolomite covers both.' : '')
      };
    }

    // --- Low pH / Al-Mg antagonism (chart centre) ---
    if (isLowPH || (isSlightLowPH && mgPpm < 60)) {
      rationale.push('Low pH (' + pH.toFixed(1) + '): Al³⁺/Fe³⁺ mobilised — Al-Mg antagonism suppresses Mg uptake');
      rationale.push('Root Al toxicity limits Mg absorption regardless of soil Mg reserve');
      if (!limeRequired) {
        primaryProduct = {
          name: 'Kieserite (MgSO₄·H₂O)', analysis: '16% Mg, 22% S', pHEffect: 'None',
          rate: deficit > 0 ? (deficit / 0.16).toFixed(0) + ' kg/ha' : '100–200 kg/ha',
          notes: 'Al antagonism: prioritise foliar — root uptake impaired until pH corrected'
        };
        altProduct = { name: 'Kieserite/Dolomite blend', notes: 'If slight pH lift acceptable for species' };
        rationale.push('Species pH tolerance allows acid conditions — MgSO₄ without lime');
        foliarBridge = 'PRIORITY: Foliar MgSO₄ 3–4 kg/100L; soil application secondary until Al corrected';
        urgency = 'IMMEDIATE';
      } else {
        primaryProduct = {
          name: 'Dolomite (MgCO₃·CaCO₃)', analysis: '12% Mg, 14–32% Ca', pHEffect: 'Increases pH',
          rate: deficit > 0 ? (deficit / 0.12).toFixed(0) + ' kg/ha dolomite (target pH 6.0–6.5 to neutralise Al toxicity)'
                            : '1,000–2,000 kg/ha to correct pH from ' + pH.toFixed(1) + ' to 6.2',
          notes: 'Raising pH is the primary intervention — neutralises Al³⁺, restores root function, delivers Mg'
        };
        altProduct = {
          name: 'Calcitic lime + Kieserite (split)',
          notes: 'Calcitic lime for faster pH correction; kieserite for immediate available Mg'
        };
        rationale.push('Al-Mg antagonism: raising pH is the primary fix');
        rationale.push('Dolomite corrects pH, Al toxicity AND Mg deficit in one product');
        foliarBridge = 'PRIORITY: Foliar MgSO₄ 3–4 kg/100L while dolomite corrects pH (6–8 weeks)';
        urgency = 'IMMEDIATE';
      }
      return {
        pathway: 'LOW_PH_AL_MG_ANTAGONISM', primaryProduct: primaryProduct, alternativeProduct: altProduct,
        limeRequired: limeRequired, urgency: urgency, foliarBridge: foliarBridge,
        modifyingFactors: modifyingFactors, rationale: rationale,
        reasoning: 'Al-Mg antagonism — raising pH is primary intervention. Dolomite corrects pH, Al toxicity, and Mg simultaneously.'
      };
    }

    // --- Fallback: general ---
    rationale.push('General Mg deficiency — pH ' + (pH > 0 ? pH.toFixed(1) : 'unknown') +
      ', CEC ' + (cec > 0 ? cec.toFixed(1) : 'unknown') + ' meq/100g');
    limeRequired = pH > 0 && pH < 6.0;
    if (limeRequired) {
      primaryProduct = { name: 'Dolomite (MgCO₃·CaCO₃)', analysis: '12% Mg, 14–32% Ca', pHEffect: 'Increases pH',
        rate: deficit > 0 ? (deficit / 0.12).toFixed(0) + ' kg/ha dolomite' : '500–1000 kg/ha' };
      altProduct = { name: 'Kieserite', notes: 'Use if faster Mg correction needed alongside separate lime' };
    } else {
      primaryProduct = { name: 'Kieserite (MgSO₄·H₂O)', analysis: '16% Mg, 22% S', pHEffect: 'None',
        rate: deficit > 0 ? (deficit / 0.16).toFixed(0) + ' kg/ha kieserite' : '100–200 kg/ha' };
      altProduct = { name: 'Epsom Salts', notes: 'Higher solubility; use as foliar or fertigation' };
    }
    foliarBridge = 'Foliar MgSO₄ 2 kg/100L for rapid response';
    urgency = deficit > 20 ? 'IMMEDIATE' : 'SHORT-TERM';
    return {
      pathway: 'GENERAL', primaryProduct: primaryProduct, alternativeProduct: altProduct,
      limeRequired: limeRequired, urgency: urgency, foliarBridge: foliarBridge,
      modifyingFactors: modifyingFactors, rationale: rationale,
      reasoning: 'General Mg deficiency — MgSO₄/dolomite selection based on pH correction need.'
    };
  }

  /**
   * selectCaAmendment — Ca product decision engine
   * pH-aware: gypsum vs calcitic lime vs dolomite (avoids double-recommending
   * dolomite when already prescribed for Mg)
   */
  function selectCaAmendment(soil, mgDecision, waterQuality, caStatus) {
    soil         = soil         || {};
    mgDecision   = mgDecision   || {};
    waterQuality = waterQuality || {};
    caStatus     = caStatus     || {};

    var pH      = soil.pH_cacl2 || soil.pH_water || 0;
    var naPpm   = soil.Na_ppm   || (soil.ppm && soil.ppm.Na) || 0;
    var so4W    = waterQuality.SO4 || 0;
    var deficit = caStatus.deficitKgHa || 0;
    var rationale = [];

    var isLowPH  = pH > 0 && pH < 6.0;
    var isHighPH = pH >= 7.5;
    var isSodic  = naPpm > 200 || soil.ESP > 6;
    var mgUsingDolomite = mgDecision.primaryProduct &&
      (mgDecision.primaryProduct.name || '').toLowerCase().includes('dolomite');

    var primaryProduct, altProduct, reasoning;

    if (isHighPH) {
      primaryProduct = {
        name: 'Gypsum (CaSO₄·2H₂O)', analysis: '23% Ca, 18% S', pHEffect: 'None',
        rate: deficit > 0 ? (deficit / 0.23).toFixed(0) + ' kg/ha gypsum' : '500–1000 kg/ha',
        notes: 'Lime contraindicated at pH ' + (pH > 0 ? pH.toFixed(1) : '>7.5')
      };
      altProduct = { name: 'Calcium chloride (CaCl₂)', notes: 'Faster; higher salt index — lower rates or foliar' };
      rationale.push('High pH: lime contraindicated — gypsum only');
      reasoning = 'High pH: calcium sulphate (gypsum) provides Ca without raising pH further.';

    } else if (isLowPH) {
      if (mgUsingDolomite) {
        primaryProduct = {
          name: 'Dolomite (co-supplies Ca via Mg application)', analysis: '14–32% Ca, 12% Mg',
          pHEffect: 'Increases pH',
          rate: 'Ca supplied as co-product of Mg dolomite application — review rate for Ca adequacy',
          notes: 'Additional calcitic lime only if Ca deficit exceeds dolomite Ca supply'
        };
        altProduct = { name: 'Calcitic lime (supplemental)', notes: 'Only if Ca deficit large; avoid over-liming' };
        rationale.push('Mg dolomite co-supplies Ca at 14–32% Ca — check before adding separate lime');
        reasoning = 'Low pH: Mg dolomite co-supplies Ca. Verify dolomite Ca delivery before separate lime.';
      } else {
        primaryProduct = {
          name: 'Calcitic lime (CaCO₃)', analysis: '38–40% Ca', pHEffect: 'Increases pH to target',
          rate: deficit > 0 ? (deficit / 0.38).toFixed(0) + ' kg/ha calcitic lime' : 'Calculate by buffer pH — target pH 6.0–6.5',
          notes: 'Calcitic lime preferred over dolomite for Ca alone when Mg is adequate'
        };
        altProduct = { name: 'Gypsum', notes: 'Use if pH correction not desired for species' };
        rationale.push('Low pH + Ca deficit: calcitic lime corrects both — dolomite avoided as Mg adequate');
        reasoning = 'Low pH Ca deficiency: calcitic lime corrects Ca and pH. Dolomite avoided — Mg adequate.';
      }

    } else if (isSodic) {
      primaryProduct = {
        name: 'Gypsum (CaSO₄·2H₂O)', analysis: '23% Ca, 18% S', pHEffect: 'None',
        rate: deficit > 0
          ? (deficit / 0.23).toFixed(0) + ' kg/ha minimum; sodicity reclamation may need 2–5 t/ha'
          : '1–3 t/ha for sodicity reclamation',
        notes: 'Ca²⁺ displaces Na⁺ from exchange sites; SO₄²⁻ leaches Na as Na₂SO₄ — increase leaching fraction'
      };
      altProduct = { name: 'Calcium chloride', notes: 'Faster Na displacement; no SO₄' };
      rationale.push('Sodic soil (Na ' + naPpm.toFixed(0) + ' ppm): gypsum corrects Ca AND displaces Na');
      reasoning = 'Sodic soil: gypsum priority — Ca displaces Na from exchange sites. Leaching essential.';

    } else {
      if (so4W > 200) {
        primaryProduct = {
          name: 'Calcitic lime (CaCO₃)', analysis: '38–40% Ca', pHEffect: 'Slight increase — monitor pH',
          rate: deficit > 0 ? (deficit / 0.38).toFixed(0) + ' kg/ha calcitic lime' : '500–800 kg/ha',
          notes: 'High SO₄ irrigation water (' + so4W.toFixed(0) + ' mg/L) — avoid additional sulphate from gypsum'
        };
        altProduct = { name: 'Gypsum', notes: 'Use only if total SO₄ loading is acceptable' };
        rationale.push('High SO₄ water (' + so4W.toFixed(0) + ' mg/L): calcitic lime avoids excess sulphate loading');
        reasoning = 'Adequate pH Ca deficiency with high-SO₄ water: calcitic lime avoids sulphate overload.';
      } else {
        primaryProduct = {
          name: 'Gypsum (CaSO₄·2H₂O)', analysis: '23% Ca, 18% S', pHEffect: 'None',
          rate: deficit > 0 ? (deficit / 0.23).toFixed(0) + ' kg/ha gypsum' : '500–1000 kg/ha',
          notes: 'Adequate pH: gypsum preferred — Ca without pH disturbance; S benefit for soil structure'
        };
        altProduct = { name: 'Calcitic lime', notes: 'Use if slight pH lift acceptable or Ca deficit is large' };
        rationale.push('Adequate pH (' + (pH > 0 ? pH.toFixed(1) : 'OK') + '): gypsum — Ca without pH change');
        reasoning = 'Adequate pH Ca deficiency: gypsum provides Ca without pH disturbance.';
      }
    }

    return { primaryProduct: primaryProduct, alternativeProduct: altProduct, rationale: rationale, reasoning: reasoning };
  }

  /**
   * recommendSoilAmendments — master coordinator
   * Returns integrated Ca + Mg amendment plan, with cross-product interaction warnings
   */
  function recommendSoilAmendments(soilState, mlsnResults, waterQuality, weather, context) {
    var results = { Ca: null, Mg: null, interactions: [], summary: [] };

    var mgStatus = {}, caStatus = {};
    if (mlsnResults && mlsnResults.nutrients) {
      mlsnResults.nutrients.forEach(function(n) {
        if (n.nutrient === 'Mg') mgStatus = { deficitKgHa: n.deficitKgHa || 0, ratioVsMLSN: n.ratioVsMLSN || 1 };
        if (n.nutrient === 'Ca') caStatus = { deficitKgHa: n.deficitKgHa || 0, ratioVsMLSN: n.ratioVsMLSN || 1 };
      });
    }

    var mgDeficient = mgStatus.ratioVsMLSN !== undefined ? mgStatus.ratioVsMLSN < 1.0 : false;
    var caDeficient = caStatus.ratioVsMLSN !== undefined ? caStatus.ratioVsMLSN < 1.0 : false;

    if (mgDeficient) {
      results.Mg = selectMgAmendment(soilState, weather, mgStatus, context);
    }
    if (caDeficient) {
      results.Ca = selectCaAmendment(soilState, results.Mg || {}, waterQuality, caStatus);
    }

    // Cross-product interaction warnings
    if (mgDeficient && caDeficient) {
      if (results.Mg && results.Mg.primaryProduct &&
          results.Mg.primaryProduct.name.toLowerCase().includes('dolomite')) {
        results.interactions.push(
          'Both Ca and Mg deficient — dolomite addresses both simultaneously. ' +
          'Review Ca supply from dolomite rate before adding separate gypsum/lime.'
        );
      } else if (results.Mg && results.Mg.primaryProduct &&
                 results.Mg.primaryProduct.name.toLowerCase().includes('kieserite')) {
        var pH = soilState.pH_cacl2 || soilState.pH_water || 0;
        results.interactions.push(pH < 6.0
          ? 'Both Ca and Mg deficient with low pH: calcitic lime (Ca + pH) + kieserite (Mg, no pH change). Apply lime first, retest 8 weeks, then assess residual Mg need.'
          : 'Both Ca and Mg deficient at adequate pH: gypsum (Ca) + kieserite (Mg) — compatible, no pH conflict.'
        );
      }
    }
    if (mgDeficient && results.Mg && results.Mg.limeRequired && !caDeficient) {
      results.interactions.push(
        'Lime required for Mg pathway — lime will also build Ca reserve. Check Ca status before choosing dolomite vs calcitic lime.'
      );
    }

    return results;
  }

  return {
    diagnoseNutrient: diagnoseNutrient,
    integrateAnalysis: integrateAnalysis,
    selectMgAmendment: selectMgAmendment,
    selectCaAmendment: selectCaAmendment,
    recommendSoilAmendments: recommendSoilAmendments
  };
});
