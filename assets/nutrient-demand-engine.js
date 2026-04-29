/**
 * nutrient-demand-engine.js
 *
 * Species-specific nutrient demand engine. Calculates annual nutrient harvest
 * from clippings based on N programme rate, species physiology, and
 * maintenance context (greens, sports, fairways).
 *
 * VERSION: 2.0.0
 *
 * Methodology: N-driven nutrient demand (Kussow et al. 2012;
 * Woods / Asian Turfgrass Center ClipVol research)
 *
 * Source history:
 *   The b35fix300 production build (and earlier builds back to at least b35fix97)
 *   shipped this file as a single-line minified bundle. The unminified source was
 *   not preserved. In b35fix301a the source was restored by formatting the
 *   minified bundle and applying an AST-aware rename derived from the module's
 *   own public export map (e -> SPECIES_TISSUE_CONCENTRATIONS, l -> MLSN_THRESHOLDS,
 *   etc.). Byte-identical output parity against the minified original was verified
 *   across species normalisation, demand calculation, threshold adjustment, hub
 *   state analysis, and full HTML render output before this file was accepted.
 *
 * Scientific references embedded in the engine's own output strings:
 *   Kussow W.R., Soldat D.J., Kreuser W.C., Houlihan S.M. (2012) Evidence,
 *     regulation, and consequences of nitrogen-driven nutrient demand by
 *     turfgrass. ISRN Agronomy 2012.
 *   Trenholm L.E. et al. (2003) Bermudagrass tissue nutrient concentrations.
 *   Sartain J.B. (2002) Food for turf: slow-release nitrogen.
 *   Hull R.J. (1992) Energy relations and carbohydrate partitioning in turfgrasses.
 *   Woods M.S., Asian Turfgrass Center ClipVol programme.
 *
 * MLSN_THRESHOLDS: matches the published MLSN values (Woods, Stowell, Gelernter
 *   2016, PeerJ Preprints 4:e2144v1). b35fix301a also introduces the shared
 *   gaip-classification-constants.js module; this file imports MLSN_THRESHOLDS
 *   from there as part of the resolver consolidation.
 */
