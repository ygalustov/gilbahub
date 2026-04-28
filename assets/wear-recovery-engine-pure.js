/**
 * GILBA WEAR & RECOVERY ENGINE - PURE EXTRACTED v3.0.0
 * 
 * Pure-function wear/recovery engine. No DOM reads, no global mutation.
 * Every calculation is a pure function: f(state, shadeData, irrigationData, otherData) → result
 * 
 * Extracted from wear-recovery-engine.js v2.0.0.
 * All global fallbacks REMOVED. State injection is the ONLY input path.
 * 
 * Required state fields:
 *   state.turf.grassSpecies   - grass species string
 *   state.site.construction   - soil/pipe_drained/sand_profile/sand_carpet/hybrid
 *   state.traffic             - match/training schedule
 * 
 * Optional state fields:
 *   state.monthIndex          - 0-11 month override (REQUIRED in pure, no Date() fallback)
 *   state._varietyTraits      - { getWearModifier(species, variety) } provider
 *   state.turf.coolOverseed   - overseed species
 *   state.turf.percentC3Cover - overseed percentage
 *   state.turf.poaPercent     - Poa annua contamination %
 *   state.turf.hoc            - height of cut (mm)
 * 
 * References:
 *   NTEP variety trial data (wear tolerance, recovery scores)
 *   Sport-specific wear factors based on published field studies
 */
