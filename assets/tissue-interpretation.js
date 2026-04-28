/* =========================================================================
   Gilba Agronomic Hub — Tissue Interpretation (Deterministic)
   Requires: GilbaTissueEngine.compute output
   Version: 0.1
   ========================================================================= */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GilbaTissueInterpretation = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MACROS = ["N","P","K","Ca","Mg","S"];
  var TRACES = ["Fe","Mn","Zn","Cu","B","Na"];

  function bandToAction(element, band){
    if (band === "Deficient") return element + " below sufficiency (primary limitation likely)";
    if (band === "Marginal")  return element + " near lower bound (hidden hunger risk)";
    if (band === "High")      return element + " above upper bound (excess/imbalance risk)";
    if (band === "Sufficient")return element + " within sufficiency";
    return element + " not provided";
  }

  function buildElementNotes(res){
    var notes = [];
    var st = res.status || {};
    MACROS.concat(TRACES).forEach(function(k){
      if (!st[k]) return;
      notes.push({ element: k, band: st[k].band, text: bandToAction(k, st[k].band) });
    });
    return notes;
  }

  function buildSummary(res){
    var limiting = res.limitingNutrients || [];
    var msgs = [];

    if (limiting.length === 0) msgs.push("No clear tissue-limiting nutrients detected from provided values.");
    else msgs.push("Most likely limiting (tissue-based): " + limiting.join(", ") + ".");

    if (res.naFlag) msgs.push(res.naFlag + ".");

    (res.antagonisms || []).forEach(function(f){ msgs.push(f + "."); });
    (res.dilutionFlags || []).forEach(function(f){ msgs.push(f + "."); });

    if (res.stressSignal) msgs.push("Multi-element depression pattern present (root stress/uptake constraint signature).");
    if (res.contextStress && !res.stressSignal) msgs.push("Context indicates stress/PGR; interpret marginal values cautiously (growth suppression can reduce tissue levels).");

    return msgs;
  }

  function buildDecisionBias(res){
    var st = res.status || {};
    var traceLow = 0, macroLow = 0;

    Object.keys(st).forEach(function(k){
      var b = st[k].band;
      if (b !== "Deficient" && b !== "Marginal") return;
      if (k === "Na") return;
      if (TRACES.indexOf(k) >= 0) traceLow++;
      if (MACROS.indexOf(k) >= 0) macroLow++;
    });

    if (res.stressSignal) {
      return [
        "Priority: resolve uptake constraint (water quality, salinity, compaction, root health, irrigation timing).",
        "Avoid aggressive nutrient chasing until uptake normalises."
      ];
    }

    if (traceLow >= 1 && macroLow === 0) {
      return [
        "Correction bias: foliar-first for trace elements (faster plant response).",
        "Re-test tissue after 10–21 days under stable growth."
      ];
    }

    if (macroLow >= 1) {
      return [
        "Correction bias: soil program alignment for macronutrients (base supply) plus targeted foliar where rapid response is required.",
        "Re-test tissue after 14–28 days depending on growth rate."
      ];
    }

    return [
      "No corrective nutrient action indicated by tissue sufficiency alone.",
      "Use soil MLSN to manage reserve and future risk."
    ];
  }

  function interpret(result){
    return {
      headline: "Tissue nutrient sufficiency interpretation",
      elementNotes: buildElementNotes(result),
      summary: buildSummary(result),
      decisionBias: buildDecisionBias(result)
    };
  }

  return { interpret: interpret };
});
