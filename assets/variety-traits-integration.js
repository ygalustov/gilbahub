!(function () {
  "use strict";
  function e(e) {
    if (!e) return "";
    const i = e.replace(/\s+/g, "").replace(/^(.)/, (e) => e.toLowerCase());
    return (
      {
        couch: "couch",
        "couch/bermuda": "couch",
        couchbermuda: "couch",
        bermudagrass: "couch",
        ryegrass: "perennialRyegrass",
        prg: "perennialRyegrass",
        "perennial ryegrass": "perennialRyegrass",
        bentgrass: "bentgrass",
        bent: "bentgrass",
        "creeping bentgrass": "bentgrass",
        creepingbentgrass: "bentgrass",
        "creepingbentgrass(greens)": "bentgrass",
        "creepingbentgrass(fairways)": "bentgrass",
        "browntop bent": "browntopBent",
        browntopbent: "browntopBent",
        "browntopbent(greens)": "browntopBent",
        browntop: "browntopBent",
        "colonial bentgrass": "browntopBent",
        colonialbentgrass: "browntopBent",
        "agrostis capillaris": "browntopBent",
        kikuyu: "kikuyu",
        buffalograss: "buffalograss",
        buffalo: "buffalograss",
        zoysia: "zoysia",
        zoysiagrass: "zoysia",
        "kentucky bluegrass": "kentuckyBluegrass",
        kentuckybluegrass: "kentuckyBluegrass",
        kbg: "kentuckyBluegrass",
        "tall fescue": "tallFescue",
        tallfescue: "tallFescue",
        tttf: "tallFescue",
        "turf type tall fescue": "tallFescue",
      }[i.toLowerCase()] || i
    );
  }
  // PATCH v1.7.16: Log region detection once, not on every call
  var _regionLoggedFor = '';
  function i(e, i) {
    if (
      void 0 !== window.GAIP_RegionalProfiles &&
      "function" == typeof window.GAIP_RegionalProfiles.detectRegion
    ) {
      const r = window.GAIP_RegionalProfiles.detectRegion(e, i),
        t = {
          uk_ireland: "bspb",
          scandinavia: "scanturf",
          france: "geves",
          germany: "bsa",
          continental_europe: "geves",
          mediterranean: "geves",
          japan: "japan",
          us_south: "ntep",
          us_transition: "ntep",
          us_north: "ntep",
          australia: "australia",
          australia_tropical: "australia",
          australia_subtropical: "australia",
          australia_temperate: "australia",
          australia_mediterranean: "australia",
          new_zealand: "new_zealand",
          south_africa: "ntep",
        };
      const logKey = r + '|' + e + '|' + i;
      if (logKey !== _regionLoggedFor) {
        _regionLoggedFor = logKey;
        console.log(
          `[VarietyTraits] RegionalProfiles detected: ${r} -> ${t[r] || "ntep (unmapped)"}`,
        );
      }
      return t[r] || "ntep";
    }
    return e > 49 && e < 61 && i > -12 && i < 2
      ? "bspb"
      : e > 54 && i > 4 && i < 32
        ? "scanturf"
        : e > 42 && e < 52 && i > -5 && i < 8
          ? "geves"
          : e > 24 && e < 46 && i > 122 && i < 154
            ? "japan"
            : e < -10 && e > -48 && i > 112 && i < 155
              ? "australia"
              : e < -33 && e > -48 && i > 165 && i < 179
                ? "new_zealand"
                : "ntep";
  }
  function r() {
    if (window.currentState?.turf?.varietyRegion)
      return window.currentState.turf.varietyRegion;
    const e = window.currentState?.location?.lat,
      r = window.currentState?.location?.lon;
    return void 0 !== e && void 0 !== r ? i(e, r) : "ntep";
  }
  function t(i, t, n) {
    switch ((n = n || r())) {
      case "bspb":
        return (function (e, i) {
          if ("function" == typeof window.gaip_getUKWearMultiplier) {
            const r = window.gaip_getUKWearMultiplier(e, i);
            return {
              multiplier: r.multiplier || 1,
              confidence: r.confidence || "none",
              source: r.source || "BSPB",
              recoveryMultiplier: r.recoveryMultiplier || r.multiplier || 1,
              region: "bspb",
              _isBlend: r._isBlendCalculation || r._isStaticBlendData || !1,
              _blendNote: r._note || null,
              _components: r.components || null,
            };
          }
          if (
            "function" == typeof window.gaip_isUKBlend &&
            window.gaip_isUKBlend(i) &&
            "function" == typeof window.gaip_getUKBlendData
          ) {
            const e = window.gaip_getUKBlendData(i);
            if (e?.traits?.wear)
              return {
                multiplier: e.traits.wear.multiplier || 1,
                confidence: e.traits.wear.confidence || "medium",
                source: e.traits.wear.source || e.supplier || "UK Blend",
                recoveryMultiplier: e.traits.recovery?.multiplier || 1,
                region: "bspb",
                _isBlend: !0,
                _blendName: e.displayName,
                _supplier: e.supplier,
              };
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "UK traits not loaded",
            region: "bspb",
          };
        })(i, t);
      case "bsa":
        return (function (i, r) {
          if ("function" == typeof window.gaip_getBSAWearModifier) {
            const e = window.gaip_getBSAWearModifier(i, r);
            if ("none" !== e.confidence)
              return {
                multiplier: e.multiplier || 1,
                confidence: e.confidence || "high",
                source: e.source || "BSA Rasengräser 2025",
                recoveryMultiplier: 1,
                region: "bsa",
              };
          }
          if (void 0 !== window.GAIP_BSA_VARIETIES) {
            const t = e(i),
              n = window.GAIP_BSA_VARIETIES[t] || window.GAIP_BSA_VARIETIES[i],
              o = n?.[r];
            if (o?.traits?.wear)
              return {
                multiplier: o.traits.wear.multiplier || 1,
                confidence: o.traits.wear.confidence || "high",
                source: o.traits.wear.source || "BSA Rasengräser",
                recoveryMultiplier: 1,
                region: "bsa",
              };
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "BSA data not available",
            region: "bsa",
          };
        })(i, t);
      case "scanturf":
        return (function (i, r) {
          if (void 0 !== window.GAIP_SCANTURF_VARIETIES) {
            const t = e(i),
              n =
                window.GAIP_SCANTURF_VARIETIES[t] ||
                window.GAIP_SCANTURF_VARIETIES[i],
              o = n?.[r];
            if (o?.traits?.wear)
              return {
                multiplier: o.traits.wear.multiplier || 1,
                confidence: o.traits.wear.confidence || "medium",
                source: o.traits.wear.source || "Scanturf",
                recoveryMultiplier: o.traits.recovery?.multiplier || 1,
                region: "scanturf",
              };
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "Scanturf data not available",
            region: "scanturf",
          };
        })(i, t);
      case "geves":
        return (function (i, r) {
          if ("function" == typeof window.getGEVESWearModifier) {
            const e = window.getGEVESWearModifier(r);
            if ("none" !== e.confidence)
              return {
                multiplier: e.multiplier || 1,
                confidence: e.confidence || "high",
                source: e.source || "GEVES turfgrass-list.org",
                recoveryMultiplier: 1,
                region: "geves",
              };
          }
          if (void 0 !== window.GAIP_GEVES_VARIETIES) {
            const t = e(i),
              n =
                window.GAIP_GEVES_VARIETIES[t] ||
                window.GAIP_GEVES_VARIETIES[i],
              o = n?.[r];
            // Skip placeholder entries
            if (o?.traits?._placeholder) {
              return {
                multiplier: 1,
                confidence: "none",
                source: "GEVES data not verified",
                region: "geves",
              };
            }
            if (o?.traits?.wear)
              return {
                multiplier: o.traits.wear.multiplier || 1,
                confidence: o.traits.wear.confidence || "medium",
                source: o.traits.wear.source || "GEVES",
                recoveryMultiplier: o.traits.recovery?.multiplier || 1,
                region: "geves",
              };
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "GEVES data not available",
            region: "geves",
          };
        })(i, t);
      case "japan":
        return (function (i, r) {
          if ("function" == typeof window.getJapanWearModifier) {
            const e = window.getJapanWearModifier(i, r);
            if ("none" !== e.confidence)
              return {
                multiplier: e.multiplier || 1,
                confidence: e.confidence || "high",
                source: e.source || "Japan NTEP/Industry data",
                recoveryMultiplier: e.rateMultiplier || 1,
                region: "japan",
              };
          }
          if (void 0 !== window.JAPAN_VARIETY_TRAITS) {
            const t = e(i),
              n =
                window.JAPAN_VARIETY_TRAITS[t] ||
                window.JAPAN_VARIETY_TRAITS[i],
              o = n?.[r];
            if (o?.traits?.wear)
              return {
                multiplier: o.traits.wear.multiplier || 1,
                confidence: o.traits.wear.confidence || "high",
                source: o.traits.wear.source || "Japan variety data",
                recoveryMultiplier: o.traits.recovery?.rateMultiplier || 1,
                region: "japan",
              };
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "Japan data not available",
            region: "japan",
          };
        })(i, t);
      case "australia":
        return (function (i, r) {
          if ("function" == typeof window.gaip_getAUWearModifier) {
            return window.gaip_getAUWearModifier(i, r);
          }
          // Fall through to GAIP_VARIETY_TRAITS with AU-appropriate zone priority
          if (void 0 !== window.GAIP_VARIETY_TRAITS) {
            const sp = e(i),
              vd = window.GAIP_VARIETY_TRAITS[sp] || window.GAIP_VARIETY_TRAITS[i],
              vv = vd?.[r];
            if (vv?.traits?.wear)
              return {
                multiplier: vv.traits.wear.multiplier || 1,
                confidence: vv.traits.wear.confidence || "medium",
                source: vv.traits.wear.source || "AU variety data",
                recoveryMultiplier:
                  vv.traits.wear.recoveryMultiplier ||
                  vv.traits.recovery?.rateMultiplier ||
                  vv.traits.recovery?.multiplier || 1,
                region: "australia",
              };
            if (vv?.regionalTraits) {
              const cl = a(),
                zoneOrder =
                  "subtropical" === cl
                    ? ["subtropical", "subtropical_ntep", "subtropical_au", "temperate_au", "temperate_ntep", "temperate", "ntep_us", "cold_ntep"]
                    : "temperate" === cl
                      ? ["temperate_au", "temperate_ntep", "temperate", "subtropical", "subtropical_au", "ntep_us", "cold_ntep"]
                      : ["cold", "cold_ntep", "ntep_us", "temperate_au", "temperate_ntep", "temperate", "subtropical", "subtropical_au"];
              for (const z of zoneOrder) {
                const zd = vv.regionalTraits[z];
                if (zd?.traits?.wear)
                  return {
                    multiplier: zd.traits.wear.multiplier || 1,
                    confidence: zd.traits.wear.confidence || "medium",
                    source: zd.traits.wear.source || `${z} trial data`,
                    recoveryMultiplier:
                      zd.traits.wear.recoveryMultiplier ||
                      zd.traits.recovery?.rateMultiplier || 1,
                    region: "australia",
                  };
              }
            }
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "AU traits not loaded",
            region: "australia",
          };
        })(i, t);
      case "new_zealand":
        return (function (i, r) {
          if ("function" == typeof window.gaip_getNZWearModifier) {
            return window.gaip_getNZWearModifier(i, r);
          }
          // Fall through to GAIP_VARIETY_TRAITS with NZ-appropriate zone priority:
          // nzsti_nz first, then bspb_uk (STRI Bingley = temperate maritime ≈ NZ),
          // then cold_ntep/temperate_ntep as climate-matched NTEP proxies
          if (void 0 !== window.GAIP_VARIETY_TRAITS) {
            const sp = e(i),
              vd = window.GAIP_VARIETY_TRAITS[sp] || window.GAIP_VARIETY_TRAITS[i],
              vv = vd?.[r];
            if (vv?.traits?.wear)
              return {
                multiplier: vv.traits.wear.multiplier || 1,
                confidence: vv.traits.wear.confidence || "medium",
                source: vv.traits.wear.source || "NZ variety data",
                recoveryMultiplier:
                  vv.traits.wear.recoveryMultiplier ||
                  vv.traits.recovery?.rateMultiplier ||
                  vv.traits.recovery?.multiplier || 1,
                region: "new_zealand",
              };
            if (vv?.regionalTraits) {
              const zoneOrder = [
                "nzsti_nz", "nzsti_auckland", "bspb_uk",
                "cold_ntep", "temperate_ntep", "cold",
                "temperate_au", "temperate", "ntep_us",
              ];
              for (const z of zoneOrder) {
                const zd = vv.regionalTraits[z];
                if (zd?.traits?.wear)
                  return {
                    multiplier: zd.traits.wear.multiplier || 1,
                    confidence: zd.traits.wear.confidence || "medium",
                    source: zd.traits.wear.source || `${z} trial data`,
                    recoveryMultiplier:
                      zd.traits.wear.recoveryMultiplier ||
                      zd.traits.recovery?.rateMultiplier || 1,
                    region: "new_zealand",
                  };
              }
            }
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "NZ traits not loaded",
            region: "new_zealand",
          };
        })(i, t);
      default:
        return (function (i, r) {
          if ("function" == typeof window.gaip_getWearModifier) {
            const e = window.gaip_getWearModifier(i, r);
            return {
              multiplier: e.multiplier || 1,
              confidence: e.confidence || "none",
              source: e.source || "NTEP",
              recoveryMultiplier: e.recoveryMultiplier || 1,
              region: "ntep",
            };
          }
          if (void 0 !== window.GAIP_VARIETY_TRAITS) {
            const t = e(i),
              n =
                window.GAIP_VARIETY_TRAITS[t] || window.GAIP_VARIETY_TRAITS[i],
              o = n?.[r];
            if (o?.traits?.wear)
              return {
                multiplier: o.traits.wear.multiplier || 1,
                confidence: o.traits.wear.confidence || "medium",
                source: o.traits.wear.source || "NTEP",
                recoveryMultiplier:
                  o.traits.recovery?.rateMultiplier ||
                  o.traits.recovery?.multiplier ||
                  1,
                region: "ntep",
              };
            if (o?.regionalTraits) {
              const e = a(),
                i =
                  "subtropical" === e
                    ? [
                        "subtropical_ntep",
                        "subtropical",
                        "temperate_au",
                        "temperate_ntep",
                        "temperate",
                        "ntep_us",
                        "cold_ntep",
                      ]
                    : "temperate" === e
                      ? [
                          "temperate_au",
                          "temperate_ntep",
                          "temperate",
                          "cold_ntep",
                          "subtropical_ntep",
                          "subtropical",
                          "ntep_us",
                        ]
                      : [
                          "cold_ntep",
                          "cold",
                          "ntep_us",
                          "temperate_au",
                          "temperate_ntep",
                          "temperate",
                          "subtropical_ntep",
                          "subtropical",
                        ];
              for (const e of i) {
                const i = o.regionalTraits[e];
                if (i?.traits?.wear)
                  return {
                    multiplier: i.traits.wear.multiplier || 1,
                    confidence: i.traits.wear.confidence || "medium",
                    source: i.traits.wear.source || `${e} trial data`,
                    recoveryMultiplier:
                      i.traits.wear.recoveryMultiplier ||
                      i.traits.recovery?.rateMultiplier ||
                      1,
                    region: e,
                  };
              }
            }
          }
          return {
            multiplier: 1,
            confidence: "none",
            source: "NTEP data not available",
            region: "ntep",
          };
        })(i, t);
    }
  }
  function n(i, t, n, o) {
    switch ((o = o || r())) {
      case "bspb":
        return (function (e, i, r) {
          if ("function" == typeof window.gaip_getUKDiseaseModifier) {
            const t = window.gaip_getUKDiseaseModifier(e, i, r);
            return {
              riskMultiplier: t.riskMultiplier || 1,
              confidence: t.confidence || "none",
              source: t.source || "BSPB",
              region: "bspb",
              _isBlend: t._isBlendCalculation || !1,
            };
          }
          if (
            "function" == typeof window.gaip_isUKBlend &&
            window.gaip_isUKBlend(i) &&
            "function" == typeof window.gaip_calculateBlendTrait &&
            "function" == typeof window.gaip_getUKBlendData
          ) {
            const e = window.gaip_getUKBlendData(i);
            if (e) {
              const i = window.gaip_calculateBlendTrait(e, "disease." + r);
              if (i && "none" !== i.confidence)
                return {
                  riskMultiplier: i.value || 1,
                  confidence: i.confidence,
                  source: i.source || "Blend calculation",
                  region: "bspb",
                  _isBlend: !0,
                };
            }
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "UK traits not loaded",
            region: "bspb",
          };
        })(i, t, n);
      case "bsa":
        return (function (i, r, t) {
          if ("function" == typeof window.gaip_getBSADiseaseModifier) {
            const e = window.gaip_getBSADiseaseModifier(i, r, t);
            if ("none" !== e.confidence)
              return {
                riskMultiplier: e.riskMultiplier || 1,
                confidence: e.confidence || "high",
                source: e.source || "BSA Rasengräser 2025",
                region: "bsa",
              };
          }
          if (void 0 !== window.GAIP_BSA_VARIETIES) {
            const n = e(i),
              o = window.GAIP_BSA_VARIETIES[n] || window.GAIP_BSA_VARIETIES[i],
              a = o?.[r];
            if (a?.traits?.disease?.[t])
              return {
                riskMultiplier: a.traits.disease[t].riskMultiplier || 1,
                confidence: a.traits.disease[t].confidence || "high",
                source: a.traits.disease[t].source || "BSA Rasengräser",
                region: "bsa",
              };
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "BSA data not available",
            region: "bsa",
          };
        })(i, t, n);
      case "scanturf":
        return (function (i, r, t) {
          // Primary: use the dedicated disease modifier function
          if ("function" == typeof window.gaip_getScanturfDiseaseModifier) {
            const res = window.gaip_getScanturfDiseaseModifier(i, r, t);
            if ("none" !== res.confidence)
              return {
                riskMultiplier: res.riskMultiplier || 1,
                confidence: res.confidence || "medium",
                source: res.source || "SCANTURF 2024-2025",
                region: "scanturf",
              };
          }
          // Legacy fallback: direct GAIP_SCANTURF_VARIETIES lookup
          if (void 0 !== window.GAIP_SCANTURF_VARIETIES) {
            const n = e(i),
              o =
                window.GAIP_SCANTURF_VARIETIES[n] ||
                window.GAIP_SCANTURF_VARIETIES[i],
              a = o?.[r],
              s =
                {
                  dollarSpot: "dollarSpot",
                  redThread: "redThread",
                  fusarium: "fusarium",
                  microdochium: "fusarium",
                  microdochiumPatch: "microdochiumPatch",
                  pinkSnowMold: "pinkSnowMold",
                  graySnowMold: "graySnowMold",
                }[t] || t;
            if (a?.traits?.disease?.[s])
              return {
                riskMultiplier: a.traits.disease[s].riskMultiplier || 1,
                confidence: a.traits.disease[s].confidence || "medium",
                source: a.traits.disease[s].source || "Scanturf",
                region: "scanturf",
              };
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "Scanturf data not available",
            region: "scanturf",
          };
        })(i, t, n);
      case "geves":
        return (function (i, r, t) {
          if ("function" == typeof window.getGEVESDiseaseModifier) {
            const e = window.getGEVESDiseaseModifier(r, t);
            if ("none" !== e.confidence)
              return {
                riskMultiplier: e.multiplier || 1,
                confidence: e.confidence || "high",
                source: e.source || "GEVES turfgrass-list.org",
                region: "geves",
              };
          }
          if (void 0 !== window.GAIP_GEVES_VARIETIES) {
            const n = e(i),
              o =
                window.GAIP_GEVES_VARIETIES[n] ||
                window.GAIP_GEVES_VARIETIES[i],
              a = o?.[r];
            // Skip placeholder entries
            if (a?.traits?._placeholder) {
              return {
                riskMultiplier: 1,
                confidence: "none",
                source: "GEVES data not verified",
                region: "geves",
              };
            }
            if (a?.traits?.disease?.[t])
              return {
                riskMultiplier: a.traits.disease[t].riskMultiplier || 1,
                confidence: a.traits.disease[t].confidence || "medium",
                source: a.traits.disease[t].source || "GEVES",
                region: "geves",
              };
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "GEVES data not available",
            region: "geves",
          };
        })(i, t, n);
      case "japan":
        return (function (i, r, t) {
          if ("function" == typeof window.getJapanDiseaseModifier) {
            const e = window.getJapanDiseaseModifier(i, r, t);
            if ("none" !== e.confidence)
              return {
                riskMultiplier: e.riskMultiplier || 1,
                confidence: e.confidence || "high",
                source: e.source || "Japan NTEP/Industry data",
                region: "japan",
              };
          }
          if (void 0 !== window.JAPAN_VARIETY_TRAITS) {
            const n = e(i),
              o =
                window.JAPAN_VARIETY_TRAITS[n] ||
                window.JAPAN_VARIETY_TRAITS[i],
              a = o?.[r];
            if (a?.traits?.disease?.[t])
              return {
                riskMultiplier: a.traits.disease[t].riskMultiplier || 1,
                confidence: a.traits.disease[t].confidence || "high",
                source: a.traits.disease[t].source || "Japan variety data",
                region: "japan",
              };
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "Japan data not available",
            region: "japan",
          };
        })(i, t, n);
      case "australia":
        return (function (i, r, t) {
          if ("function" == typeof window.gaip_getAUDiseaseModifier) {
            return window.gaip_getAUDiseaseModifier(i, r, t);
          }
          // Fall through to gilba-variety-traits getDiseaseModifier
          if ("function" == typeof window.gaip_getDiseaseModifier) {
            const res = window.gaip_getDiseaseModifier(i, r, t);
            return {
              riskMultiplier: res.riskMultiplier || 1,
              confidence: res.confidence || "none",
              source: res.source || "AU variety data",
              region: "australia",
            };
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "AU traits not loaded",
            region: "australia",
          };
        })(i, t, n);
      case "new_zealand":
        return (function (i, r, t) {
          if ("function" == typeof window.gaip_getNZDiseaseModifier) {
            return window.gaip_getNZDiseaseModifier(i, r, t);
          }
          // Fall through to gilba-variety-traits getDiseaseModifier.
          // regionOrder in getDiseaseModifier already includes nzsti_nz via
          // the GAIP_VARIETY_TRAITS lookup inside that function.
          if ("function" == typeof window.gaip_getDiseaseModifier) {
            const res = window.gaip_getDiseaseModifier(i, r, t);
            return {
              riskMultiplier: res.riskMultiplier || 1,
              confidence: res.confidence || "none",
              source: res.source || "NZ variety data",
              region: "new_zealand",
            };
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "NZ traits not loaded",
            region: "new_zealand",
          };
        })(i, t, n);
      default:
        return (function (e, i, r) {
          if ("function" == typeof window.gaip_getDiseaseModifier) {
            const t = window.gaip_getDiseaseModifier(e, i, r);
            return {
              riskMultiplier: t.riskMultiplier || 1,
              confidence: t.confidence || "none",
              source: t.source || "NTEP",
              region: "ntep",
            };
          }
          return {
            riskMultiplier: 1,
            confidence: "none",
            source: "NTEP data not available",
            region: "ntep",
          };
        })(i, t, n);
    }
  }
  function o(i, t, n) {
    switch ((n = n || r())) {
      case "bspb":
        if ("function" == typeof window.gaip_getUKVarietyData)
          return window.gaip_getUKVarietyData(i, t);
        break;
      case "bsa":
        if ("function" == typeof window.gaip_getBSAVarietyTraits)
          return window.gaip_getBSAVarietyTraits(i, t);
        if (void 0 !== window.GAIP_BSA_VARIETIES) {
          const r = e(i),
            n = window.GAIP_BSA_VARIETIES[r] || window.GAIP_BSA_VARIETIES[i];
          return n?.[t] || null;
        }
        break;
      case "scanturf":
        if (void 0 !== window.GAIP_SCANTURF_VARIETIES) {
          const r = e(i),
            n =
              window.GAIP_SCANTURF_VARIETIES[r] ||
              window.GAIP_SCANTURF_VARIETIES[i];
          return n?.[t] || null;
        }
        break;
      case "geves":
        if (void 0 !== window.GAIP_GEVES_VARIETIES) {
          const r = e(i),
            n =
              window.GAIP_GEVES_VARIETIES[r] || window.GAIP_GEVES_VARIETIES[i];
          const variety = n?.[t];
          // Return null for placeholder entries
          if (variety?.traits?._placeholder) return null;
          return variety || null;
        }
        break;
      case "japan":
        if ("function" == typeof window.getJapanVarietyData)
          return window.getJapanVarietyData(i, t);
        break;
      case "australia":
        if ("function" == typeof window.gaip_getAUVarietyTraits)
          return window.gaip_getAUVarietyTraits(i, t);
        break;
      case "new_zealand":
        if ("function" == typeof window.gaip_getNZVarietyTraits)
          return window.gaip_getNZVarietyTraits(i, t);
        break;
      default:
        if (void 0 !== window.GAIP_VARIETY_TRAITS) {
          const r = e(i),
            n = window.GAIP_VARIETY_TRAITS[r] || window.GAIP_VARIETY_TRAITS[i];
          return n?.[t] || null;
        }
    }
    return null;
  }
  function a() {
    const e = parseFloat(document.querySelector(".gaip-lat")?.value);
    if (isNaN(e)) return "temperate";
    const i = Math.abs(e);
    return i < 27 ? "subtropical" : i < 38 ? "temperate" : "cold";
  }
  function s(i, t) {
    switch ((t = t || r())) {
      case "bspb":
        if (
          "perennialRyegrass" === i &&
          "function" == typeof window.gaip_getUKRyegrassVarieties
        )
          return window.gaip_getUKRyegrassVarieties();
        if (
          ("bentgrass" === i || "creepingBentgrass" === i) &&
          "function" == typeof window.gaip_getUKCreepingBentgrassVarieties
        )
          return window.gaip_getUKCreepingBentgrassVarieties();
        if (
          ("browntopBent" === i || "colonialBentgrass" === i) &&
          "function" == typeof window.gaip_getUKBrowntopBentVarieties
        )
          return window.gaip_getUKBrowntopBentVarieties();
        if ("chewingsFescue" === i && "function" == typeof window.gaip_getUKChewingsFescueVarieties)
          return window.gaip_getUKChewingsFescueVarieties();
        if ("slenderCreepingRedFescue" === i && "function" == typeof window.gaip_getUKSlenderCreepingRedFescueVarieties)
          return window.gaip_getUKSlenderCreepingRedFescueVarieties();
        if ("strongCreepingRedFescue" === i && "function" == typeof window.gaip_getUKStrongCreepingRedFescueVarieties)
          return window.gaip_getUKStrongCreepingRedFescueVarieties();
        if ("hardFescue" === i && "function" == typeof window.gaip_getUKHardFescueVarieties)
          return window.gaip_getUKHardFescueVarieties();
        if ("sheepFescue" === i && "function" == typeof window.gaip_getUKSheepFescueVarieties)
          return window.gaip_getUKSheepFescueVarieties();
        break;
      case "bsa":
        if (
          "perennialRyegrass" === i &&
          "function" == typeof window.gaip_getBSARyegrassVarieties
        )
          return window.gaip_getBSARyegrassVarieties();
        if (
          ("bentgrass" === i ||
            "creepingBentgrass" === i ||
            "colonialBentgrass" === i ||
            "browntopBent" === i) &&
          "function" == typeof window.gaip_getBSABentgrassVarieties
        )
          return window.gaip_getBSABentgrassVarieties();
        if (void 0 !== window.GAIP_BSA_VARIETIES) {
          const r = e(i),
            t = window.GAIP_BSA_VARIETIES[r] || window.GAIP_BSA_VARIETIES[i];
          if (t)
            return Object.keys(t).map((e) => ({
              value: e,
              label: t[e].displayName || e,
              region: "bsa",
            }));
        }
        break;
      case "scanturf":
        if (void 0 !== window.GAIP_SCANTURF_VARIETIES) {
          const r = e(i),
            t =
              window.GAIP_SCANTURF_VARIETIES[r] ||
              window.GAIP_SCANTURF_VARIETIES[i];
          if (t)
            return Object.keys(t).map((e) => ({
              value: e,
              label: t[e].displayName || e,
              region: "scanturf",
            }));
        }
        break;
      case "geves":
        if (void 0 !== window.GAIP_GEVES_VARIETIES) {
          const r = e(i),
            t =
              window.GAIP_GEVES_VARIETIES[r] || window.GAIP_GEVES_VARIETIES[i];
          if (t)
            return Object.keys(t)
              .filter((e) => !t[e].traits?._placeholder) // Filter out placeholder entries
              .map((e) => ({
                value: e,
                label: t[e].displayName || e,
                region: "geves",
              }));
        }
        break;
      case "australia":
        if (void 0 !== window.GAIP_VARIETY_TRAITS) {
          const r = e(i),
            t = window.GAIP_VARIETY_TRAITS[r] || window.GAIP_VARIETY_TRAITS[i];
          if (t) {
            const auMarkers = ['au_temperate', 'au_subtropical', 'au_tropical', 'au_mediterranean',
                               'temperate_au', 'subtropical_au'];
            const filtered = Object.keys(t).filter(function(k) {
              if (k.startsWith('_')) return false;
              const v = t[k];
              if (v.testedRegions && v.testedRegions.some(function(r) {
                return auMarkers.some(function(m) { return r === m; });
              })) return true;
              const src = JSON.stringify(v).toLowerCase();
              return src.indexOf('australian market') >= 0 || src.indexOf('australian stadium') >= 0 ||
                     src.indexOf('australian sports') >= 0 || src.indexOf('au market') >= 0;
            });
            if (filtered.length > 0)
              return [{ value: "generic", label: "Generic / Unknown", region: "australia" }].concat(
                filtered.map(function(k) {
                  return { value: k, label: t[k].displayName || k, region: "australia" };
                })
              );
          }
        }
        break;
      case "new_zealand":
        if (void 0 !== window.GAIP_VARIETY_TRAITS) {
          const r = e(i),
            t = window.GAIP_VARIETY_TRAITS[r] || window.GAIP_VARIETY_TRAITS[i];
          if (t) {
            // Primary: varieties with NZ-specific trial data
            const nzPrimaryMarkers = ['nzsti_nz', 'nzsti_auckland', 'bspb_uk'];
            // Secondary: cool-temperate AU and cold-climate NTEP are directly
            // applicable to NZ conditions. Used as a fallback so users see a
            // practical list rather than just the one or two NZ-trialled entries.
            const nzSecondaryMarkers = ['au_temperate', 'temperate_au', 'cold_ntep', 'temperate_ntep'];
            const filtered = Object.keys(t).filter(function(k) {
              if (k.startsWith('_')) return false;
              const v = t[k];
              if (!v.testedRegions) return false;
              if (v.testedRegions.some(function(r) {
                return nzPrimaryMarkers.some(function(m) { return r === m; });
              })) return true;
              if (v.testedRegions.some(function(r) {
                return nzSecondaryMarkers.some(function(m) { return r === m; });
              })) return true;
              const src = JSON.stringify(v).toLowerCase();
              return src.indexOf('new zealand') >= 0 ||
                     src.indexOf('nzsti') >= 0 || src.indexOf('nz market') >= 0;
            });
            if (filtered.length > 0)
              return [{ value: "generic", label: "Generic / Unknown", region: "new_zealand" }].concat(
                filtered.map(function(k) {
                  return { value: k, label: t[k].displayName || k, region: "new_zealand" };
                })
              );
          }
        }
        break;
    }
    if (void 0 !== window.GAIP_VARIETY_TRAITS) {
      const e = window.GAIP_VARIETY_TRAITS[i];
      if (e)
        return Object.keys(e).map((i) => ({
          value: i,
          label: e[i].displayName || i,
          region: "ntep",
        }));
    }
    return [{ value: "generic", label: "Generic / Unknown" }];
  }
  function c(i, t) {
    if (!t || "generic" === t)
      return { heatMultiplier: 1, droughtMultiplier: 1, confidence: "none" };
    const n = r();
    if (void 0 !== window.GAIP_VARIETY_TRAITS) {
      const r = e(i),
        n = window.GAIP_VARIETY_TRAITS[r] || window.GAIP_VARIETY_TRAITS[i],
        o = n?.[t];
      if (o?.traits) {
        const e = o.traits.heat || o.traits.heatTolerance,
          i = o.traits.drought || o.traits.waterUse;
        if (e || i)
          return {
            heatMultiplier: e?.multiplier || e?.toleranceModifier || 1,
            droughtMultiplier: i?.multiplier || 1,
            confidence: e?.confidence || i?.confidence || "medium",
            source: e?.source || i?.source || "NTEP",
          };
      }
      if (o?.regionalTraits) {
        const e = a(),
          i =
            "subtropical" === e
              ? [
                  "subtropical_ntep",
                  "subtropical",
                  "temperate_au",
                  "temperate_ntep",
                  "temperate",
                  "ntep_us",
                  "cold_ntep",
                ]
              : "temperate" === e
                ? [
                    "temperate_au",
                    "temperate_ntep",
                    "temperate",
                    "cold_ntep",
                    "subtropical_ntep",
                    "subtropical",
                    "ntep_us",
                  ]
                : [
                    "cold_ntep",
                    "cold",
                    "ntep_us",
                    "temperate_au",
                    "temperate_ntep",
                    "temperate",
                    "subtropical_ntep",
                    "subtropical",
                  ];
        for (const e of i) {
          const i = o.regionalTraits[e],
            r = i?.traits?.heat || i?.traits?.heatTolerance,
            t = i?.traits?.drought || i?.traits?.waterUse;
          if (r || t)
            return {
              heatMultiplier:
                r?.multiplier ||
                r?.toleranceModifier ||
                r?.toleranceMultiplier ||
                1,
              droughtMultiplier:
                t?.multiplier ||
                t?.toleranceMultiplier ||
                t?.toleranceModifier ||
                1,
              confidence: r?.confidence || t?.confidence || "medium",
              source: r?.source || t?.source || `${e} trial data`,
            };
        }
      }
    }
    if ("bspb" === n)
      return {
        heatMultiplier: 1,
        droughtMultiplier: 1,
        confidence: "low",
        source: "UK climate (heat/drought less relevant)",
      };
    if ("scanturf" === n)
      return {
        heatMultiplier: 1,
        droughtMultiplier: 1,
        confidence: "low",
        source: "Nordic climate (heat/drought less relevant)",
      };
    return (
      {
        "Tahoma 31": {
          heatMultiplier: 0.95,
          droughtMultiplier: 0.82,
          confidence: "high",
          source: "NTEP/OSU research",
        },
        TifTuf: {
          heatMultiplier: 1,
          droughtMultiplier: 0.85,
          confidence: "high",
          source: "NTEP drought trials",
        },
        Celebration: {
          heatMultiplier: 0.9,
          droughtMultiplier: 0.86,
          confidence: "medium",
          source: "NTEP",
        },
        "RTF Turf Saver": {
          heatMultiplier: 1,
          droughtMultiplier: 0.85,
          confidence: "medium",
          source: "Manufacturer data",
        },
        "Firecracker G-LS": {
          heatMultiplier: 0.9,
          droughtMultiplier: 1,
          confidence: "medium",
          source: "NTEP",
        },
        TifGrand: {
          heatMultiplier: 0.92,
          droughtMultiplier: 0.9,
          confidence: "medium",
          source: "UGA research",
        },
        "Zeon Zoysia": {
          heatMultiplier: 0.88,
          droughtMultiplier: 0.85,
          confidence: "medium",
          source: "NTEP",
        },
      }[t] || { heatMultiplier: 1, droughtMultiplier: 1, confidence: "none" }
    );
  }
  function d(i, t) {
    if (!t || "generic" === t)
      return { multiplier: 1, confidence: "none", source: "Generic variety" };
    const n = r();
    if (void 0 !== window.GAIP_VARIETY_TRAITS) {
      const r = e(i),
        n = window.GAIP_VARIETY_TRAITS[r] || window.GAIP_VARIETY_TRAITS[i],
        o = n?.[t];
      if (o?.traits?.waterUse)
        return {
          multiplier: o.traits.waterUse.multiplier || 1,
          confidence: o.traits.waterUse.confidence || "medium",
          source: o.traits.waterUse.source || "NTEP",
        };
      if (o?.regionalTraits) {
        const e = a(),
          i =
            "subtropical" === e
              ? [
                  "subtropical_ntep",
                  "subtropical",
                  "temperate_au",
                  "temperate_ntep",
                  "temperate",
                  "ntep_us",
                  "cold_ntep",
                ]
              : "temperate" === e
                ? [
                    "temperate_au",
                    "temperate_ntep",
                    "temperate",
                    "cold_ntep",
                    "subtropical_ntep",
                    "subtropical",
                    "ntep_us",
                  ]
                : [
                    "cold_ntep",
                    "cold",
                    "ntep_us",
                    "temperate_au",
                    "temperate_ntep",
                    "temperate",
                    "subtropical_ntep",
                    "subtropical",
                  ];
        for (const e of i) {
          const i = o.regionalTraits[e];
          if (i?.traits?.waterUse)
            return {
              multiplier: i.traits.waterUse.multiplier || 1,
              confidence: i.traits.waterUse.confidence || "medium",
              source: i.traits.waterUse.source || `${e} trial data`,
            };
        }
      }
    }
    if ("function" == typeof window.gaip_getWaterUseModifier)
      return window.gaip_getWaterUseModifier(i, t);
    const o = {
      "Tahoma 31": {
        multiplier: 0.82,
        confidence: "high",
        source: "Amgain et al., 2018 - OSU ET study",
      },
      TifTuf: {
        multiplier: 0.85,
        confidence: "high",
        source: "UGA drought research",
      },
      Celebration: { multiplier: 0.86, confidence: "medium", source: "NTEP" },
      "Latitude 36": {
        multiplier: 0.88,
        confidence: "medium",
        source: "OSU research",
      },
      NorthBridge: {
        multiplier: 0.9,
        confidence: "medium",
        source: "OSU research",
      },
    };
    return o[t]
      ? o[t]
      : (console.log(
          `[VarietyTraits] Water use data not available for ${t} (${n || "unknown region"}). Using baseline Kc.`,
        ),
        {
          multiplier: 1,
          confidence: "none",
          source: `No water use data for ${n || "this"} region`,
        });
  }
  function l(i, t) {
    if (!t || "generic" === t)
      return {
        dormancyModifier: 1,
        winterkillRisk: 1,
        confidence: "none",
        source: "Generic variety",
      };
    const n = r();
    if (void 0 !== window.GAIP_VARIETY_TRAITS) {
      const r = e(i),
        n = window.GAIP_VARIETY_TRAITS[r] || window.GAIP_VARIETY_TRAITS[i],
        o = n?.[t];
      if (o?.traits?.cold)
        return {
          dormancyModifier: o.traits.cold.dormancyThresholdModifier || 1,
          winterkillRisk: o.traits.cold.winterkillRisk || 1,
          confidence: o.traits.cold.confidence || "medium",
          source: o.traits.cold.source || "NTEP",
        };
      if (o?.regionalTraits) {
        const e = a(),
          i =
            "cold" === e
              ? ["cold", "temperate", "ntep_us"]
              : "temperate" === e
                ? ["temperate", "cold", "ntep_us"]
                : ["ntep_us", "temperate", "cold"];
        for (const e of i) {
          const i = o.regionalTraits[e];
          if (i?.traits?.cold)
            return {
              dormancyModifier: i.traits.cold.dormancyThresholdModifier || 1,
              winterkillRisk: i.traits.cold.winterkillRisk || 1,
              confidence: i.traits.cold.confidence || "medium",
              source: i.traits.cold.source || `${e} trial data`,
            };
        }
      }
    }
    if ("function" == typeof window.gaip_getColdModifier)
      return window.gaip_getColdModifier(i, t);
    if ("scanturf" === n && void 0 !== window.GAIP_SCANTURF_VARIETIES) {
      const r = e(i),
        n =
          window.GAIP_SCANTURF_VARIETIES[r] ||
          window.GAIP_SCANTURF_VARIETIES[i],
        o = n?.[t];
      if (o?.traits?.winterHardiness)
        return {
          dormancyModifier: o.traits.winterHardiness.modifier || 1,
          winterkillRisk: o.traits.winterHardiness.riskMultiplier || 1,
          confidence: o.traits.winterHardiness.confidence || "high",
          source: o.traits.winterHardiness.source || "Scanturf",
        };
    }
    const o = {
      "Tahoma 31": {
        dormancyModifier: 0.85,
        winterkillRisk: 0.7,
        confidence: "high",
        source: "NTEP 2014-2017 polar vortex survival",
      },
      "Latitude 36": {
        dormancyModifier: 0.88,
        winterkillRisk: 0.75,
        confidence: "high",
        source: "OSU cold hardiness trials",
      },
      NorthBridge: {
        dormancyModifier: 0.9,
        winterkillRisk: 0.78,
        confidence: "high",
        source: "OSU cold hardiness trials",
      },
      TifTuf: {
        dormancyModifier: 0.95,
        winterkillRisk: 0.9,
        confidence: "medium",
        source: "NTEP",
      },
      Celebration: {
        dormancyModifier: 1,
        winterkillRisk: 1,
        confidence: "medium",
        source: "NTEP",
      },
    };
    return o[t]
      ? o[t]
      : (console.log(
          `[VarietyTraits] Cold tolerance data not available for ${t} (${n || "unknown region"}). Using baseline.`,
        ),
        {
          dormancyModifier: 1,
          winterkillRisk: 1,
          confidence: "none",
          source: `No cold data for ${n || "this"} region`,
        });
  }
  console.log(
    "✅ Variety Traits Integration v1.7.16 loading",
  );
  // PATCH v1.7.15: Change guard for logTraitCoverage — prevents 600+ redundant
  // lookups per page load caused by state:update events re-triggering the caller.
  var _lastTraitKey = '';
  const u = {
    detectVarietyRegion: i,
    getCurrentRegion: r,
    getWearModifier: t,
    getDiseaseModifier: n,
    getVarietyTraits: o,
    getHeatDroughtModifier: c,
    getShadeModifier: function (i, t) {
      if (!t || "generic" === t)
        return {
          thresholdModifier: 1,
          confidence: "none",
          source: "Generic variety",
        };
      const n = r();
      if ("bspb" === n && "function" == typeof window.gaip_getUKVarietyData) {
        const e = window.gaip_getUKVarietyData(i, t);
        if (e?.traits?.shade)
          return {
            thresholdModifier:
              e.traits.shade.thresholdModifier ||
              e.traits.shade.multiplier ||
              1,
            confidence: e.traits.shade.confidence || "medium",
            source: e.traits.shade.source || "BSPB",
          };
      }
      if ("scanturf" === n && void 0 !== window.GAIP_SCANTURF_VARIETIES) {
        const r = e(i),
          n = window.GAIP_SCANTURF_VARIETIES[r],
          o = n?.[t];
        if (o?.traits?.shade)
          return {
            thresholdModifier: o.traits.shade.thresholdModifier || 1,
            confidence: o.traits.shade.confidence || "medium",
            source: o.traits.shade.source || "Scanturf",
          };
      }
      if ("japan" === n && "function" == typeof window.getJapanShadeModifier) {
        const e = window.getJapanShadeModifier(i, t);
        if ("none" !== e.confidence) return e;
      }
      if (void 0 !== window.GAIP_VARIETY_TRAITS) {
        const r = e(i),
          n = window.GAIP_VARIETY_TRAITS[r] || window.GAIP_VARIETY_TRAITS[i],
          o = n?.[t];
        if (o?.traits?.shade)
          return {
            thresholdModifier:
              o.traits.shade.thresholdModifier ||
              o.traits.shade.multiplier ||
              1,
            confidence: o.traits.shade.confidence || "medium",
            source: o.traits.shade.source || "NTEP shade trials",
          };
        if (o?.regionalTraits) {
          const e = a(),
            i =
              "subtropical" === e
                ? [
                    "subtropical_ntep",
                    "subtropical",
                    "temperate_au",
                    "temperate_ntep",
                    "temperate",
                    "ntep_us",
                    "cold_ntep",
                  ]
                : "temperate" === e
                  ? [
                      "temperate_au",
                      "temperate_ntep",
                      "temperate",
                      "cold_ntep",
                      "subtropical_ntep",
                      "subtropical",
                      "ntep_us",
                    ]
                  : [
                      "cold_ntep",
                      "cold",
                      "ntep_us",
                      "temperate_au",
                      "temperate_ntep",
                      "temperate",
                      "subtropical_ntep",
                      "subtropical",
                    ];
          for (const e of i) {
            const i = o.regionalTraits[e];
            if (i?.traits?.shade)
              return {
                thresholdModifier:
                  i.traits.shade.thresholdModifier ||
                  i.traits.shade.multiplier ||
                  1,
                confidence: i.traits.shade.confidence || "medium",
                source: i.traits.shade.source || `${e} trial data`,
              };
          }
        }
      }
      return (
        {
          "Fiesta 4": {
            thresholdModifier: 0.95,
            confidence: "medium",
            source: "NTEP shade trials",
          },
          RPR: {
            thresholdModifier: 0.9,
            confidence: "medium",
            source: "Industry data",
          },
          Tyee: {
            thresholdModifier: 0.85,
            confidence: "high",
            source: "NTEP shade trials",
          },
          Declaration: {
            thresholdModifier: 0.88,
            confidence: "high",
            source: "NTEP shade trials",
          },
          Penncross: {
            thresholdModifier: 0.95,
            confidence: "medium",
            source: "Historical data",
          },
          "007": {
            thresholdModifier: 0.9,
            confidence: "high",
            source: "NTEP shade trials",
          },
          "Compass II": {
            thresholdModifier: 0.75,
            confidence: "high",
            source: "NTEP shade trials",
          },
          "Jamestown VII": {
            thresholdModifier: 0.78,
            confidence: "high",
            source: "NTEP shade trials",
          },
          Midnight: {
            thresholdModifier: 0.85,
            confidence: "high",
            source: "NTEP shade trials",
          },
          Award: {
            thresholdModifier: 0.88,
            confidence: "medium",
            source: "NTEP",
          },
          Zeon: { thresholdModifier: 0.8, confidence: "high", source: "NTEP" },
          Zorro: {
            thresholdModifier: 0.82,
            confidence: "medium",
            source: "Industry data",
          },
        }[t] || {
          thresholdModifier: 1,
          confidence: "none",
          source: "No shade data available",
        }
      );
    },
    getWaterUseModifier: d,
    getColdModifier: l,
    getWinterHardinessModifier: function (e) {
      return "function" == typeof window.getWinterHardinessModifier
        ? window.getWinterHardinessModifier(e)
        : {
            multiplier: 1,
            confidence: "none",
            source: "Winter hardiness data not available",
          };
    },
    logTraitCoverage: function (e, i) {
      if (!i || "generic" === i) return;
      
      // PATCH v1.7.15: Skip if species+variety+region hasn't changed
      var guardKey = (e || '') + '|' + (i || '') + '|' + r();
      if (guardKey === _lastTraitKey) return;
      _lastTraitKey = guardKey;
      
      const o = r(),
        a = t(e, i),
        s = n(e, i, "dollarSpot"),
        u = d(e, i),
        f = l(e, i),
        p = c(e, i),
        w = [],
        g = [];
      ("none" !== a.confidence ? w.push("Wear") : g.push("Wear"),
        "none" !== s.confidence ? w.push("Disease") : g.push("Disease"),
        "none" !== u.confidence ? w.push("Water Use") : g.push("Water Use"),
        "none" !== f.confidence ? w.push("Cold") : g.push("Cold"),
        "none" !== p.confidence
          ? w.push("Heat/Drought")
          : g.push("Heat/Drought"),
        console.log(
          `[VarietyTraits] ${i} (${{ bspb: "UK (BSPB/STRI)", scanturf: "Scandinavia (Scanturf)", geves: "France (GEVES)", ntep: "US/Australia (NTEP)" }[o] || o}):`,
        ),
        w.length > 0 && console.log(`  ✓ Available: ${w.join(", ")}`),
        g.length > 0 &&
          console.log(`  ○ Baseline (no regional data): ${g.join(", ")}`));
    },
    getVarietiesForSpecies: s,
    buildVarietyOptions: s,
    getVarietySummary: function (e, i) {
      if (!i || "generic" === i) return null;
      const n = r(),
        a = t(e, i),
        s = d(e, i),
        u = l(e, i),
        f = c(e, i);
      if (
        !(
          "none" !== a.confidence ||
          "none" !== s.confidence ||
          "none" !== u.confidence ||
          "none" !== f.confidence
        )
      )
        return null;
      const p = {
        displayName: i,
        source:
          {
            bspb: "UK (BSPB/STRI)",
            scanturf: "Scandinavia (Scanturf)",
            geves: "France (GEVES)",
            japan: "Japan",
            ntep: "US/Australia (NTEP)",
          }[n] || n,
        confidence: "medium",
        traits: {},
      };
      if ("none" !== a.confidence) {
        const e = a.multiplier || 1;
        let i = "Average wear tolerance";
        if (
          (e < 0.85
            ? (i = "Excellent wear tolerance")
            : e < 0.95
              ? (i = "Good wear tolerance")
              : e > 1.15
                ? (i = "Poor wear tolerance")
                : e > 1.05 && (i = "Below average wear tolerance"),
          (p.traits.wear = { value: e, label: i, confidence: a.confidence }),
          a.recoveryMultiplier && 1 !== a.recoveryMultiplier)
        ) {
          const e = a.recoveryMultiplier;
          let i = "Average recovery";
          (e < 0.9 ? (i = "Fast recovery") : e > 1.1 && (i = "Slow recovery"),
            (p.traits.recovery = {
              value: e,
              label: i,
              confidence: a.confidence,
            }));
        }
      }
      if ("none" !== s.confidence) {
        const e = s.multiplier || 1;
        let i = "Average water requirements";
        (e < 0.85
          ? (i = "Excellent drought tolerance")
          : e < 0.95
            ? (i = "Good drought tolerance")
            : e > 1.15
              ? (i = "High water requirements")
              : e > 1.05 && (i = "Above average water needs"),
          (p.traits.waterUse = {
            value: e,
            label: i,
            confidence: s.confidence,
          }));
      }
      if ("none" !== u.confidence) {
        const e = u.dormancyModifier || u.dormancyThresholdModifier || 1;
        let i = "Average cold tolerance";
        (e < 0.9
          ? (i = "Good cold tolerance")
          : e > 1.1 && (i = "Cold sensitive"),
          (p.traits.coldTolerance = {
            value: e,
            label: i,
            confidence: u.confidence,
          }));
      }
      const w = o(e, i);
      if (w?.shade?.thresholdModifier) {
        const e = w.shade.thresholdModifier;
        let i = "Average shade tolerance";
        (e < 0.85
          ? (i = "Good shade tolerance")
          : e > 1.1 && (i = "Poor shade tolerance"),
          (p.traits.shade = {
            value: e,
            label: i,
            confidence: w.shade.confidence || "medium",
          }));
      }
      return p;
    },
    version: "1.7.14",
  };
  ((window.GAIP_VarietyTraits = u),
    (window.gaip_getRegionalWearModifier = t),
    (window.gaip_getRegionalDiseaseModifier = n),
    (window.gaip_getRegionalVarietyTraits = o),
    (window.gaip_detectVarietyRegion = i),
    console.log(
      "✅ Variety Traits Integration v1.7.16 loaded - AU/NZ region routing, GEVES break fix, logTraitCoverage guard, region log-once",
    ));
})();