(!(function (e, t) {
  "object" == typeof module && module.exports
    ? (module.exports = t())
    : (e.GilbaNutrientDemandEngine = t());
})("undefined" != typeof self ? self : this, function () {
  "use strict";
  var SPECIES_TISSUE_CONCENTRATIONS = {
      perennialRyegrass: {
        N: 4,
        K: 2.2,
        P: 0.4,
        Ca: 0.5,
        Mg: 0.25,
        S: 0.3,
        Fe: 0.01,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      creepingBentgrass: {
        N: 4,
        K: 2,
        P: 0.4,
        Ca: 0.5,
        Mg: 0.25,
        S: 0.3,
        Fe: 0.01,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      kentuckyBluegrass: {
        N: 3.8,
        K: 2,
        P: 0.38,
        Ca: 0.5,
        Mg: 0.25,
        S: 0.28,
        Fe: 0.01,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      tallFescue: {
        N: 3.5,
        K: 2,
        P: 0.35,
        Ca: 0.45,
        Mg: 0.22,
        S: 0.25,
        Fe: 0.01,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      fineFescue: {
        N: 3.2,
        K: 1.8,
        P: 0.32,
        Ca: 0.4,
        Mg: 0.2,
        S: 0.22,
        Fe: 0.008,
        Mn: 0.004,
        Zn: 0.002,
        Cu: 0.001,
        B: 0.001,
      },
      poaAnnua: {
        N: 4.5,
        K: 2.5,
        P: 0.45,
        Ca: 0.55,
        Mg: 0.28,
        S: 0.32,
        Fe: 0.012,
        Mn: 0.006,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      bermuda: {
        N: 3,
        K: 1.8,
        P: 0.3,
        Ca: 0.45,
        Mg: 0.2,
        S: 0.25,
        Fe: 0.008,
        Mn: 0.005,
        Zn: 0.002,
        Cu: 0.001,
        B: 0.001,
      },
      ultradwarfBermuda: {
        N: 3.5,
        K: 2,
        P: 0.35,
        Ca: 0.5,
        Mg: 0.25,
        S: 0.28,
        Fe: 0.01,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      kikuyu: {
        N: 3.2,
        K: 2,
        P: 0.32,
        Ca: 0.48,
        Mg: 0.22,
        S: 0.26,
        Fe: 0.01,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      zoysia: {
        N: 2.8,
        K: 1.6,
        P: 0.28,
        Ca: 0.4,
        Mg: 0.18,
        S: 0.22,
        Fe: 0.008,
        Mn: 0.004,
        Zn: 0.002,
        Cu: 0.001,
        B: 0.001,
      },
      seashorePaspalum: {
        N: 1.5,        // 50% lower than bermuda (3.0) - Duncan & Carrow 2000
        K: 2.25,       // N:K ratio 1:1.5 for salt-affected sites
        P: 0.3,
        Ca: 0.5,
        Mg: 0.25,
        S: 0.28,
        Fe: 0.01,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
      buffalograss: {
        N: 2.5,
        K: 1.4,
        P: 0.25,
        Ca: 0.35,
        Mg: 0.15,
        S: 0.2,
        Fe: 0.006,
        Mn: 0.003,
        Zn: 0.002,
        Cu: 0.001,
        B: 0.001,
      },
      stAugustine: {
        N: 3.2,
        K: 1.8,
        P: 0.32,
        Ca: 0.45,
        Mg: 0.22,
        S: 0.25,
        Fe: 0.008,
        Mn: 0.005,
        Zn: 0.003,
        Cu: 0.001,
        B: 0.001,
      },
    },
    SPECIES_CLIPPING_FACTORS = {
      perennialRyegrass: {
        yieldFactor: 25,
        leafPartition: 0.85,
        validationLevel: "estimated",
        notes: "Bunch-type grass, high leaf production. Similar to bentgrass physiology.",
      },
      creepingBentgrass: {
        yieldFactor: 25,
        leafPartition: 0.8,
        validationLevel: "validated",
        notes: "ATC ClipVol validated. Baseline reference species.",
      },
      kentuckyBluegrass: {
        yieldFactor: 26.3,
        leafPartition: 0.75,
        validationLevel: "validated",
        notes: "Kussow et al. (2012) research species. Rhizome production reduces leaf yield.",
      },
      tallFescue: {
        yieldFactor: 28.6,
        leafPartition: 0.8,
        validationLevel: "estimated",
        notes: "Bunch-type with deep root system. Lower tissue N dilutes yield factor.",
      },
      fineFescue: {
        yieldFactor: 31.3,
        leafPartition: 0.85,
        validationLevel: "estimated",
        notes: "Low input species, fine leaves. Lower tissue N.",
      },
      poaAnnua: {
        yieldFactor: 22.2,
        leafPartition: 0.9,
        validationLevel: "estimated",
        notes: "High N luxury consumption, shallow rooted. Most N to leaf tissue.",
      },
      bermuda: {
        yieldFactor: 20,
        leafPartition: 0.6,
        validationLevel: "estimated",
        notes:
          "Stoloniferous/rhizomatous. ~40% of N to lateral growth, not clippings. Hull (1992).",
      },
      ultradwarfBermuda: {
        yieldFactor: 22,
        leafPartition: 0.7,
        validationLevel: "estimated",
        notes: "Low HOC forces more vertical growth. Less stolon/rhizome at green height.",
      },
      kikuyu: {
        yieldFactor: 18,
        leafPartition: 0.55,
        validationLevel: "extrapolated",
        notes:
          "Highly stoloniferous C4. Substantial N partitioned to lateral growth. Limited published data.",
      },
      zoysia: {
        yieldFactor: 21.4,
        leafPartition: 0.6,
        validationLevel: "extrapolated",
        notes: "Slow-growing, efficient N use. Dense lateral network.",
      },
      seashorePaspalum: {
        yieldFactor: 20,
        leafPartition: 0.6,
        validationLevel: "extrapolated",
        notes: "Stoloniferous C4. Limited published clipping data.",
      },
      buffalograss: {
        yieldFactor: 24,
        leafPartition: 0.65,
        validationLevel: "extrapolated",
        notes: "Native, low-input. Stoloniferous but slow growth.",
      },
      stAugustine: {
        yieldFactor: 18.8,
        leafPartition: 0.6,
        validationLevel: "extrapolated",
        notes: "Coarse stoloniferous C4. Limited published data.",
      },
    },
    SPECIES_ALIASES = {
      couch: "bermuda",
      couchgrass: "bermuda",
      "bermuda couch": "bermuda",
      "bermuda/couch": "bermuda",
      "couch/bermuda": "bermuda",
      bermudagrass: "bermuda",
      cynodon: "bermuda",
      "common bermuda": "bermuda",
      "hybrid bermuda": "bermuda",
      tifeagle: "ultradwarfBermuda",
      tifgreen: "ultradwarfBermuda",
      champion: "ultradwarfBermuda",
      miniverde: "ultradwarfBermuda",
      tifdwarf: "ultradwarfBermuda",
      ultradwarf: "ultradwarfBermuda",
      "ultradwarf bermuda": "ultradwarfBermuda",
      prg: "perennialRyegrass",
      ryegrass: "perennialRyegrass",
      "perennial rye": "perennialRyegrass",
      "lolium perenne": "perennialRyegrass",
      bent: "creepingBentgrass",
      bentgrass: "creepingBentgrass",
      agrostis: "creepingBentgrass",
      "creeping bent": "creepingBentgrass",
      kbg: "kentuckyBluegrass",
      bluegrass: "kentuckyBluegrass",
      "poa pratensis": "kentuckyBluegrass",
      "kentucky blue": "kentuckyBluegrass",
      poa: "poaAnnua",
      "annual bluegrass": "poaAnnua",
      "poa annua": "poaAnnua",
      fescue: "fineFescue",
      "tall fescue": "tallFescue",
      "fine fescue": "fineFescue",
      chewings: "fineFescue",
      "hard fescue": "fineFescue",
      "sheep fescue": "fineFescue",
      zoysia: "zoysia",
      zoysiagrass: "zoysia",
      paspalum: "seashorePaspalum",
      "seashore paspalum": "seashorePaspalum",
      buffalo: "buffalograss",
      "st augustine": "stAugustine",
      "st. augustine": "stAugustine",
    };
  function normalizeSpecies(t) {
    if (!t) return null;
    var i = t.replace(/\s*\(.*?\)\s*/g, "").trim(),
      r = i
        .toLowerCase()
        .replace(/[\s\-_]+/g, " ")
        .trim();
    if (SPECIES_ALIASES[r]) return SPECIES_ALIASES[r];
    if (SPECIES_TISSUE_CONCENTRATIONS[t]) return t;
    if (SPECIES_TISSUE_CONCENTRATIONS[i]) return i;
    var s = r.replace(/\s+(.)/g, function (e, t) {
      return t.toUpperCase();
    });
    return SPECIES_TISSUE_CONCENTRATIONS[s] ? s : null;
  }
  function getSpeciesTissueConcentrations(t, a) {
    var r = normalizeSpecies(t);
    return r && SPECIES_TISSUE_CONCENTRATIONS[r]
      ? {
          data: SPECIES_TISSUE_CONCENTRATIONS[r],
          source: r,
          isSpeciesSpecific: !0,
        }
      : {
          data:
            "greens" === a
              ? SPECIES_TISSUE_CONCENTRATIONS.creepingBentgrass
              : SPECIES_TISSUE_CONCENTRATIONS.perennialRyegrass,
          source: "greens" === a ? "creepingBentgrass (default)" : "perennialRyegrass (default)",
          isSpeciesSpecific: !1,
        };
  }
  function getSpeciesClippingFactor(e, a) {
    var r = normalizeSpecies(e);
    return r && SPECIES_CLIPPING_FACTORS[r]
      ? {
          data: SPECIES_CLIPPING_FACTORS[r],
          source: r,
          isSpeciesSpecific: !0,
        }
      : {
          data:
            "greens" === a
              ? SPECIES_CLIPPING_FACTORS.creepingBentgrass
              : SPECIES_CLIPPING_FACTORS.perennialRyegrass,
          source: "greens" === a ? "creepingBentgrass (default)" : "perennialRyegrass (default)",
          isSpeciesSpecific: !1,
        };
  }
  function getSpeciesType(e) {
    var t = normalizeSpecies(e);
    return -1 !==
      [
        "bermuda",
        "ultradwarfBermuda",
        "kikuyu",
        "zoysia",
        "seashorePaspalum",
        "buffalograss",
        "stAugustine",
      ].indexOf(t)
      ? "C4"
      : "C3";
  }
  var CLIPPING_VOLUME_FACTORS = {
      greens: 0.06,
      sports: 0.07,
      perennialRyegrass: 0.065,
      creepingBentgrass: 0.06,
      kentuckyBluegrass: 0.065,
      bermuda: 0.075,
      ultradwarfBermuda: 0.07,
      kikuyu: 0.08,
      zoysia: 0.08,
    },
    BASELINE_N_RATES = {
      greens: 150,
      fairways: 120,
      sports: 200,
      sports_high: 350,
    };
  // b35fix301a: MLSN_THRESHOLDS sourced from shared constants module
  // (gaip-classification-constants.js). Falls back to a local literal
  // if the constants module hasn't loaded (e.g. Node tests without the
  // constants module on the context).
  var MLSN_THRESHOLDS =
    (typeof window !== "undefined" &&
      window.GilbaClassificationConstants &&
      window.GilbaClassificationConstants.MLSN_THRESHOLDS) ||
    (typeof globalThis !== "undefined" &&
      globalThis.GilbaClassificationConstants &&
      globalThis.GilbaClassificationConstants.MLSN_THRESHOLDS) ||
    {
      K: 37,
      P: 21,
      Ca: 331,
      Mg: 47,
      S: 7,
      Fe: 2,
      Mn: 1,
      Zn: 1,
      Cu: 0.3,
      B: 0.3,
    };
  function calculateNutrientHarvest(e, t, a) {
    var i = getSpeciesTissueConcentrations(a, (t = t || "sports")).data,
      s = {};
    for (var n in i) s[n] = e * (i[n] / 100);
    return s;
  }
  function estimateClippingYieldFromN(e, t) {
    "number" == typeof (t = t || {}) &&
      (t = {
        recoveryEfficiency: t,
      });
    var a = t.recoveryEfficiency || 0.5,
      i = t.species,
      r = getSpeciesClippingFactor(i, t.context || "sports"),
      n = r.data.yieldFactor,
      o = r.data.leafPartition,
      d = r.data.validationLevel,
      l = (e / 10) * a,
      p = l * n;
    return i || t.detailed
      ? {
          clippingYieldGm2: p,
          clippingYieldKgHa: 10 * p,
          nUptakeGm2: l,
          yieldFactor: n,
          leafPartition: o,
          speciesSource: r.source,
          isSpeciesSpecific: r.isSpeciesSpecific,
          validationLevel: d,
          methodology: "Species-specific N-to-clipping conversion",
        }
      : p;
  }
  function calculateDemandMultiplier(e, t) {
    var a = e / (BASELINE_N_RATES[(t = t || "sports")] || BASELINE_N_RATES.sports);
    return Math.max(0.5, Math.min(3, a));
  }
  function calculateNutrientDemand(e) {
    var t,
      a,
      d = (e = e || {}).context || "sports",
      l = e.nRateKgHaYear || 200,
      g = e.growingWeeks || 40,
      f = e.species,
      y = e.overseedSpecies,
      v = e.overseedFraction || 0,
      h = getSpeciesTissueConcentrations(f, d),
      b = f ? getSpeciesType(f) : null,
      x = null;
    if (e.clippingVolumeWeekly && e.clippingVolumeWeekly > 0) {
      var S = normalizeSpecies(f),
        N =
          CLIPPING_VOLUME_FACTORS[S] ||
          CLIPPING_VOLUME_FACTORS[d] ||
          CLIPPING_VOLUME_FACTORS.sports;
      ((t = e.clippingVolumeWeekly * N * g), (a = "measured"));
    } else
      ((t = (x = estimateClippingYieldFromN(l, {
        species: f,
        context: d,
        detailed: !0,
      })).clippingYieldGm2),
        (a = "estimated"));
    var C,
      w = null;
    (y && v > 0 && (t = (w = calculateOverseedBlend(f, y, v, t, d)).blendedClippingYield),
      (C = w ? w.blendedHarvest : calculateNutrientHarvest(t, d, f)));
    var k = calculateDemandMultiplier(l, "greens" === d ? "greens" : "sports"),
      M = (function (e, t, a) {
        var r = normalizeSpecies(a),
          o = a ? getSpeciesType(a) : null,
          d = a ? getSpeciesClippingFactor(a, e) : null,
          l = d ? d.data.validationLevel : "estimated";
        if ("greens" === e && (!a || "creepingBentgrass" === r))
          return t <= 250
            ? {
                level: "validated",
                confidence: "high",
                message:
                  "Well-validated for creeping bentgrass putting greens at this N rate. Based on Kussow et al. (2012) and Woods/ATC ClipVol methodology.",
                dataSource:
                  "Kussow et al. (2012) ISRN Agronomy; Asian Turfgrass Center ClipVol research",
              }
            : {
                level: "extrapolated",
                confidence: "medium",
                message:
                  "N rate exceeds typical putting green programmes (>250 kg/ha/year). Demand estimates extrapolated from validated research using linear N-growth relationship.",
                dataSource: "Extrapolated from Kussow et al. (2012)",
              };
        if ("C4" === o) {
          var p = "";
          return (
            (p =
              "bermuda" === r || "ultradwarfBermuda" === r
                ? "Bermuda/couch tissue concentrations based on Trenholm et al. (2003) and Sartain (2002). N partitioning to stolons/rhizomes (~40%) reduces clipping yield vs C3 grasses."
                : "kikuyu" === r
                  ? "Kikuyu parameters extrapolated from C4 physiology - limited published clipping data. Aggressive stolon production may further reduce leaf N partition."
                  : "C4 species parameters extrapolated - limited direct validation for this species."),
            t <= 200
              ? {
                  level: l,
                  confidence: "validated" === l ? "medium" : "medium-low",
                  message:
                    p + " At moderate N rates, estimates are reasonable but should be verified.",
                  dataSource: "Species-specific: " + r,
                  speciesNote:
                    "C4 grasses partition more N to lateral growth - clipping yield ~20-30% lower than C3 at same N rate.",
                  recommendation:
                    "Tissue testing recommended to validate species-specific predictions",
                }
              : {
                  level: "indicative",
                  confidence: "medium-low",
                  message: p + " High N rates on C4 turf require careful monitoring.",
                  dataSource: "Species-specific extrapolation: " + r,
                  speciesNote: "C4 grasses show different N response curves than C3 research base.",
                  recommendation: "Tissue testing strongly recommended for high-N C4 programmes",
                }
          );
        }
        if ("C3" === o || !o) {
          var u = a
            ? "Species-specific parameters for " + r + " (" + l + ")."
            : "Using default perennial ryegrass parameters.";
          return t <= 200
            ? {
                level: "validated" === l ? "extrapolated" : l,
                confidence: "medium",
                message:
                  u +
                  " Based on golf putting green research (Kussow et al. 2012). Plant physiology principles apply to sports turf at higher mowing heights.",
                dataSource: "Extrapolated from golf green research",
                speciesNote: a ? "Using " + r + " tissue concentrations" : null,
                recommendation: "Verify with tissue testing",
              }
            : t <= 350
              ? {
                  level: "indicative",
                  confidence: "medium",
                  message:
                    u +
                    " Elevated N programme for sports turf recovery. Estimates based on N-driven demand principle but not validated at these rates.",
                  dataSource: "Indicative - extrapolated from golf research",
                  recommendation:
                    "Tissue testing strongly recommended during intensive recovery periods",
                }
              : {
                  level: "indicative",
                  confidence: "low-medium",
                  message:
                    u +
                    " Very high N recovery programme (>" +
                    t +
                    " kg/ha/year). Nutrient demand estimates are indicative only.",
                  dataSource: "Indicative only - no direct research at these rates",
                  recommendation: "Essential: fortnightly tissue testing for K, Mg status",
                  warning: "MLSN thresholds likely inadequate at this N intensity",
                };
        }
        return {
          level: "indicative",
          confidence: "low",
          message: "Unable to determine species-specific validation. Using default parameters.",
          dataSource: "Default",
          recommendation: "Tissue testing recommended",
        };
      })(d, l, f),
      P = {};
    for (var F in C) P[F] = 10 * C[F];
    return {
      context: d,
      nRateKgHaYear: l,
      species: {
        primary: f || null,
        primaryKey: normalizeSpecies(f),
        type: b,
        tissueSource: h.source,
        isSpeciesSpecific: h.isSpeciesSpecific,
        overseed: y || null,
        overseedFraction: v,
      },
      annualClippingYield: {
        gPerM2: t,
        kgPerHa: 10 * t,
        source: a,
        details: x,
      },
      demandMultiplier: k,
      nutrientHarvest: {
        gPerM2: C,
        kgPerHa: P,
      },
      overseedAnalysis: w,
      validationStatus: M,
      methodology: {
        reference: "Kussow et al. (2012) ISRN Agronomy; Woods/ATC ClipVol",
        principle: "N-driven nutrient demand",
        tissueConcentrations: h.data,
        speciesNote: h.isSpeciesSpecific
          ? "Using species-specific tissue concentrations for " + h.source
          : "Using default tissue concentrations (" + h.source + ")",
      },
    };
  }
  function calculateOverseedBlend(e, t, a, o, d) {
    var l = 1 - a,
      p = getSpeciesTissueConcentrations(e, d),
      u = getSpeciesTissueConcentrations(t, d),
      c = getSpeciesClippingFactor(e, d),
      g = getSpeciesClippingFactor(t, d),
      m = o * l * (c.data.leafPartition / 0.8) + o * a * (g.data.leafPartition / 0.8),
      f = {},
      y = p.data,
      v = u.data;
    for (var h in y) f[h] = y[h] * l + v[h] * a;
    var b = {};
    for (var h in f) b[h] = m * (f[h] / 100);
    return {
      baseSpecies: {
        key: normalizeSpecies(e),
        fraction: l,
        type: getSpeciesType(e),
        leafPartition: c.data.leafPartition,
        tissueN: y.N,
      },
      overseedSpecies: {
        key: normalizeSpecies(t),
        fraction: a,
        type: getSpeciesType(t),
        leafPartition: g.data.leafPartition,
        tissueN: v.N,
      },
      blendedClippingYield: m,
      blendedTissueConcentrations: f,
      blendedHarvest: b,
      methodology: "Weighted blend of species-specific parameters",
      note:
        "Overseed at " +
        Math.round(100 * a) +
        "% dominance. " +
        getSpeciesType(e) +
        " base (" +
        Math.round(100 * l) +
        "%) + " +
        getSpeciesType(t) +
        " overseed (" +
        Math.round(100 * a) +
        "%).",
    };
  }
  function calculateAdjustedThresholds(e, t, a) {
    a = a || "mlsn";
    var i = calculateDemandMultiplier(e, (t = t || "sports")),
      r = i > 1.2,
      s = Object.assign({}, MLSN_THRESHOLDS),
      n = {},
      o = {},
      d = ["K", "Mg", "Ca", "S", "Fe", "Mn"];
    for (var p in s)
      if (r && -1 !== d.indexOf(p)) {
        var u = Math.min(i, 2);
        ((n[p] = Math.round(s[p] * u)),
          (o[p] = {
            original: s[p],
            adjusted: n[p],
            factor: u,
            reason: "Elevated demand from " + e + " kg N/ha/year programme",
          }));
      } else
        ((n[p] = s[p]),
          (o[p] = {
            original: s[p],
            adjusted: s[p],
            factor: 1,
            reason: r ? "Not adjusted (P, trace elements less affected)" : "No adjustment needed",
          }));
    return {
      adjustmentNeeded: r,
      demandMultiplier: i,
      nRateKgHaYear: e,
      context: t,
      methodology: a,
      baseThresholds: s,
      adjustedThresholds: n,
      adjustments: o,
      recommendation: buildThresholdRecommendation(r, i, t),
      citation:
        "Threshold adjustment based on N-driven nutrient demand principle (Kussow et al. 2012). " +
        ("sports" === t
          ? "Sports turf application is extrapolated - verify with tissue testing."
          : ""),
    };
  }
  function buildThresholdRecommendation(e, t, a) {
    if (!e)
      return {
        summary: "Standard thresholds appropriate",
        detail:
          "N programme is within typical range. Standard MLSN/SLAN thresholds are appropriate.",
        action: "Use standard soil test interpretation.",
      };
    var i = Math.round(100 * (t - 1));
    return "sports" === a
      ? {
          summary: "Elevated thresholds recommended for sports turf",
          detail:
            "High-N recovery programme detected (" +
            i +
            "% above baseline). Increased clipping yield will deplete secondary nutrients (K, Mg, Ca) faster than standard MLSN thresholds predict. Note: MLSN was validated primarily on golf putting greens with moderate N rates.",
          action:
            "Options: (1) Use adjusted thresholds shown below, OR (2) Switch to SLAN ranges which provide additional buffer, OR (3) Maintain standard thresholds but monitor tissue K and Mg levels fortnightly during recovery periods.",
          tissueMonitoring:
            "Strongly recommended. Tissue testing provides ground-truth verification since threshold adjustments for high-N sports turf are extrapolated from golf green research (Kussow et al. 2012).",
          methodology:
            "Adjustment based on N-driven nutrient demand principle. At higher N rates, clipping production increases linearly, removing proportionally more K, Mg, Ca, S.",
        }
      : {
          summary: "Elevated thresholds may be appropriate",
          detail:
            "N rate is " +
            i +
            "% above typical putting green programmes (" +
            BASELINE_N_RATES.greens +
            " kg/ha/year baseline). Secondary nutrient demand will be elevated proportionally.",
          action: "Consider adjusted thresholds or increase monitoring frequency.",
          tissueMonitoring: "Recommended to verify plant nutrient status.",
          methodology: "Based on validated research (Kussow et al. 2012, Woods/ATC).",
        };
  }
  function formatDemandSummary(e, t) {
    var a = [];
    if (e.species && e.species.primary) {
      var i = e.species.primaryKey || e.species.primary;
      (a.push("Species: " + i + " (" + (e.species.type || "C3") + ")"),
        e.species.overseed &&
          a.push(
            "Overseed: " +
              e.species.overseed +
              " at " +
              Math.round(100 * e.species.overseedFraction) +
              "%",
          ));
    }
    return (
      a.push("N Programme: " + e.nRateKgHaYear + " kg/ha/year"),
      a.push("Demand Multiplier: " + e.demandMultiplier.toFixed(2) + "x baseline"),
      a.push("Clipping Yield: " + Math.round(e.annualClippingYield.kgPerHa) + " kg/ha/year"),
      a.push(
        "Validation: " +
          e.validationStatus.level +
          " (" +
          e.validationStatus.confidence +
          " confidence)",
      ),
      t.adjustmentNeeded &&
        (a.push(""),
        a.push("⚠️ Threshold adjustment recommended:"),
        a.push("K: " + t.baseThresholds.K + " → " + t.adjustedThresholds.K + " ppm"),
        a.push("Mg: " + t.baseThresholds.Mg + " → " + t.adjustedThresholds.Mg + " ppm")),
      a.join("\n")
    );
  }
  function formatSpeciesName(e) {
    if (!e) return "Unknown";
    return (
      {
        perennialRyegrass: "Perennial Ryegrass",
        creepingBentgrass: "Creeping Bentgrass",
        kentuckyBluegrass: "Kentucky Bluegrass",
        tallFescue: "Tall Fescue",
        fineFescue: "Fine Fescue",
        poaAnnua: "Poa Annua",
        bermuda: "Bermuda/Couch",
        ultradwarfBermuda: "Ultradwarf Bermuda",
        kikuyu: "Kikuyu",
        zoysia: "Zoysia",
        seashorePaspalum: "Seashore Paspalum",
        buffalograss: "Buffalograss",
        stAugustine: "St. Augustine",
      }[e] ||
      e.replace(/([A-Z])/g, " $1").replace(/^./, function (e) {
        return e.toUpperCase();
      })
    );
  }
  return {
    calculateNutrientDemand: calculateNutrientDemand,
    calculateNutrientHarvest: calculateNutrientHarvest,
    calculateDemandMultiplier: calculateDemandMultiplier,
    estimateClippingYieldFromN: estimateClippingYieldFromN,
    normalizeSpecies: normalizeSpecies,
    getSpeciesTissueConcentrations: getSpeciesTissueConcentrations,
    getSpeciesClippingFactor: getSpeciesClippingFactor,
    getSpeciesType: getSpeciesType,
    formatSpeciesName: formatSpeciesName,
    calculateOverseedBlend: calculateOverseedBlend,
    calculateAdjustedThresholds: calculateAdjustedThresholds,
    analyzeFromHubState: function (e) {
      if (!e)
        return {
          error: "No hub state provided",
        };
      var t = e.turf || {},
        a = e.tissue || {},
        i = e.traffic || {},
        r = "sports",
        s = t.turfType || t.type || "",
        n = t.subCategory || "";
      if (s) {
        var o = s.toLowerCase(),
          d = n.toLowerCase();
        (-1 === o.indexOf("green") && -1 === o.indexOf("putting") && "greens" !== d) ||
          (r = "greens");
      }
      var l = t.grassSpecies || t.warmBase || null,
        p = t.coolOverseed || t.overseedSpecies || null,
        u = 0;
      t.species && "number" == typeof t.species.c3Fraction
        ? (u = t.species.c3Fraction)
        : t.overseedFraction
          ? (u = t.overseedFraction)
          : t.overseedPercent && (u = t.overseedPercent / 100);
      var c = 200;
      a.nRateMonthly
        ? (c = 10 * a.nRateMonthly)
        : i.matchesPerWeek && i.matchesPerWeek > 2 && (c = 300 + 50 * (i.matchesPerWeek - 2));
      var m = calculateNutrientDemand({
          nRateKgHaYear: c,
          context: r,
          species: l,
          overseedSpecies: p,
          overseedFraction: u,
          growingWeeks: 40,
        }),
        y = calculateAdjustedThresholds(c, r, "mlsn");
      return {
        demand: m,
        thresholds: y,
        summary: formatDemandSummary(m, y),
      };
    },
    renderDemandAnalysis: function (e) {
      if (!e || e.error) return '<p class="gaip-no-data">Unable to calculate nutrient demand</p>';
      var t = e.demand,
        a = e.thresholds,
        r = t.validationStatus,
        s =
          "validated" === r.level ? "#059669" : "extrapolated" === r.level ? "#d97706" : "#dc2626",
        n =
          "validated" === r.level
            ? "var(--gaip-good-bg)"
            : "extrapolated" === r.level
              ? "var(--gaip-warning-bg)"
              : "var(--gaip-critical-bg)",
        o = "greens" === t.context ? "Golf Greens" : "Sports Turf",
        d = "greens" === t.context ? "⛳" : "🏟️",
        l = "";
      t.species &&
        t.species.primaryKey &&
        ((l = formatSpeciesName(t.species.primaryKey) + " (" + (t.species.type || "C3") + ")"),
        t.species.overseed &&
          (l +=
            " + " +
            formatSpeciesName(normalizeSpecies(t.species.overseed)) +
            " overseed (" +
            Math.round(100 * t.species.overseedFraction) +
            "%)"));
      var p = '<div class="gaip-nutrient-demand-analysis">';
      if (
        ((p +=
          '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">'),
        (p += "<div>"),
        (p += '<h4 style="margin: 0; display: inline;">N-Linked Nutrient Demand</h4>'),
        (p +=
          '<span style="margin-left: 8px; font-size: 12px; color: var(--gaip-text);">' +
          d +
          " " +
          o +
          "</span>"),
        (p += "</div>"),
        (p +=
          '<span style="background: ' +
          n +
          "; color: " +
          s +
          '; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">' +
          r.level.toUpperCase() +
          "</span>"),
        (p += "</div>"),
        l)
      ) {
        var u = t.species.isSpeciesSpecific ? "#059669" : "var(--gaip-text-secondary)",
          c = t.species.isSpeciesSpecific ? "var(--gaip-good-bg)" : "var(--gaip-surface-hover)",
          g = t.species.isSpeciesSpecific ? "SPECIES-SPECIFIC" : "DEFAULT";
        ((p +=
          '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 8px; background: var(--gaip-surface-muted); border-radius: 6px;">'),
          (p += '<div style="font-size: 13px; color: var(--gaip-text);">🌱 ' + l + "</div>"),
          (p +=
            '<span style="background: ' +
            c +
            "; color: " +
            u +
            '; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600;">' +
            g +
            "</span>"),
          (p += "</div>"));
      }
      if (
        ((p +=
          '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">'),
        (p +=
          '<div style="background: var(--gaip-surface-hover); padding: 10px; border-radius: 6px; text-align: center;">'),
        (p +=
          '<div style="font-size: 20px; font-weight: 600; color: var(--gaip-text);">' +
          t.nRateKgHaYear +
          "</div>"),
        (p += '<div style="font-size: 11px; color: var(--gaip-text);">kg N/ha/year</div>'),
        (p += "</div>"),
        (p +=
          '<div style="background: var(--gaip-surface-hover); padding: 10px; border-radius: 6px; text-align: center;">'),
        (p +=
          '<div style="font-size: 20px; font-weight: 600; color: var(--gaip-text);">' +
          t.demandMultiplier.toFixed(2) +
          "x</div>"),
        (p += '<div style="font-size: 11px; color: var(--gaip-text);">Demand Multiplier</div>'),
        (p += "</div>"),
        (p +=
          '<div style="background: var(--gaip-surface-hover); padding: 10px; border-radius: 6px; text-align: center;">'),
        (p +=
          '<div style="font-size: 20px; font-weight: 600; color: var(--gaip-text);">' +
          Math.round(t.annualClippingYield.kgPerHa) +
          "</div>"),
        (p += '<div style="font-size: 11px; color: var(--gaip-text);">kg clippings/ha/yr</div>'),
        (p += "</div>"),
        (p += "</div>"),
        (p +=
          '<div style="background: ' +
          n +
          "; border: 1px solid " +
          s +
          '; padding: 10px; border-radius: 6px; margin-bottom: 16px;">'),
        (p += '<div style="font-size: 12px; color: ' + s + ';">' + r.message + "</div>"),
        r.speciesNote &&
          (p +=
            '<div style="font-size: 11px; color: ' +
            s +
            '; margin-top: 4px; font-style: italic;">' +
            r.speciesNote +
            "</div>"),
        r.recommendation &&
          (p +=
            '<div style="font-size: 11px; color: ' +
            s +
            '; margin-top: 6px; font-weight: 500;">→ ' +
            r.recommendation +
            "</div>"),
        (p += "</div>"),
        a.adjustmentNeeded)
      ) {
        ((p +=
          '<div style="background: var(--gaip-warning-bg); border: 1px solid #f59e0b; border-left: 4px solid #d97706; padding: 12px; border-radius: 6px; margin-bottom: 16px;">'),
          (p +=
            '<div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">⚠️ Threshold Adjustment Recommended</div>'),
          (p +=
            '<div style="font-size: 12px; color: #78350f; margin-bottom: 10px;">' +
            a.recommendation.detail +
            "</div>"),
          a.recommendation.action &&
            ((p +=
              '<div style="font-size: 11px; color: #92400e; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">'),
            (p += "<strong>Action:</strong> " + a.recommendation.action),
            (p += "</div>")),
          (p += '<table style="width: 100%; font-size: 11px; border-collapse: collapse;">'),
          (p += '<thead><tr style="border-bottom: 1px solid #fbbf24;">'),
          (p += '<th style="text-align: left; padding: 4px;">Nutrient</th>'),
          (p += '<th style="text-align: center; padding: 4px;">Standard</th>'),
          (p += '<th style="text-align: center; padding: 4px;">Adjusted</th>'),
          (p += '<th style="text-align: center; padding: 4px;">Change</th>'),
          (p += "</tr></thead><tbody>"));
        (["K", "Mg", "Ca", "S"].forEach(function (e) {
          var t = a.adjustments[e];
          t.factor > 1 &&
            ((p += "<tr>"),
            (p += '<td style="padding: 4px; font-weight: 500;">' + e + "</td>"),
            (p += '<td style="padding: 4px; text-align: center;">' + t.original + " ppm</td>"),
            (p +=
              '<td style="padding: 4px; text-align: center; font-weight: 600; color: #92400e;">' +
              t.adjusted +
              " ppm</td>"),
            (p +=
              '<td style="padding: 4px; text-align: center;">+' +
              Math.round(100 * (t.factor - 1)) +
              "%</td>"),
            (p += "</tr>"));
        }),
          (p += "</tbody></table>"),
          (p += "</div>"));
      }
      return (
        (p += '<details style="margin-top: 12px;">'),
        (p +=
          '<summary style="cursor: pointer; font-weight: 500; color: var(--gaip-text);">Annual Nutrient Harvest (estimated)</summary>'),
        (p +=
          '<div style="margin-top: 8px; padding: 10px; background: var(--gaip-surface-muted); border-radius: 6px;">'),
        (p += '<table style="width: 100%; font-size: 11px; border-collapse: collapse;">'),
        (p += '<thead><tr style="border-bottom: 1px solid var(--gaip-border);">'),
        (p += '<th style="text-align: left; padding: 4px;">Nutrient</th>'),
        (p += '<th style="text-align: right; padding: 4px;">kg/ha/year</th>'),
        (p += '<th style="text-align: right; padding: 4px;">g/m²/year</th>'),
        (p += "</tr></thead><tbody>"),
        ["N", "K", "P", "Ca", "Mg", "S", "Fe", "Mn", "Zn"].forEach(function (e) {
          t.nutrientHarvest.kgPerHa[e] &&
            ((p += "<tr>"),
            (p += '<td style="padding: 4px;">' + e + "</td>"),
            (p +=
              '<td style="padding: 4px; text-align: right;">' +
              t.nutrientHarvest.kgPerHa[e].toFixed(1) +
              "</td>"),
            (p +=
              '<td style="padding: 4px; text-align: right;">' +
              t.nutrientHarvest.gPerM2[e].toFixed(2) +
              "</td>"),
            (p += "</tr>"));
        }),
        (p += "</tbody></table>"),
        (p +=
          '<div style="margin-top: 8px; font-size: 10px; color: var(--gaip-text);">Source: ' +
          t.annualClippingYield.source +
          " from N rate</div>"),
        (p += "</div>"),
        (p += "</details>"),
        (p +=
          '<div style="margin-top: 12px; font-size: 10px; color: var(--gaip-text); border-top: 1px solid var(--gaip-border); padding-top: 8px;">'),
        (p += "Methodology: " + t.methodology.reference),
        (p += "</div>"),
        (p += "</div>")
      );
    },
    
    /**
     * Get nitrogen fertilizer form recommendation based on species, climate, and soil conditions
     * @param {string} species - Normalized species key
     * @param {object} climateData - Temperature and other climate data
     * @param {object} soilData - pH and other soil chemistry data
     * @returns {object} Fertilizer form recommendation with rationale
     */
    getNitrogenFormRecommendation: function(species, climateData, soilData) {
      climateData = climateData || {};
      soilData = soilData || {};
      
      var normalizedSpecies = normalizeSpecies(species);
      var currentTemp = climateData.temperature && climateData.temperature.current || 
                       climateData.temperature && climateData.temperature.mean || 15;
      var soilPH = soilData.pH || 6.5;
      
      // Check if species has specific variety traits with nitrogen form preferences
      var varietyTraits = window.GilbaVarietyTraits && window.GilbaVarietyTraits.getSpeciesTraits ? 
        window.GilbaVarietyTraits.getSpeciesTraits(normalizedSpecies) : null;
      
      var baseTraits = varietyTraits && varietyTraits.base && varietyTraits.base.fertility || {};
      var nitrogenForm = baseTraits.nitrogenForm;
      
      // Special handling for seashore paspalum - nitrate only
      if (normalizedSpecies === 'seashorePaspalum' || nitrogenForm === 'nitrate-preferred') {
        var nitrificationOK = currentTemp > 12.8 && soilPH > 5.5;
        
        return {
          primaryForm: 'nitrate',
          secondaryForms: nitrificationOK ? ['ammonium'] : [],
          rationale: nitrificationOK ? 
            'Nitrate-N strongly preferred. Ammonium/urea acceptable only when soil temp >12.8°C and pH >5.5.' :
            'Nitrate-N ONLY. Soil conditions prevent nitrification (temp ≤12.8°C or pH ≤5.5).',
          source: 'Duncan & Carrow 2005 GCM; Brosnan & Deputy 2008 UH-CTAHR TM-1',
          confidence: 'high'
        };
      }
      
      // Cool-season grasses - flexible but temperature sensitive
      var coolSeasonGrasses = ['bentgrass', 'poaAnnua', 'perennialRyegrass', 'tallFescue', 'fineFescue', 'kentuckyBluegrass'];
      if (coolSeasonGrasses.indexOf(normalizedSpecies) !== -1) {
        var coldConditions = currentTemp < 10 || soilPH < 6.0;
        
        return {
          primaryForm: coldConditions ? 'nitrate' : 'balanced',
          secondaryForms: coldConditions ? ['ammonium'] : ['nitrate', 'ammonium', 'urea'],
          rationale: coldConditions ?
            'Nitrate-N preferred in cool conditions to ensure availability.' :
            'Flexible - nitrate, ammonium, or urea acceptable in favorable conditions.',
          source: 'Standard cool-season fertility principles',
          confidence: 'moderate'
        };
      }
      
      // Warm-season grasses - generally flexible
      return {
        primaryForm: 'balanced',
        secondaryForms: ['nitrate', 'ammonium', 'urea'],
        rationale: 'Standard warm-season program - nitrate, ammonium, or urea acceptable.',
        source: 'Standard warm-season fertility principles',
        confidence: 'moderate'
      };
    },
    
    /**
     * Adjust nutrient rates for irrigation water salinity and species tolerance
     * @param {object} baseRates - Standard nutrient rates
     * @param {string} species - Normalized species key
     * @param {object} waterData - Irrigation water analysis
     * @returns {object} Adjusted rates with explanatory notes
     */
    adjustForSalineIrrigation: function(baseRates, species, waterData) {
      waterData = waterData || {};
      
      var normalizedSpecies = normalizeSpecies(species);
      var ecw = waterData.ECw || waterData.ec || 0;
      var sodium = waterData.Na || waterData.sodium || 0;
      
      // Salinity thresholds (dS/m)
      var moderateSalinity = ecw > 1.5;
      var highSalinity = ecw > 3.0;
      
      // Species salt tolerance
      var saltTolerantSpecies = ['seashorePaspalum', 'bermuda', 'ultradwarfBermuda', 'kikuyu', 'zoysia'];
      var isSaltTolerant = saltTolerantSpecies.indexOf(normalizedSpecies) !== -1;
      
      if (!moderateSalinity) {
        return {
          N: baseRates.N,
          K: baseRates.K,
          P: baseRates.P,
          adjustments: [],
          notes: 'No salinity adjustments needed (ECw < 1.5 dS/m)'
        };
      }
      
      var adjustedRates = {
        N: baseRates.N,
        K: baseRates.K,
        P: baseRates.P
      };
      var adjustments = [];
      
      // Nitrogen reduction for saline irrigation
      if (moderateSalinity) {
        var nReduction = isSaltTolerant ? 0.15 : 0.25; // 15% vs 25% reduction
        adjustedRates.N = baseRates.N * (1 - nReduction);
        adjustments.push('N reduced ' + Math.round(nReduction * 100) + '% for ECw ' + ecw.toFixed(1) + ' dS/m irrigation');
      }
      
      // Potassium increase for leaching
      if (moderateSalinity) {
        var kIncrease = 0.2; // 20% increase for leaching
        adjustedRates.K = baseRates.K * (1 + kIncrease);
        adjustments.push('K increased 20% to compensate for leaching from frequent irrigation');
      }
      
      // Calcium recommendations for sodium
      if (sodium > 100) {
        adjustments.push('Gypsum application recommended (Na ' + sodium.toFixed(0) + ' mg/L)');
      }
      
      return {
        N: adjustedRates.N,
        K: adjustedRates.K,
        P: adjustedRates.P,
        adjustments: adjustments,
        notes: 'Salinity adjustments for ' + (isSaltTolerant ? 'salt-tolerant' : 'salt-sensitive') + ' species'
      };
    },
    
    SPECIES_TISSUE_CONCENTRATIONS: SPECIES_TISSUE_CONCENTRATIONS,
    SPECIES_CLIPPING_FACTORS: SPECIES_CLIPPING_FACTORS,
    SPECIES_ALIASES: SPECIES_ALIASES,
    TISSUE_CONCENTRATIONS: {
      greens: SPECIES_TISSUE_CONCENTRATIONS.creepingBentgrass,
      sports: SPECIES_TISSUE_CONCENTRATIONS.perennialRyegrass,
    },
    BASELINE_N_RATES: BASELINE_N_RATES,
    MLSN_THRESHOLDS: MLSN_THRESHOLDS,
    VERSION: "2.0.0",
  };
}),
  "undefined" != typeof window &&
    (window.GilbaNutrientDemandEngine =
      window.GilbaNutrientDemandEngine || this.GilbaNutrientDemandEngine));

// Expose new seashore paspalum nutrition functions for global access
if (typeof window !== "undefined" && window.GilbaNutrientDemandEngine) {
  window.gaip_getNitrogenFormRecommendation = window.GilbaNutrientDemandEngine.getNitrogenFormRecommendation;
  window.gaip_adjustForSalineIrrigation = window.GilbaNutrientDemandEngine.adjustForSalineIrrigation;
}
