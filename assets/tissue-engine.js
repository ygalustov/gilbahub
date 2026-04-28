/* =========================================================================
   Gilba Agronomic Hub — Tissue Testing Engine (DOM-free)
   Version: 0.2
   Purpose: classify tissue values against turf sufficiency ranges + flags
   
   Tissue ranges from wet chemistry analysis:
   - Bentgrass (C3 greens)
   - Couch/Bermuda (C4 - Tifgreen reference)
   - Perennial Ryegrass (C3 sports)
   ========================================================================= */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GilbaTissueEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // -----------------------------
  // RANGES (DW basis) - Wet Chemistry Tissue Test Ranges
  // -----------------------------
  // Macros are % dry weight
  // Traces are mg/kg (ppm)
  // L = Deficient, M = Sufficient, H = High/Excess
  
  var RANGES = {
    // Bentgrass - for C3 greens (creeping bent, velvet bent)
    bentgrass: {
      macros: {
        N:  { lo: 4.00, hi: 5.00 },   // L: <4, M: 4.00-5.00, H: >5
        P:  { lo: 0.30, hi: 0.60 },   // L: <0.3, M: 0.30-0.60, H: >0.60
        K:  { lo: 2.20, hi: 3.50 },   // L: <2.2, M: 2.20-3.50, H: >3.50
        Ca: { lo: 0.25, hi: 0.75 },   // L: <0.25, M: 0.25-0.75, H: >0.75
        Mg: { lo: 0.20, hi: 0.40 },   // L: <0.2, M: 0.20-0.40, H: >0.40
        S:  { lo: 0.25, hi: 0.75 }    // L: <0.25, M: 0.25-0.75, H: >0.75
      },
      traces: {
        Fe: { lo: 50,  hi: 300 },     // L: <50, M: 50-300, H: >300
        Mn: { lo: 25,  hi: 300 },     // L: <25, M: 25-300, H: >300
        Zn: { lo: 20,  hi: 70  },     // L: <20, M: 20-70, H: >70
        Cu: { lo: 5,   hi: 15  },     // L: <5, M: 5-15, H: >15
        B:  { lo: 3,   hi: 20  },     // L: <3, M: 3-20, H: >20
        Na: { lo: 0,   hi: 1000, tox: 1500 }
      }
    },
    
    // Couch/Bermudagrass (C4) - Tifgreen reference
    couch: {
      macros: {
        N:  { lo: 3.00, hi: 4.30 },   // L: <3.00, M: 3.00-4.30, H: >4.30
        P:  { lo: 0.20, hi: 0.40 },   // L: <0.20, M: 0.20-0.40, H: >0.40
        K:  { lo: 1.60, hi: 2.25 },   // L: <1.60, M: 1.60-2.25, H: >2.25
        Ca: { lo: 0.25, hi: 0.50 },   // L: <0.25, M: 0.25-0.50, H: >0.50
        Mg: { lo: 0.15, hi: 0.30 },   // L: <0.15, M: 0.15-0.30, H: >0.30
        S:  { lo: 0.15, hi: 0.65 }    // L: <0.15, M: 0.15-0.65, H: >0.65
      },
      traces: {
        Fe: { lo: 50,  hi: 500 },     // L: <50, M: 50-500, H: >500
        Mn: { lo: 20,  hi: 300 },     // L: <20, M: 20-300, H: >300
        Zn: { lo: 15,  hi: 200 },     // L: <15, M: 15-200, H: >200
        Cu: { lo: 5,   hi: 20  },     // L: <5, M: 5-20, H: >20
        B:  { lo: 5,   hi: 60  },     // L: <5, M: 5-60, H: >60
        Na: { lo: 0,   hi: 1000, tox: 1500 }
      }
    },
    
    // Perennial Ryegrass (C3) - sports turf
    perennialRyegrass: {
      macros: {
        N:  { lo: 3.34, hi: 5.10 },   // L: <3.34, M: 3.34-5.1, H: >5.1
        P:  { lo: 0.33, hi: 0.55 },   // L: <0.33, M: 0.33-0.55, H: >0.55
        K:  { lo: 2.00, hi: 3.42 },   // L: <2, M: 2-3.42, H: >3.42
        Ca: { lo: 0.25, hi: 0.51 },   // L: <0.25, M: 0.25-0.51, H: >0.51
        Mg: { lo: 0.16, hi: 0.32 },   // L: <0.16, M: 0.16-0.32, H: >0.32
        S:  { lo: 0.27, hi: 0.56 }    // L: <0.27, M: 0.27-0.56, H: >0.56
      },
      traces: {
        Fe: { lo: 97,  hi: 934 },     // L: <97, M: 97-934, H: >938
        Mn: { lo: 30,  hi: 73  },     // L: <30, M: 30-73, H: >73
        Zn: { lo: 14,  hi: 64  },     // L: <14, M: 14-64, H: >64
        Cu: { lo: 6,   hi: 38  },     // L: <6, M: 6-38, H: >38
        B:  { lo: 9,   hi: 17  },     // L: <9, M: 9-17, H: >17
        Na: { lo: 0,   hi: 1000, tox: 1500 }
      }
    },
    
    // Poa annua (C3) - putting greens
    // Quality drops fast <3.4% N; >4.6% N increases soft growth, anthracnose risk
    poaAnnua: {
      macros: {
        N:  { lo: 3.50, hi: 4.50 },   // Poa quality drops fast <3.4%; >4.6% anthracnose risk
        P:  { lo: 0.35, hi: 0.60 },   // Poa responds at lower soil P than bent
        K:  { lo: 2.00, hi: 3.00 },   // Poa prefers upper half of range
        Ca: { lo: 0.40, hi: 0.80 },   // Often low on sand greens
        Mg: { lo: 0.18, hi: 0.35 },   // Keep balanced vs K to avoid soft leaf
        S:  { lo: 0.20, hi: 0.45 }    // Deficiency uncommon but shows rapidly
      },
      traces: {
        Fe: { lo: 80,  hi: 250 },     // Poa greens often sit 100-180 ppm
        Mn: { lo: 30,  hi: 200 },     // Toxicity possible >250 ppm on acidic sands
        Zn: { lo: 20,  hi: 80  },     // Low Zn = weak tillering
        Cu: { lo: 5,   hi: 20  },     // >25 ppm risks root suppression
        B:  { lo: 5,   hi: 25  },     // Narrow margin; toxicity above ~30 ppm
        Na: { lo: 0,   hi: 1000, tox: 1500 }
      }
    }
  };
  
  // Legacy aliases for backward compatibility
  RANGES.C3 = RANGES.bentgrass;  // Default C3 to bentgrass
  RANGES.C4 = RANGES.couch;      // Default C4 to couch

  var MACROS = ["N","P","K","Ca","Mg","S"];
  var TRACES = ["Fe","Mn","Zn","Cu","B","Na"];

  function isNum(x){ return typeof x === "number" && isFinite(x); }
  function toNumber(x){
    var n = (typeof x === "string") ? parseFloat(x) : x;
    return isNum(n) ? n : null;
  }

  // units schema:
  // { N: "%", P:"%", K:"%", Ca:"%", Mg:"%", S:"%", Fe:"mgkg", ... }
  // Defaults: macros="%", micros="mgkg"
  function normalizeInputs(tissue, units){
    var out = {};
    units = units || {};

    function normMacro(key){
      var v = toNumber(tissue[key]);
      if (v === null) return null;
      var u = (units[key] || "%").toLowerCase();
      if (u === "%" || u === "percent") return v;
      if (u === "mgkg" || u === "ppm") return v / 10000; // 1% = 10,000 mg/kg
      return v; // fallback assume %
    }

    function normTrace(key){
      var v = toNumber(tissue[key]);
      if (v === null) return null;
      var u = (units[key] || "mgkg").toLowerCase();
      if (u === "mgkg" || u === "ppm") return v;
      if (u === "%" || u === "percent") return v * 10000;
      return v; // fallback assume mg/kg
    }

    for (var i=0;i<MACROS.length;i++){
      var k = MACROS[i];
      var nv = normMacro(k);
      if (nv !== null) out[k] = nv;
    }
    for (var j=0;j<TRACES.length;j++){
      var m = TRACES[j];
      var mv = normTrace(m);
      if (mv !== null) out[m] = mv;
    }
    return out;
  }

  // Status bands:
  // Deficient < lo
  // Marginal: lo .. lo*1.10
  // Sufficient: >lo*1.10 .. hi
  // High: > hi
  function classify(value, range){
    if (!isNum(value)) return { band: "Missing", score: null };
    var lo = range.lo, hi = range.hi;
    var marginalHi = lo * 1.10;

    if (value < lo) return { band: "Deficient", score: 0 };
    if (value <= marginalHi) return { band: "Marginal", score: 1 };
    if (value <= hi) return { band: "Sufficient", score: 2 };
    return { band: "High", score: 3 };
  }

  function deficiencySeverity(value, range){
    if (!isNum(value)) return null;
    if (value >= range.lo) return 0;
    return Math.max(0, (range.lo - value) / range.lo);
  }

  // Conservative antagonism flags (pattern-based, not causal claims)
  function detectAntagonisms(t){
    var flags = [];

    if (isNum(t.K) && isNum(t.Mg) && isNum(t.Ca)) {
      if (t.K > 4.0 && t.Mg < 0.20) flags.push("High K with low Mg (possible K→Mg antagonism)");
      if (t.K > 4.0 && t.Ca < 0.40) flags.push("High K with low Ca (possible K→Ca antagonism)");
    }

    if (isNum(t.Ca) && isNum(t.Mg)) {
      if (t.Ca > 1.00 && t.Mg < 0.20) flags.push("High Ca with low Mg (possible Ca→Mg antagonism)");
    }

    if (isNum(t.P) && isNum(t.Zn)) {
      if (t.P > 0.60 && t.Zn < 20) flags.push("High P with low Zn (possible P→Zn antagonism)");
    }

    return flags;
  }

  function detectStressSignature(status){
    var lowCount = 0, macroLow = 0, microLow = 0;
    Object.keys(status).forEach(function(k){
      var b = status[k] && status[k].band;
      if (b === "Deficient" || b === "Marginal") {
        lowCount++;
        if (MACROS.indexOf(k) >= 0) macroLow++;
        if (TRACES.indexOf(k) >= 0) microLow++;
      }
    });
    return (lowCount >= 3 && macroLow >= 1 && microLow >= 1);
  }

  function detectDilution(t, ranges){
    var flags = [];
    if (!isNum(t.N)) return flags;
    if (t.N > ranges.macros.N.hi) {
      if (isNum(t.K)  && t.K  < ranges.macros.K.lo)  flags.push("High N with low K (growth dilution risk)");
      if (isNum(t.Ca) && t.Ca < ranges.macros.Ca.lo) flags.push("High N with low Ca (growth dilution risk)");
      if (isNum(t.Mg) && t.Mg < ranges.macros.Mg.lo) flags.push("High N with low Mg (growth dilution risk)");
    }
    return flags;
  }

  function rankLimiting(tNorm, ranges){
    var items = [];

    function add(key, range){
      var v = tNorm[key];
      if (!isNum(v)) return;
      var c = classify(v, range);
      if (c.band !== "Deficient" && c.band !== "Marginal") return;

      var sev = deficiencySeverity(v, range);
      if (c.band === "Marginal") sev = Math.max(0.01, sev * 0.5);

      items.push({ key: key, band: c.band, sev: sev });
    }

    MACROS.forEach(function(k){ add(k, ranges.macros[k]); });
    TRACES.forEach(function(k){
      if (k === "Na") return; // not limiting
      add(k, ranges.traces[k]);
    });

    items.sort(function(a,b){
      if (a.band !== b.band) return (a.band === "Deficient") ? -1 : 1;
      return b.sev - a.sev;
    });

    return items.map(function(x){ return x.key; }).slice(0, 5);
  }

  function compute(payload){
    payload = payload || {};
    
    // Support species-specific ranges or fall back to C3/C4
    var speciesKey = (payload.species || payload.speciesGroup || "C3").toLowerCase();
    
    // Map species names to range keys
    var rangeMapping = {
      'c3': 'bentgrass',
      'c4': 'couch',
      'bentgrass': 'bentgrass',
      'creeping bentgrass': 'bentgrass',
      'velvet bentgrass': 'bentgrass',
      'couch': 'couch',
      'bermuda': 'couch',
      'bermudagrass': 'couch',
      'tifgreen': 'couch',
      'perennial ryegrass': 'perennialRyegrass',
      'perennialryegrass': 'perennialRyegrass',
      'prg': 'perennialRyegrass',
      'ryegrass': 'perennialRyegrass',
      'poa annua': 'poaAnnua',
      'poa': 'poaAnnua',
      'poaannua': 'poaAnnua',
      'annual bluegrass': 'poaAnnua'
    };
    
    var rangeKey = rangeMapping[speciesKey] || 'bentgrass';
    var ranges = RANGES[rangeKey];
    
    // Fallback to bentgrass if range not found
    if (!ranges) {
      ranges = RANGES.bentgrass;
      rangeKey = 'bentgrass';
    }

    var growthState = (payload.growthState || "active").toLowerCase();
    var tissueRaw = payload.tissue || {};
    var units = payload.units || {};
    var context = payload.context || {};

    var tNorm = normalizeInputs(tissueRaw, units);

    var status = {};
    MACROS.forEach(function(k){ status[k] = classify(tNorm[k], ranges.macros[k]); });
    TRACES.forEach(function(k){ status[k] = classify(tNorm[k], ranges.traces[k]); });

    var na = tNorm.Na;
    var naTox = null;
    if (isNum(na)) {
      if (na > ranges.traces.Na.tox) naTox = "High Na toxicity risk";
      else if (na > ranges.traces.Na.hi) naTox = "Elevated Na (watch scorch/osmotic stress)";
    }

    var antagonisms = detectAntagonisms(tNorm);
    var dilutionFlags = detectDilution(tNorm, ranges);

    var stressSignal = detectStressSignature(status);
    var contextStress = !!context.stress || (growthState === "stress") || !!context.pgr;

    var limiting = rankLimiting(tNorm, ranges);

    return {
      meta: {
        speciesGroup: rangeKey,
        growthState: growthState,
        sampleType: payload.sampleType || "whole-leaf",
        engineVersion: "0.2"
      },
      normalized: tNorm,
      ranges: ranges,
      status: status,
      limitingNutrients: limiting,
      antagonisms: antagonisms,
      dilutionFlags: dilutionFlags,
      naFlag: naTox,
      stressSignal: stressSignal,
      contextStress: contextStress
    };
  }

  return {
    RANGES: RANGES,
    normalizeInputs: normalizeInputs,
    classify: classify,
    compute: compute
  };
});

// Alias for hub-orchestrator compatibility
if (typeof window !== 'undefined' && window.GilbaTissueEngine) {
    window.gaip_tissue_engine = window.GilbaTissueEngine.compute;
}