!(function() {
  "use strict";
  const e = {
      version: "2.0.0",
      carryingCapacity: {
        soil: 3.5,
        pipe_drained: 4.5,
        sand_profile: 7.8,
        sand_carpet: 12.5,
        hybrid: 20,
      },
      poaAnnuaParams: {
        wearTolerance: 5.5,
        recovery: 5,
        summerPenalty: 0.4,
        shallowRootPenalty: 1.25,
      },
      speciesSeasonModifier: {
        ryegrass: {
          summer: 0.5,
          autumn: 0.85,
          winter: 1,
          spring: 0.95
        },
        tallFescue: {
          summer: 0.55,
          autumn: 0.85,
          winter: 1,
          spring: 0.9
        },
        bentgrass: {
          summer: 0.4,
          autumn: 0.8,
          winter: 0.9,
          spring: 1
        },
        couch: {
          summer: 2,
          autumn: 1.2,
          winter: 0.4,
          spring: 1
        },
        kikuyu: {
          summer: 1.8,
          autumn: 1.2,
          winter: 0.4,
          spring: 1
        },
        buffalo: {
          summer: 1.5,
          autumn: 1,
          winter: 0.5,
          spring: 0.9
        },
        poaAnnua: {
          summer: 0.3,
          autumn: 0.7,
          winter: 0.85,
          spring: 0.8
        },
        generic: {
          summer: 1.4,
          autumn: 1,
          winter: 0.7,
          spring: 1
        },
      },
      baseAerationWeeks: {
        soil: 6,
        pipe_drained: 8,
        sand_profile: 10,
        sand_carpet: 14,
        hybrid: 12,
      },
      optimalTemp: {
        C3: 18,
        C4: 28
      },
      optimalHOC: {
        couch: 25,
        kikuyu: 35,
        ryegrass: 40,
        tallFescue: 50,
        bentgrass: 4,
      },
      stressThresholds: {
        recovering: -5,
        stable: 5,
        stressed: 15,
        critical: 30,
      },
    },
    t = {
      poaAnnua: {
        generic: {
          tolerance: 5.5,
          wear: 5.5,
          recovery: 5
        }
      },
      couch: {
        TifTuf: {
          tolerance: 9.2,
          wear: 8.8,
          recovery: 9
        },
        "Tahoma 31": {
          tolerance: 8.9,
          wear: 8.6,
          recovery: 8.8
        },
        "Iron Cutter": {
          tolerance: 8.7,
          wear: 8.4,
          recovery: 8.2
        },
        Wintergreen: {
          tolerance: 8.5,
          wear: 8.3,
          recovery: 8.6
        },
        "Santa Ana": {
          tolerance: 8.3,
          wear: 8,
          recovery: 8.2
        },
        Patriot: {
          tolerance: 8.1,
          wear: 7.8,
          recovery: 8
        },
        Legend: {
          tolerance: 8,
          wear: 7.7,
          recovery: 7.9
        },
        "CT-2": {
          tolerance: 7.8,
          wear: 7.5,
          recovery: 7.7
        },
        generic: {
          tolerance: 8,
          wear: 7.8,
          recovery: 8
        },
      },
      kikuyu: {
        Kenda: {
          tolerance: 8.7,
          wear: 8.9,
          recovery: 8.5
        },
        "Village Green": {
          tolerance: 8.5,
          wear: 8.7,
          recovery: 8.3
        },
        Whittet: {
          tolerance: 8.3,
          wear: 8.5,
          recovery: 8.1
        },
        Hostyn: {
          tolerance: 8.4,
          wear: 8.6,
          recovery: 8.2
        },
        generic: {
          tolerance: 8.4,
          wear: 8.6,
          recovery: 8.3
        },
      },
      ryegrass: {
        Intense: {
          tolerance: 8.8,
          wear: 9.2,
          recovery: 8.5
        },
        "Derby Xtreme": {
          tolerance: 8.6,
          wear: 8.9,
          recovery: 8.3
        },
        "Allstar Forte": {
          tolerance: 8.4,
          wear: 8.7,
          recovery: 8.1
        },
        Soprano: {
          tolerance: 8.2,
          wear: 8.5,
          recovery: 7.9
        },
        Pinnacle: {
          tolerance: 8,
          wear: 8.3,
          recovery: 7.7
        },
        "Fastball RGL": {
          tolerance: 8.5,
          wear: 8.8,
          recovery: 8.2
        },
        "Paragon GLR": {
          tolerance: 8.3,
          wear: 8.6,
          recovery: 8
        },
        generic: {
          tolerance: 8.2,
          wear: 8.5,
          recovery: 8
        },
      },
      tallFescue: {
        "Regiment II": {
          tolerance: 7.9,
          wear: 8.2,
          recovery: 7.6
        },
        "Spyder 2LS": {
          tolerance: 8.4,
          wear: 8.7,
          recovery: 8.1
        },
        RTF: {
          tolerance: 8.5,
          wear: 8.9,
          recovery: 8.3
        },
        "Titanium 2LS": {
          tolerance: 8.3,
          wear: 8.6,
          recovery: 8
        },
        generic: {
          tolerance: 8,
          wear: 8.5,
          recovery: 7.8
        },
      },
    },
    r = {
      afl: {
        name: "AFL",
        factor: 1.35,
        description: "Largest ground, longest game, most ground contact",
        typicalDuration: 2,
        typicalPlayers: 36,
        wearPattern: "distributed",
      },
      rugby_league: {
        name: "Rugby League",
        factor: 1.3,
        description: "High impact tackles, scrums, concentrated play",
        typicalDuration: 1.5,
        typicalPlayers: 26,
        wearPattern: "concentrated",
      },
      rugby_union: {
        name: "Rugby Union",
        factor: 1.25,
        description: "Set pieces, rucks, mauls",
        typicalDuration: 1.75,
        typicalPlayers: 30,
        wearPattern: "concentrated",
      },
      soccer: {
        name: "Soccer",
        factor: 1,
        description: "Baseline sport",
        typicalDuration: 1.5,
        typicalPlayers: 22,
        wearPattern: "goal_mouth",
      },
      training_full: {
        name: "Full Training (match sim)",
        factor: 0.7,
        description: "Full-field scrimmage, match simulation",
        typicalDuration: 1.5,
        wearPattern: "variable",
      },
      training_drills: {
        name: "Skills & Drills",
        factor: 0.5,
        description: "Rotated skill work, technical training",
        typicalDuration: 1.5,
        wearPattern: "rotated",
      },
      training_light: {
        name: "Light Training",
        factor: 0.3,
        description: "Warm-up, stretching, tactical walk-through",
        typicalDuration: 1,
        wearPattern: "minimal",
      },
    },
    i = {
      junior: 0.6,
      youth: 0.8,
      adult: 1,
      masters: 0.9
    },
    a = {
      small: 0.85,
      medium: 1,
      large: 1.2
    },
    o = {
      dry: 0.8,
      slightly_dry: 0.9,
      optimal: 1,
      moist: 1.15,
      wet: 1.4,
      saturated: 1.8,
    },
    s = {
      dry: 1.1,
      slightly_dry: 1,
      optimal: 0.95,
      moist: 1.05,
      wet: 1.25,
      saturated: 1.6,
    },
    n = {
      none: 1,
      pre_seed: 1,
      germinating: 0.25,
      establishing: 0.4,
      immature: 0.65,
      maturing: 0.85,
      mature: 0.95,
      transitioning: 0.75,
      fading: 0.8,
      dead: 1,
    };

  function c(e, t, r) {
    return Math.max(t, Math.min(r, e));
  }

  function l(e, t) {
    var r = parseFloat(e);
    return isFinite(r) ? r : t;
  }

  // v1.9.0: Enhanced to return blend info for recovery calculations
  function u(e) {
    const t = e.turf?.grassSpecies || "couch",
      r = e.turf?.coolOverseed || e.turf?.overseedSpecies || "",
      i = e.turf?.percentC3Cover || (e.turf?.c3Fraction ? e.turf.c3Fraction * 100 : 0);
    
    // Return blend info object for proper blending in recovery calculations
    const blendInfo = {
      baseSpecies: t,
      overseedSpecies: r || "ryegrass",
      c3Fraction: i / 100,
      isBlend: i >= 20 && r,
      effectiveSpecies: i > 50 && r ? r : t
    };
    
    if (blendInfo.isBlend) {
    }
    
    return blendInfo.effectiveSpecies;
  }
  
  // v1.9.0: Get blend info for recovery modifier calculations
  function getBlendInfo(e) {
    const t = e.turf?.grassSpecies || "couch",
      r = e.turf?.coolOverseed || e.turf?.overseedSpecies || "",
      i = e.turf?.percentC3Cover || (e.turf?.c3Fraction ? e.turf.c3Fraction * 100 : 0),
      summerIntent = e.turf?.summerIntent || "transition";
    
    return {
      baseSpecies: t,
      overseedSpecies: r || "ryegrass",
      c3Fraction: i / 100,
      c4Fraction: 1 - (i / 100),
      isBlend: i >= 20,
      summerIntent: summerIntent,
      effectiveSpecies: i > 50 && r ? r : t
    };
  }
  
  // v1.9.0: Get blended season modifier for overseed scenarios
  function getBlendedSeasonModifier(state, season) {
    const blend = getBlendInfo(state);
    const seasonKey = season || m();
    
    if (!blend.isBlend) {
      // Pure stand - use single species modifier
      const speciesKey = g(blend.baseSpecies);
      return (e.speciesSeasonModifier[speciesKey] || e.speciesSeasonModifier.generic)[seasonKey] || 1;
    }
    
    // Blend scenario - weighted average of both species
    const baseKey = g(blend.baseSpecies);
    const overseedKey = g(blend.overseedSpecies);
    
    const baseMod = (e.speciesSeasonModifier[baseKey] || e.speciesSeasonModifier.generic)[seasonKey] || 1;
    const overseedMod = (e.speciesSeasonModifier[overseedKey] || e.speciesSeasonModifier.ryegrass)[seasonKey] || 1;
    
    // For "maintain" intent in summer, weight towards C3 needs
    let effectiveC3 = blend.c3Fraction;
    if (blend.summerIntent === "maintain" && seasonKey === "summer") {
      effectiveC3 = Math.max(blend.c3Fraction, 0.5); // At least 50% weight to C3 if maintaining
    }
    
    const blendedMod = (baseMod * blend.c4Fraction) + (overseedMod * effectiveC3);
    
    return blendedMod;
  }

  function d(e) {
    const t = (e || "").toLowerCase();
    return ["couch", "kikuyu", "bermuda", "buffalo", "zoysia"].some((e) =>
        t.includes(e),
      ) ?
      "C4" :
      ["ryegrass", "tallFescue", "bentgrass", "bluegrass", "fescue"].some(
        (e) => t.includes(e),
      ) ?
      "C3" :
      "C4";
  }

  function g(e) {
    const t = (e || "").toLowerCase().replace(/\s+/g, "");
    return t.includes("couch") || t.includes("bermuda") ?
      "couch" :
      t.includes("kikuyu") ?
      "kikuyu" :
      t.includes("ryegrass") ?
      "ryegrass" :
      t.includes("fescue") ?
      "tallFescue" :
      t.includes("buffalo") ?
      "buffalo" :
      "generic";
  }

  // v3.0.0 pure: monthIndex REQUIRED - no Date() fallback
  let _monthOverride = null;
  function m(monthIdx) {
    const e = (typeof monthIdx === 'number') ? monthIdx : 
              (typeof _monthOverride === 'number') ? _monthOverride :
              -1;
    if (e < 0 || e > 11) throw new Error('wear-recovery-engine-pure: state.monthIndex is required (0-11)');
    return e >= 11 || e <= 1 ?
      "summer" :
      e >= 2 && e <= 4 ?
      "autumn" :
      e >= 5 && e <= 7 ?
      "winter" :
      "spring";
  }

  // v3.0.0 pure: Accept varietyTraits provider via state._varietyTraits ONLY
  let _varietyTraitsProvider = null;
  function f(e, r) {
    const i = e.toLowerCase().replace(/\s+/g, "");
    const vt = _varietyTraitsProvider || null;
    if (vt) {
      const t = vt.getWearModifier(e, r);
      if ("none" !== t.confidence) {
        const e = 8,
          r = e / t.multiplier,
          i = e / (t.recoveryMultiplier || 1);
        return {
          tolerance: c((r + i) / 2, 4, 10),
          wear: c(r, 4, 10),
          recovery: c(i, 4, 10),
          confidence: t.confidence,
          source: t.source,
          _fromVarietyTraits: !0,
          _warning: t._warning,
        };
      }
    }
    const a = t[i];
    if (!a) return {
      tolerance: 7.5,
      wear: 7.5,
      recovery: 7.5
    };
    if (a[r]) return a[r];
    const o = (r || "").toLowerCase();
    for (const e of Object.keys(a))
      if (e.toLowerCase() === o) return a[e];
    return a.generic || {
      tolerance: 7.5,
      wear: 7.5,
      recovery: 7.5
    };
  }

  function y(t, r, i, a, state) {
    const o = e.carryingCapacity[t] || e.carryingCapacity.soil,
      s = g(r),
      n = d(r),
      c = i || m();
    
    // v1.9.0: Use blended season modifier if state is provided
    let l = state ? 
      getBlendedSeasonModifier(state, c) :
      (e.speciesSeasonModifier[s] || e.speciesSeasonModifier.generic)[c] || 1;
    
    let u = null;
    if ("C4" === n && a) {
      if ("winter" === c || "autumn" === c) {
        const t = e.speciesSeasonModifier.ryegrass[c] || 0.85;
        switch (a) {
          case "mature":
            ((l = 1.1 * t), (u = "Mature overseed providing winter capacity"));
            break;
          case "maturing":
            ((l = 0.85 * t), (u = "Maturing overseed - capacity building"));
            break;
          case "immature":
            ((l = Math.max(l, 0.5 * t)),
              (u = "Immature overseed - limited capacity boost"));
            break;
          case "establishing":
          case "germinating":
            u = "Overseed establishing - no capacity boost yet";
            break;
          case "transitioning":
            ((l = Math.max(l, 0.6 * t)),
              (u = "Spring transition - mixed capacity"));
            break;
          case "fading":
            ((l = Math.max(l, 0.7)),
              (u = "Overseed fading - couch recovering"));
        }
      }
    }
    const f = o * l;
    return {
      base: o,
      seasonModifier: l,
      effective: Math.round(10 * f) / 10,
      species: s,
      season: c,
      construction: t,
      overseedStatus: a || "none",
      overseedNote: u,
    };
  }

  function p(e) {
    let t = 0;
    const o = [];
    if (e.events && Array.isArray(e.events))
      for (const s of e.events) {
        const e = r[s.type] || r.soccer,
          n = i[s.ageGroup] || 1,
          c = a[s.teamSize] || 1,
          u = l(s.duration, e.typicalDuration),
          d = l(s.count, 1),
          g = u * d * e.factor * n * c;
        ((t += g),
          o.push({
            type: s.type,
            name: e.name,
            rawHours: u * d,
            effectiveHours: g,
            factor: e.factor,
            ageFactor: n,
            teamFactor: c,
          }));
      }
    if (e.training && Array.isArray(e.training))
      for (const s of e.training) {
        const e = r[s.type] || r.training_drills,
          n = i[s.ageGroup] || 1,
          u = a[s.teamSize] || 1,
          d = c(l(s.rotation, 100), 10, 100),
          g = 1 + 0.6 * (1 - d / 100),
          m = l(s.duration, e.typicalDuration),
          f = l(s.count, 1),
          y = m * f * e.factor * n * u * g;
        ((t += y),
          o.push({
            type: s.type,
            name: e.name,
            rawHours: m * f,
            effectiveHours: y,
            factor: e.factor,
            rotationPercent: d,
            rotationFactor: g,
            ageFactor: n,
            teamFactor: u,
          }));
      }
    if (void 0 !== e.matchesPerWeek) {
      const s = e.matchCode || "soccer",
        n = r[s] || r.soccer,
        c = i[e.ageGroup] || 1,
        u = a[e.teamSize] || 1,
        d = l(e.matchesPerWeek, 0) * l(e.matchDuration, n.typicalDuration),
        g = d * n.factor * c * u;
      d > 0 &&
        ((t += g),
          o.push({
            type: s,
            name: n.name + " (matches)",
            rawHours: d,
            effectiveHours: g,
            factor: n.factor,
          }));
    }
    if (void 0 !== e.sessionsPerWeek) {
      const s = e.trainingCode || "training_drills",
        n = r[s] || r.training_drills,
        u = i[e.ageGroup] || 1,
        d = a[e.teamSize] || 1,
        g = c(l(e.trainingRotation, 100), 10, 100),
        m = 1 + 0.6 * (1 - g / 100),
        f = l(e.sessionsPerWeek, 0) * l(e.sessionDuration, n.typicalDuration),
        y = f * n.factor * u * d * m;
      f > 0 &&
        ((t += y),
          o.push({
            type: s,
            name: n.name,
            rawHours: f,
            effectiveHours: y,
            factor: n.factor,
            rotationPercent: g,
            rotationFactor: m,
          }));
    }
    return {
      totalEffectiveHours: t,
      breakdown: o
    };
  }

  function h(t, r, i) {
    const a = u(t),
      o = t.turf?.variety || "generic",
      s = l(t.turf?.heightOfCut, 30),
      g = f(a, o);
    let m = g.wear;
    const y = d(a),
      p = e.optimalHOC[a.toLowerCase()] || ("C3" === y ? 40 : 25),
      h = s / p;
    let w = 1;
    ((w =
        h >= 1.2 ?
        1.05 :
        h >= 1 ?
        1 :
        h >= 0.8 ?
        0.92 :
        h >= 0.6 ?
        0.8 :
        h >= 0.4 ?
        0.65 :
        0.5),
      (m *= w));
    let v = 1;
    if (r && void 0 !== r.growthPotential) {
      const e = r.growthPotential / 100;
      v =
        e >= 0.8 ? 1.05 : e >= 0.6 ? 1 : e >= 0.4 ? 0.9 : e >= 0.2 ? 0.75 : 0.6;
    } else if (void 0 !== t.turf?.growthMultiplier) {
      const e = t.turf.growthMultiplier;
      v =
        e >= 0.8 ? 1.05 : e >= 0.6 ? 1 : e >= 0.4 ? 0.9 : e >= 0.2 ? 0.75 : 0.6;
    }
    m *= v;
    let b = 1;
    if (i && void 0 !== i.stressFactor) {
      b = 1 - 0.35 * c(i.stressFactor, 0, 1);
    } else if (void 0 !== t.shade?.dli) {
      const e = l(t.shade.dli, 30),
        r = "C3" === y ? 12 : 20;
      b = e >= 1.5 * r ? 1 : e >= r ? 0.9 : e >= 0.7 * r ? 0.75 : 0.6;
    }
    m *= b;
    const k = t.turf?.overseedStatus || "none",
      M = n[k] || 1;
    m *= M;
    let _ = 1;
    if (void 0 !== t.turf?.rootDepth) {
      const e = l(t.turf.rootDepth, 100),
        r = "C4" === y ? 150 : 100;
      _ =
        e >= 1.5 * r ?
        1.1 :
        e >= r ?
        1 :
        e >= 0.7 * r ?
        0.9 :
        e >= 0.5 * r ?
        0.8 :
        0.7;
    }
    return (m *= _);
    let E = 1,
      L = null;
    const $ = l(t.turf?.poaPercent, 0);
    if ($ > 0) {
      const e = 5.5,
        t = $ / 100,
        r = m * (1 - t) + e * t;
      ((E = r / m),
        (m = r),
        (L = {
          percent: $,
          baseScore: m / E,
          blendedScore: m,
          modifier: E
        }));
    }
    return {
      score: c(m, 1, 10),
      baseNTEP: g.wear,
      modifiers: {
        hoc: {
          value: w,
          ratio: h,
          actual: s,
          optimal: p
        },
        growth: v,
        shade: b,
        overseed: {
          value: M,
          status: k
        },
        rootDepth: _,
        poa: L,
      },
    };
  }

  function w(e, t, r) {
    const i = t.site?.construction || "soil",
      a = y(i, u(t), t.site?.season || m(), t.turf?.overseedStatus || "none"),
      n = a.effective,
      l = e / n;
    let d = "optimal";
    if (r && void 0 !== r.soilMoisture) {
      const e = r.soilMoisture;
      d =
        e > 80 ?
        "saturated" :
        e > 60 ?
        "wet" :
        e > 40 ?
        "moist" :
        e > 25 ?
        "optimal" :
        e > 10 ?
        "slightly_dry" :
        "dry";
    } else t.site?.soilMoisture && (d = t.site.soilMoisture);
    const g = o[d] || 1,
      f = s[d] || 1;
    let p;
    const h = l * g;
    return (
      (p =
        h <= 0.4 ?
        50 * h :
        h <= 0.7 ?
        20 + 100 * (h - 0.4) :
        h <= 1 ?
        50 + 100 * (h - 0.7) :
        80 + Math.min(20, 50 * (h - 1))), {
        riskPercent: c(Math.round(p), 0, 100),
        usageRatio: l,
        adjustedRatio: h,
        maxHours: n,
        capacityData: a,
        construction: i,
        moisture: {
          level: d,
          compactionFactor: g,
          wearFactor: f
        },
      }
    );
  }

  function v(e, t, r, i) {
    // v1.9.0: Use blended recovery for overseed scenarios
    const blend = getBlendInfo(e);
    const a = u(e);
    
    // Get recovery rating - blend if overseed active
    let o;
    if (blend.isBlend && blend.c3Fraction >= 0.2) {
      const baseRecovery = f(blend.baseSpecies, e.turf?.variety || "generic").recovery;
      const overseedRecovery = f(blend.overseedSpecies, e.turf?.overseedVariety || "generic").recovery;
      
      // Weight by species fraction, but also consider summer intent
      let effectiveC3 = blend.c3Fraction;
      const season = m();
      if (blend.summerIntent === "maintain" && season === "summer") {
        effectiveC3 = Math.max(blend.c3Fraction, 0.5);
      }
      
      o = (baseRecovery * blend.c4Fraction) + (overseedRecovery * effectiveC3);
    } else {
      o = f(a, e.turf?.variety || "generic").recovery;
    }
    
    const s = 16 - 1.4 * o;
    let n = 1;
    if (t && void 0 !== t.growthPotential) {
      const e = t.growthPotential / 100;
      n =
        e >= 0.9 ? 0.7 : e >= 0.7 ? 0.85 : e >= 0.5 ? 1 : e >= 0.3 ? 1.5 : 2.5;
    } else if (void 0 !== e.turf?.growthMultiplier) {
      const t = e.turf.growthMultiplier;
      n =
        t >= 0.9 ? 0.7 : t >= 0.7 ? 0.85 : t >= 0.5 ? 1 : t >= 0.3 ? 1.5 : 2.5;
    }
    let y = 1;
    if (r && void 0 !== r.stressFactor) {
      y = 1 + 0.8 * c(r.stressFactor, 0, 1);
    }
    let p = 1;
    if (void 0 !== e.turf?.rootDepth) {
      const t = d(a),
        r = l(e.turf.rootDepth, 100),
        i = "C4" === t ? 150 : 100;
      p = r >= 1.5 * i ? 0.85 : r >= i ? 1 : r >= 0.7 * i ? 1.15 : 1.35;
    }
    let h = 1;
    const w = l(e.soil?.LOI, 0) || l(e.soil?.OM_pct, 0),
      v = e.turf?.construction || "native",
      b =
      "sand_carpet" === v ||
      "usga" === v ||
      "sand_based" === v ||
      "links" === v;
    w > 0 &&
      (h = b ?
        w >= 3 ?
        0.9 :
        w >= 2 ?
        0.95 :
        w >= 1.5 ?
        1 :
        w >= 1 ?
        1.1 :
        1.2 :
        w >= 4 ?
        0.9 :
        w >= 3 ?
        1 :
        w >= 2 ?
        1.1 :
        1.25);
    let k = 1;
    k = {
      dry: 1.2,
      slightly_dry: 1.05,
      optimal: 1,
      moist: 1.05,
      wet: 1.35,
      saturated: 1.7,
    } [e.site?.soilMoisture || "optimal"] || 1;
    let M = 1,
      _ = "default",
      C = null;
    const P = {
        couch: {
          deficient: 2.5,
          low: 3,
          optimal: 3.65,
          high: 4.3
        },
        bermuda: {
          deficient: 2.5,
          low: 3,
          optimal: 3.65,
          high: 4.3
        },
        kikuyu: {
          deficient: 2.7,
          low: 3.2,
          optimal: 3.8,
          high: 4.5
        },
        buffalo: {
          deficient: 2.5,
          low: 3,
          optimal: 3.5,
          high: 4.2
        },
        bentgrass: {
          deficient: 3.5,
          low: 4,
          optimal: 4.5,
          high: 5
        },
        ryegrass: {
          deficient: 2.8,
          low: 3.34,
          optimal: 4.2,
          high: 5.1
        },
        tallFescue: {
          deficient: 3,
          low: 3.5,
          optimal: 4.3,
          high: 5
        },
        poa: {
          deficient: 3,
          low: 3.5,
          optimal: 4,
          high: 4.5
        },
        generic: {
          deficient: 3,
          low: 3.5,
          optimal: 4.25,
          high: 5
        },
      },
      F = P[g(a)] || P.generic,
      x = e.tissue?.N;
    if (x && x > 0)
      ((_ = "tissue"),
        x < F.deficient ?
        ((M = 1.5),
          (C =
            "Tissue N critically low (" +
            x.toFixed(1) +
            "% vs " +
            F.low.toFixed(1) +
            "% minimum) - limiting recovery")) :
        x < F.low ?
        ((M = 1.3),
          (C =
            "Tissue N deficient (" +
            x.toFixed(1) +
            "%) - slowing recovery")) :
        x < F.optimal ?
        ((M = 1.1), (C = "Tissue N adequate (" + x.toFixed(1) + "%)")) :
        x <= F.high ?
        ((M = 1), (C = "Tissue N optimal (" + x.toFixed(1) + "%)")) :
        ((M = 0.95),
          (C =
            "Tissue N high (" +
            x.toFixed(1) +
            "%) - good recovery potential")));
    else if (e.fertility?.monthlyN > 0 && void 0 !== t?.growthPotential) {
      _ = "fertility";
      const r = e.fertility.monthlyN,
        i = t.growthPotential / 100,
        o = (r / (("C4" === d(a) ? 50 : 40) * Math.max(0.1, i))) * 100;
      o < 40 ?
        ((M = 1.35),
          (C =
            "N application (" +
            r +
            " kg/ha) well below capacity - limiting recovery")) :
        o < 70 ?
        ((M = 1.15), (C = "N application may be limiting recovery")) :
        o <= 120 ?
        ((M = 1), (C = "N program adequate for current growth")) :
        ((M = 0.95), (C = "N program supporting recovery"));
    } else if (w > 0) {
      _ = "om_estimate";
      const e = {
        summer: 1.2,
        autumn: 1,
        winter: 0.5,
        spring: 0.9
      } [m()] || 1;
      (w >= (b ? 2.5 : 4) ?
        ((M = 1 / e), (C = "Good OM mineralisation expected")) :
        w >= (b ? 1.5 : 2.5) ?
        ((M = 1.1 / e), (C = "Moderate OM - some N limitation possible")) :
        ((M = b ? 1.15 : 1.25),
          (C = "Low OM - N likely limiting without regular applications")),
        h > 1 && (h = 1 + 0.5 * (h - 1)));
    }
    let S = 1,
      R = null;
    e.salinityPenalty &&
      e.salinityPenalty.active &&
      ((S = 1 / e.salinityPenalty.growthModifier),
        (R =
          "ECw " +
          (e.salinityPenalty.ecw || "?").toFixed(1) +
          " dS/m → " +
          e.salinityPenalty.penaltyPct.toFixed(0) +
          "% yield reduction extending recovery"));
    let T = 1;
    if (
      e.stressAggregates &&
      e.stressAggregates.environmentalStressIndex > 20
    ) {
      T = 1 + ((e.stressAggregates.environmentalStressIndex - 20) / 60) * 0.5;
    }
    let q = 1,
      O = null;
    const j = l(e.turf?.poaPercent, 0);
    if (j > 0) {
      const e = m(),
        t = j / 100,
        r = "summer" === e ? 1.6 : "spring" === e ? 1.3 : 1.15,
        i = 1 * (1 - t) + r * t;
      ((q = i),
        (O = {
          percent: j,
          season: e,
          baseFactor: r,
          blendedFactor: i
        }));
    }
    return {
      days: c(Math.ceil(s * n * y * p * h * k * M * S * T * q), 1, 28),
      baseDays: s,
      baseRating: o,
      modifiers: {
        growth: n,
        shade: y,
        rootDepth: p,
        soilHealth: h,
        moisture: k,
        nitrogen: {
          factor: M,
          source: _,
          note: C
        },
        salinity: {
          factor: S,
          note: R
        },
        temperatureStress: {
          factor: T,
          esi: e.stressAggregates?.environmentalStressIndex || 0,
        },
        poa: O,
      },
    };
  }

  function b(t, r, i) {
    const a = e.carryingCapacity[i] || e.carryingCapacity.soil;
    let o = 0;
    const s = [];
    if (Array.isArray(t))
      for (const e of t) {
        const t = l(e.load, 0) - l(e.capacity, a);
        ((o += t),
          s.push({
            load: e.load,
            capacity: e.capacity || a,
            balance: -t
          }));
      }
    else if (t && void 0 !== t.weekCount) {
      o = l(t.weekCount, 0) * (l(t.avgLoad, 0) - l(t.avgCapacity, a));
    }
    let n, c;
    o <= e.stressThresholds.recovering ?
      ((n = "recovering"), (c = "#2e7d32")) :
      o <= e.stressThresholds.stable ?
      ((n = "stable"), (c = "#4caf50")) :
      o <= e.stressThresholds.stressed ?
      ((n = "stressed"), (c = "#ffc107")) :
      ((n = "critical"), (c = "#e53935"));
    const u = o > 0 ? Math.ceil(o / r) : 0;
    return {
      debtHours: Math.round(10 * o) / 10,
      status: n,
      statusColor: c,
      weeksToRecover: u,
      weeklyHistory: s,
    };
  }

  function k(e, t, r) {
    const i = e.riskPercent,
      a = 100 * (1 - (t.score - 1) / 9);
    let o,
      s,
      n = Math.round(0.65 * i + 0.35 * a);
    return (
      "critical" === r.status ?
      (n = Math.min(100, n + 20)) :
      "stressed" === r.status && (n = Math.min(100, n + 10)),
      n >= 70 ?
      ((o = "High"), (s = "#e53935")) :
      n >= 40 ?
      ((o = "Medium"), (s = "#ffc107")) :
      ((o = "Low"), (s = "#2e7d32")), {
        score: n,
        priority: o,
        color: s,
        components: {
          physical: i,
          biological: a
        },
      }
    );
  }
  ((window.gaip_wear_recovery_engine = function(t, r, i, a) {
      // v2.0.0: Accept monthIndex and varietyTraits from state to avoid globals
      if (typeof t.monthIndex === 'number') _monthOverride = t.monthIndex;
      if (t._varietyTraits) _varietyTraitsProvider = t._varietyTraits;
      
      const o = {
          matchesPerWeek: l(t.traffic?.matchesPerWeek, 0),
          matchDuration: l(t.traffic?.matchDuration, 1.5),
          matchCode: t.traffic?.matchCode || "soccer",
          sessionsPerWeek: l(t.traffic?.sessionsPerWeek, 0),
          sessionDuration: l(t.traffic?.sessionDuration, 1.5),
          trainingCode: t.traffic?.trainingCode || "training_drills",
          trainingRotation: l(t.traffic?.trainingRotation, 100),
          ageGroup: t.traffic?.ageGroup || "adult",
          teamSize: t.traffic?.teamSize || "medium",
          events: t.traffic?.events,
          training: t.traffic?.training,
        },
        s = p(o),
        n = h(t, r, i),
        u = w(s.totalEffectiveHours, t, r),
        d = v(t, r, i),
        g = (function(e, t) {
          const r = e?.stressFactor || 0,
            i = t.riskPercent / 100;
          if (r < 0.2 || i < 0.3)
            return {
              compoundFactor: 1 + 0.3 * r + 0.3 * i,
              isCompounding: !1
            };
          const a = r * i * 1.5,
            o = r + i + a;
          return {
            compoundFactor: 1 + Math.min(1.5, o),
            isCompounding: !0,
            shadeContribution: r,
            trafficContribution: i,
            synergy: a,
          };
        })(i, u),
        m = t.site?.construction || "soil",
        f = b(t.traffic?.priorWeeks || [], 7 / d.days, m),
        y = k(u, n, f),
        M = (function(t, r, i) {
          const a = e.baseAerationWeeks[i] || 10;
          let o = a;
          return (
            t.adjustedRatio > 1 ?
            (o = Math.max(
              2,
              Math.round(a / (1 + 0.8 * (t.adjustedRatio - 1))),
            )) :
            t.adjustedRatio > 0.7 ?
            (o = Math.max(3, Math.round(0.85 * a))) :
            t.adjustedRatio <= 0.4 &&
            (o = Math.min(16, Math.round(1.2 * a))),
            "critical" === r.status ?
            (o = Math.max(2, o - 2)) :
            "stressed" === r.status && (o = Math.max(2, o - 1)), {
              recommendedWeeks: o,
              baseWeeks: a,
              reason: t.adjustedRatio > 0.7 ?
                "Reduced interval due to high usage" :
                "Standard interval for construction type",
            }
          );
        })(u, f, m),
        _ = l(t.traffic?.restDays, 2) / d.days;
      let C = c(Math.round(100 * _), 5, 95);
      "critical" === f.status ?
        (C = Math.max(5, C - 25)) :
        "stressed" === f.status && (C = Math.max(5, C - 15));
      const P = (function(e, t, r, i, a, o) {
        const s = [];
        e.riskPercent >= 70 ?
          s.push({
            type: "critical",
            category: "load",
            text: "Field is over capacity. Reduce events or rest immediately.",
            action: "Reduce weekly hours by " +
              Math.round((e.adjustedRatio - 0.7) * e.maxHours) +
              " hours",
          }) :
          e.riskPercent >= 50 &&
          s.push({
            type: "warning",
            category: "load",
            text: "Field approaching capacity limits.",
            action: "Monitor closely and avoid adding events",
          });
        ("saturated" !== e.moisture.level && "wet" !== e.moisture.level) ||
        s.push({
          type: "warning",
          category: "moisture",
          text: "Wet conditions increasing compaction risk.",
          action: "Postpone events if possible until field drains",
        });
        r.modifiers?.moisture > 1.3 &&
          s.push({
            type: "warning",
            category: "moisture",
            text: "Soil moisture extending recovery time by " +
              Math.round(100 * (r.modifiers.moisture - 1)) +
              "%.",
            action: "Improve drainage or wait for drier conditions before heavy use",
          });
        t.score < 6 &&
          s.push({
            type: "warning",
            category: "turf",
            text: "Turf wear tolerance is compromised.",
            action: t.modifiers?.hoc?.ratio < 0.8 ?
              "Raise mowing height to improve wear tolerance" :
              "Address limiting factors (shade, growth, roots)",
          });
        ("germinating" !== t.modifiers?.overseed?.status &&
          "establishing" !== t.modifiers?.overseed?.status) ||
        s.push({
          type: "critical",
          category: "overseed",
          text: "Overseed in vulnerable establishment phase.",
          action: "Minimise traffic for " +
            ("germinating" === t.modifiers?.overseed?.status ? "4-6" : "2-4") +
            " more weeks",
        });
        "critical" === i.status ?
          s.push({
            type: "critical",
            category: "stress",
            text: "Field has accumulated significant damage debt.",
            action: "Rest field for " + i.weeksToRecover + " weeks if possible",
          }) :
          "stressed" === i.status &&
          s.push({
            type: "warning",
            category: "stress",
            text: "Field stress is accumulating.",
            action: "Reduce load or add rest days this week",
          });
        o.shade?.stressFactor > 0.3 &&
          e.riskPercent > 40 &&
          s.push({
            type: "warning",
            category: "shade",
            text: "Shade + traffic causing compound stress.",
            action: "Prioritize load reduction in shaded zones",
          });
        if (r.modifiers?.nitrogen?.factor > 1.2) {
          const e = r.modifiers.nitrogen.source;
          let t = "";
          ((t =
              "tissue" === e ?
              "Increase N applications - tissue analysis shows deficiency" :
              "fertility" === e ?
              "Increase monthly N rate to match growth potential capacity" :
              "Consider N application to support recovery (low OM soil)"),
            s.push({
              type: "warning",
              category: "nutrition",
              text: "Nitrogen availability limiting recovery rate by " +
                Math.round(100 * (r.modifiers.nitrogen.factor - 1)) +
                "%.",
              action: t,
            }));
        }
        r.modifiers?.salinity?.factor > 1.1 &&
          s.push({
            type: "warning",
            category: "salinity",
            text: "Water salinity extending recovery time by " +
              Math.round(100 * (r.modifiers.salinity.factor - 1)) +
              "%.",
            action: "Consider blending with lower EC water source, increase leaching fraction",
          });
        r.modifiers?.salinity?.factor > 1.3 &&
          s.push({
            type: "critical",
            category: "salinity",
            text: "Irrigation water salinity significantly compromising recovery.",
            action: "Seek alternative water source or implement gypsum treatment program",
          });
        r.modifiers?.temperatureStress?.factor > 1.2 &&
          s.push({
            type: "warning",
            category: "environment",
            text: "Multiple environmental stressors compounding recovery delay.",
            action: "Reduce traffic load during stress period, avoid cultural operations",
          });
        "recovering" === i.status &&
          s.push({
            type: "positive",
            category: "status",
            text: "Field is in recovery phase.",
            action: "Current management is allowing debt repayment",
          });
        const N = o.turf?.poaPercent || 0;
        N >= 20 &&
          s.push({
            type: "warning",
            category: "poa",
            text: "Poa annua (" +
              N +
              "%) reducing wear tolerance and recovery capacity.",
            action: N >= 40 ?
              "Consider Poa management program — high contamination compromising field performance" :
              "Monitor Poa spread and adjust traffic expectations accordingly",
          });
        return s;
      })(u, n, d, f, 0, t);
      // v3.0.0 pure: Reset overrides to prevent leaking between calls
      _monthOverride = null;
      _varietyTraitsProvider = null;
      
      return {
        effectiveLoad: s,
        wearResistance: n,
        compactionRisk: u,
        recoveryCapacity: d,
        shadeTrafficCompound: g,
        cumulativeStress: f,
        actionPriority: y,
        aerationSchedule: M,
        recoveryProbability: C,
        recoveryWindow: d.days,
        recommendations: P,
        inputs: {
          schedule: o,
          construction: m,
          species: t.turf?.grassSpecies,
          variety: t.turf?.variety,
          poaPercent: t.turf?.poaPercent || 0,
        },
      };
    }),
    (window.gaip_wear_effective_load = p),
    (window.gaip_wear_resistance = h),
    (window.gaip_compaction_risk = w),
    (window.gaip_recovery_capacity = v),
    (window.gaip_cumulative_stress = b),
    (window.gaip_action_priority = k),
    (window.gaip_effective_capacity = y),
    (window.gaip_getBlendInfo = getBlendInfo),
    (window.gaip_getBlendedSeasonModifier = getBlendedSeasonModifier),
    (window.GAIP_NTEP_VARIETIES = t),
    (window.GAIP_SPORT_FACTORS = r),
    (window.GAIP_WEAR_CONFIG = e),
    (window.gaip_get_varieties = function(e) {
      const r = e.toLowerCase().replace(/\s+/g, "");
      return t[r] ? Object.keys(t[r]) : [];
    }));
})();