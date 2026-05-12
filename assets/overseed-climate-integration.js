/**
 * Gilba Overseed Climate Integration v1.2.2
 * 
 * CHANGELOG v1.2.2:
 * - FIX: Removed false positive overseed detection for straight C3 turf in C4-viable climates
 * - Previously: Selecting PRG in Sydney would infer "couch base + PRG overseed"
 * - Now: Only treats as overseed when warmBase is EXPLICITLY set by user
 * - Sports fields maintaining permanent cool-season turf are no longer mis-detected
 * - Added console logging to clarify when overseed is/isn't detected
 * 
 * CHANGELOG v1.2.1:
 * - FIX: Clear GAIP_OVERSEED_STATE when switching to pure C4 (no overseed) scenario
 * - FIX: Added gaip:turf-profile-change listener to clear state IMMEDIATELY on species dropdown change
 *   (Previously only cleared on gaip:hub-state-update which fires after Run button)
 * - Prevents stale overseed state from causing "two-click" analysis issues
 * - Dispatches gaip:overseed-fraction-update with cleared:true flag when state is cleared
 * 
 * CHANGELOG v1.2.0:
 * - Fixed isC4Base detection for scenarios where user selects C3 grass (e.g., PRG) as main species
 * - Now checks: grassSpecies, warmBase, AND infers C4 base if C3 selected in C4-viable climate with coolOverseed
 * - Auto-calculates seasonal c3Fraction default when not explicitly set (summer: 0.3, winter: 0.8, transition: 0.5)
 * - Correctly identifies baseSpecies vs overseedSpecies in inferred scenarios
 * - Dispatches gaip:overseed-fraction-update event for Climate V2 and N distribution modules
 * - Exposes GAIP_OVERSEED_STATE global for cross-module access
 * 
 * The core fix: When user selects "Perennial Ryegrass" as species in Perth (C4-viable climate),
 * the system now correctly infers this is an overseed on couch/bermuda rather than a pure C3 stand.
 */
! function() {
    "use strict";
    var e = {
            perennial_ryegrass: {
                name: "Perennial Ryegrass",
                baseTemp: 4,
                optimalMin: 15,
                optimalMax: 22,
                maxTemp: 30,
                gddToGerminate: 120,
                gddToEstablish: 400,
                daysAt20C: 6,
                daysAt12C: 17,
                daysAt8C: 35
            },
            annual_ryegrass: {
                name: "Annual Ryegrass",
                baseTemp: 4,
                optimalMin: 15,
                optimalMax: 25,
                maxTemp: 32,
                gddToGerminate: 95,
                gddToEstablish: 320,
                daysAt20C: 5,
                daysAt12C: 14,
                daysAt8C: 30
            },
            fine_fescue: {
                name: "Fine Fescue",
                baseTemp: 4,
                optimalMin: 15,
                optimalMax: 22,
                maxTemp: 28,
                gddToGerminate: 160,
                gddToEstablish: 500,
                daysAt20C: 10,
                daysAt12C: 25,
                daysAt8C: 45
            },
            kentucky_bluegrass: {
                name: "Kentucky Bluegrass",
                baseTemp: 4,
                optimalMin: 15,
                optimalMax: 24,
                maxTemp: 30,
                gddToGerminate: 200,
                gddToEstablish: 600,
                daysAt20C: 14,
                daysAt12C: 35,
                daysAt8C: 60
            },
            poa_trivialis: {
                name: "Poa trivialis (Rough Bluegrass)",
                baseTemp: 4,
                optimalMin: 10,
                optimalMax: 20,
                maxTemp: 28,
                gddToGerminate: 120,
                gddToEstablish: 380,
                daysAt20C: 8,
                daysAt12C: 20,
                daysAt8C: 40
            }
        },
        t = {
            germinating: [{
                minTemp: -999,
                maxTemp: 4,
                coefficient: 0,
                stress: "critical",
                note: "Below base temperature - no germination"
            }, {
                minTemp: 4,
                maxTemp: 8,
                coefficient: .25,
                stress: "severe",
                note: "Very slow germination, risk of damping off"
            }, {
                minTemp: 8,
                maxTemp: 12,
                coefficient: .5,
                stress: "moderate",
                note: "Slow germination, 3-4 week timeline"
            }, {
                minTemp: 12,
                maxTemp: 15,
                coefficient: .75,
                stress: "mild",
                note: "Sub-optimal but acceptable"
            }, {
                minTemp: 15,
                maxTemp: 22,
                coefficient: 1,
                stress: "none",
                note: "Optimal germination conditions"
            }, {
                minTemp: 22,
                maxTemp: 26,
                coefficient: .8,
                stress: "mild",
                note: "Above optimal, monitor moisture"
            }, {
                minTemp: 26,
                maxTemp: 30,
                coefficient: .4,
                stress: "severe",
                note: "Heat stress, germination compromised"
            }, {
                minTemp: 30,
                maxTemp: 999,
                coefficient: 0,
                stress: "critical",
                note: "Too hot - germination failure likely"
            }],
            establishing: [{
                minTemp: -999,
                maxTemp: 4,
                coefficient: 0,
                stress: "critical",
                note: "Growth ceased"
            }, {
                minTemp: 4,
                maxTemp: 10,
                coefficient: .4,
                stress: "severe",
                note: "Minimal growth, weak establishment"
            }, {
                minTemp: 10,
                maxTemp: 15,
                coefficient: .7,
                stress: "mild",
                note: "Slow but steady establishment"
            }, {
                minTemp: 15,
                maxTemp: 24,
                coefficient: 1,
                stress: "none",
                note: "Optimal establishment conditions"
            }, {
                minTemp: 24,
                maxTemp: 28,
                coefficient: .75,
                stress: "mild",
                note: "Above optimal, increase irrigation"
            }, {
                minTemp: 28,
                maxTemp: 32,
                coefficient: .35,
                stress: "severe",
                note: "Heat stress, seedling mortality risk"
            }, {
                minTemp: 32,
                maxTemp: 999,
                coefficient: .1,
                stress: "critical",
                note: "Critical heat - expect significant losses"
            }],
            mature: [{
                minTemp: -999,
                maxTemp: 4,
                coefficient: .3,
                stress: "moderate",
                note: "Dormant/semi-dormant"
            }, {
                minTemp: 4,
                maxTemp: 10,
                coefficient: .6,
                stress: "mild",
                note: "Cool-season active growth"
            }, {
                minTemp: 10,
                maxTemp: 22,
                coefficient: 1,
                stress: "none",
                note: "Optimal performance"
            }, {
                minTemp: 22,
                maxTemp: 28,
                coefficient: .7,
                stress: "mild",
                note: "Heat stress beginning"
            }, {
                minTemp: 28,
                maxTemp: 32,
                coefficient: .4,
                stress: "severe",
                note: "Significant heat stress"
            }, {
                minTemp: 32,
                maxTemp: 999,
                coefficient: .15,
                stress: "critical",
                note: "Survival mode - expect decline"
            }],
            transitioning: [{
                minTemp: -999,
                maxTemp: 20,
                coefficient: .1,
                stress: "none",
                note: "Too cool for transition"
            }, {
                minTemp: 20,
                maxTemp: 25,
                coefficient: .5,
                stress: "none",
                note: "Transition beginning"
            }, {
                minTemp: 25,
                maxTemp: 30,
                coefficient: .85,
                stress: "none",
                note: "Active transition"
            }, {
                minTemp: 30,
                maxTemp: 35,
                coefficient: 1,
                stress: "none",
                note: "Rapid transition"
            }, {
                minTemp: 35,
                maxTemp: 999,
                coefficient: 1,
                stress: "none",
                note: "Complete transition imminent"
            }]
        },
        a = {
            transitionStart: 150,
            transitionActive: 300,
            transitionComplete: 500,
            soilTempTransitionStart: 18,
            soilTempTransitionActive: 22,
            soilTempRyegrassStress: 28,
            soilTempRyegrassCritical: 32
        };

    function i(t) {
        var a = (t || "perennial_ryegrass").toLowerCase().replace(/\s+/g, "_");
        return e[a] || e.perennial_ryegrass
    }

    function s(e, t) {
        var a = i(t);
        if (e < a.baseTemp) return {
            days: null,
            status: "too_cold",
            message: "Soil temperature (" + e.toFixed(1) + "°C) below base temperature (" + a.baseTemp + "°C). Germination will not occur.",
            confidence: "high"
        };
        if (e > a.maxTemp) return {
            days: null,
            status: "too_hot",
            message: "Soil temperature (" + e.toFixed(1) + "°C) exceeds maximum (" + a.maxTemp + "°C). Germination failure likely.",
            confidence: "high"
        };
        var s = Math.max(0, e - a.baseTemp);
        if (s <= 0) return {
            days: null,
            status: "too_cold",
            message: "No growing degree days accumulating at current temperature.",
            confidence: "high"
        };
        var n = a.gddToGerminate / s,
            o = a.gddToEstablish / s,
            m = "optimal",
            l = "medium";
        return e >= a.optimalMin && e <= a.optimalMax ? (m = "optimal", l = "high") : e < a.optimalMin ? (m = "suboptimal_cold", l = "medium") : (m = "suboptimal_hot", l = "medium"), {
            days: Math.round(n),
            daysToEstablish: Math.round(o),
            gddPerDay: Math.round(10 * s) / 10,
            gddRequired: a.gddToGerminate,
            gddEstablishRequired: a.gddToEstablish,
            status: m,
            message: r(n, m, a),
            confidence: l,
            optimalRange: a.optimalMin + "-" + a.optimalMax + "°C"
        }
    }

    function r(e, t, a) {
        var i = Math.round(e);
        switch (t) {
            case "optimal":
                return a.name + " germination expected in " + i + " days. Conditions optimal.";
            case "suboptimal_cold":
                return a.name + " germination expected in " + i + " days. Slower than optimal due to cool temperatures.";
            case "suboptimal_hot":
                return a.name + " germination expected in " + i + " days. Monitor moisture closely - warm conditions.";
            default:
                return "Germination timeline: approximately " + i + " days."
        }
    }

    function n(e, a) {
        for (var i = (a || "establishing").toLowerCase(), s = t[i] || t.establishing, r = 0; r < s.length; r++) {
            var n = s[r];
            if (e >= n.minTemp && e < n.maxTemp) return {
                coefficient: n.coefficient,
                stress: n.stress,
                note: n.note
            }
        }
        return {
            coefficient: .5,
            stress: "unknown",
            note: "Temperature outside expected range"
        }
    }

    function o(e, t, i) {
        var s = a,
            r = "pre_transition";
        e >= s.transitionComplete ? r = "complete" : e >= s.transitionActive ? r = "active" : e >= s.transitionStart && (r = "starting");
        var n = "cool",
            o = "none";
        t >= s.soilTempRyegrassCritical ? (n = "critical", o = "critical") : t >= s.soilTempRyegrassStress ? (n = "stress", o = "severe") : t >= s.soilTempTransitionActive ? (n = "active", o = "moderate") : t >= s.soilTempTransitionStart && (n = "starting", o = "mild");
        var l = Math.max(0, s.transitionComplete - e);
        return {
            gddPhase: r,
            tempPhase: n,
            accumulatedGDD: Math.round(e),
            soilTemp: t,
            ryegrassStress: o,
            gddRemaining: Math.round(l),
            recommendation: m(r, n, o)
        }
    }

    function m(e, t, a) {
        return "pre_transition" === e ? "Overseed still viable. Monitor soil temperatures for transition onset." : "starting" === e ? "none" === a || "mild" === a ? "Transition beginning. Consider PGR application to prolong C3 cover." : "Transition starting with heat stress. Begin reducing N to C3 to ease transition." : "active" === e ? "severe" === a || "critical" === a ? "Active transition with significant C3 stress. Lower HOC on C4 areas, reduce irrigation frequency." : "Active transition underway. Maintain consistent management to avoid patchiness." : "complete" === e ? "Transition complete or imminent. C4 management protocols. No overseed-specific adjustments needed." : "Monitor conditions and adjust management accordingly."
    }

    function l(e, t, a) {
        var s = i(a),
            r = e || t;
        if (!r && 0 !== r) return {
            suitable: "unknown",
            message: "Temperature data unavailable. Cannot assess overseed window.",
            score: null
        };
        var n, o, m, l = (s.optimalMin + s.optimalMax) / 2,
            d = s.optimalMax - s.optimalMin,
            c = Math.abs(r - l);
        if (r < s.baseTemp || r > s.maxTemp) n = 0;
        else if (r >= s.optimalMin && r <= s.optimalMax) {
            n = 100 - 20 * (c / (d / 2))
        } else if (r < s.optimalMin) {
            var u = s.optimalMin - s.baseTemp;
            n = 80 - (s.optimalMin - r) / u * 60
        } else {
            var p = s.maxTemp - s.optimalMax;
            n = 80 - (r - s.optimalMax) / p * 80
        }
        return (n = Math.max(0, Math.min(100, Math.round(n)))) >= 80 ? (o = "excellent", m = "Excellent conditions for " + s.name + " establishment.") : n >= 60 ? (o = "good", m = "Good conditions. Expect slightly extended germination timeline.") : n >= 40 ? (o = "marginal", m = "Marginal conditions. Consider delaying or using heated germination blankets.") : n > 0 ? (o = "poor", m = "Poor conditions. High risk of establishment failure.") : (o = "unsuitable", m = r < s.baseTemp ? "Too cold for germination. Wait for soil temps above " + s.baseTemp + "°C." : "Too hot for germination. Wait for soil temps below " + s.maxTemp + "°C."), {
            suitable: o,
            score: n,
            message: m,
            currentTemp: r,
            optimalRange: s.optimalMin + "-" + s.optimalMax + "°C",
            species: s.name
        }
    }

    function d(e, t, a) {
        if (!e) return null;
        var i = null,
            r = null;
        t && (t.current && "number" == typeof t.current.temperature && (i = t.current.temperature), t.soil && "number" == typeof t.soil.temperature && (r = t.soil.temperature)), null === r && null !== i && (r = i);
        var o = a && a.species || "perennial_ryegrass",
            m = a && a.stage || e.stage || "establishing",
            d = r || i || 18,
            u = n(d, m),
            p = e.multiplier * u.coefficient,
            g = s(d, o),
            f = l(r, i, o);
        return {
            baseMultiplier: e.multiplier,
            baseStage: e.stage,
            adjustedMultiplier: Math.round(100 * p) / 100,
            temperatureCoefficient: u.coefficient,
            temperatureStress: u.stress,
            temperatureNote: u.note,
            airTemp: i,
            soilTemp: r,
            // b35fix138: effectiveTemp is what actually drives the coefficient (soilTemp preferred, airTemp fallback)
            effectiveTemp: d,
            effectiveTempSource: r !== null ? 'soil' : 'air',
            soilTempSource: t && t.soil && t.soil.temperature ? "measured" : "estimated",
            weatherStatus: function() {
                if (void 0 !== window.GAIP_WeatherResilience) {
                    var e = window.GAIP_WeatherResilience.getStatus();
                    return {
                        status: e.status || "unknown",
                        fetchedAt: e.fetchedAt || null,
                        cacheAge: e.cacheAge || null,
                        isLive: "live" === e.status,
                        isCached: "cached" === e.status || "cached_stale" === e.status,
                        isEstimated: "estimated" === e.status
                    }
                }
                return {
                    status: "unknown",
                    isLive: !1,
                    isCached: !1,
                    isEstimated: !0
                }
            }(),
            germination: g,
            overseedWindow: f,
            stage: m,
            recommendation: c(p, u, g, f, m, a)
        }
    }

    function c(e, t, a, i, s, r) {
        var n = [],
            o = (s || "").toLowerCase();
        return "dominant_summer" === o || "established_summer" === o ? (n.push("Summer maintenance mode: Prioritising ryegrass survival over transition."), r && r.currentTemp && (r.currentTemp > 32 ? n.push("🔴 Critical heat stress. Syringe 2-3x daily, avoid traffic during peak heat.") : r.currentTemp > 28 ? n.push("⚠️ High heat stress. Increase syringing, maintain adequate N.") : r.currentTemp > 24 ? n.push("Moderate heat, monitor for stress signs, maintain consistent irrigation.") : n.push("✓ Mild conditions currently. Good window for recovery/maintenance.")), n.push("Maintain higher HOC (>15mm) to reduce stress."), n.push("Apply light, frequent N to maintain colour without excessive growth."), n.push("Consider foliar iron for colour without growth flush."), n) : "stressed" === o ? (n.push("⚠️ Low ryegrass coverage under summer stress."), n.push("Consider whether ryegrass can survive, may need to accept transition."), r && r.currentTemp && r.currentTemp > 30 && n.push("Extreme heat, ryegrass survival unlikely without intensive management."), n) : "transitioning" === o ? (n.push("C4 base grass is recovering, ryegrass declining naturally as expected for this season."), r && r.currentTemp && (r.currentTemp > 32 ? n.push("🔴 High heat accelerating ryegrass decline. Focus irrigation on C4 areas.") : r.currentTemp > 28 ? n.push("⚠️ Warm temps accelerating transition. Reduce N to ryegrass areas.") : r.currentTemp > 24 ? n.push("Moderate temps, ryegrass fading on schedule. Shift focus to couch requirements.") : n.push("Mild temps slowing ryegrass decline. Continue supporting C4 recovery.")), n.push("Lower mowing height on couch areas to encourage competition over ryegrass."), n) : "fading" === o ? (n.push("Ryegrass fading as expected for season. C4 base taking over."), n.push("Shift management focus to warm-season base grass requirements."), n.push("Reduce irrigation frequency to suit C4 preferences."), n) : "dying" === o ? (n.push("Ryegrass dying off, normal for late summer."), n.push("Focus entirely on C4 base grass recovery and growth."), n.push("Next overseed window: autumn when soil temps drop below 22°C."), n) : "dominant" === o ? (n.push("Ryegrass dominant. Manage as cool-season turf."), t && t.stress && "none" !== t.stress && n.push("Temperature stress: " + t.note), e < .7 && n.push("Wear tolerance reduced. Consider rest periods after heavy use."), n) : "established" === o ? (n.push("Overseed established and actively growing."), t && t.stress && "none" !== t.stress && n.push("Monitor: " + t.note), n) : "establishing" === o ? (t && t.stress && "none" !== t.stress && n.push("Temperature stress affecting establishment: " + t.note), e < .5 && n.push("Wear tolerance very low (" + Math.round(100 * e) + "%). Limit all traffic."), n) : "germinating" === o || "pre-seed" === o ? (!i || "unsuitable" !== i.suitable && "poor" !== i.suitable ? i && "marginal" === i.suitable ? n.push("Marginal conditions. Consider germination blankets or delaying 1-2 weeks.") : !i || "good" !== i.suitable && "excellent" !== i.suitable || n.push("Good seeding conditions.") : n.push("Current conditions not suitable for seeding. " + (i.message || "")), a && a.days && n.push("Expected germination: " + a.days + " days at current temperatures."), n) : (0 === n.length && n.push("Monitor overseed conditions and adjust management as needed."), n)
    }

    function u(e) {
        // b35fix138: Temperature resolution priority for overseed engine:
        // 1. GAIP_CANONICAL_STATE.sensor.soilTemp  — raw sensor reading (most accurate)
        // 2. GAIP_CANONICAL_STATE.soilTemp.mean    — orchestrator-resolved soil temp (may be physics)
        // 3. climateMetrics air temp               — last resort
        var _soilTemp = null;
        var _airTemp = null;

        if (window.GAIP_CANONICAL_STATE) {
            var _cc = window.GAIP_CANONICAL_STATE;
            // Priority 1: raw sensor soilTemp
            if (_cc.sensor && typeof _cc.sensor.soilTemp === 'number') {
                _soilTemp = _cc.sensor.soilTemp;
            }
            // Priority 2: orchestrator-resolved soilTemp (sensor > API > physics cascade)
            if (_soilTemp === null && _cc.soilTemp && _cc.soilTemp.mean != null) {
                _soilTemp = _cc.soilTemp.mean;
            }
            // Air temp from canonical
            if (_cc.temperature && typeof _cc.temperature.current === 'number') _airTemp = _cc.temperature.current;
            else if (_cc.temperature && typeof _cc.temperature.mean === 'number') _airTemp = _cc.temperature.mean;
        }

        // Priority 3: climateMetrics air temp fallback
        if (_airTemp === null && window.climateMetrics && window.climateMetrics.temperature) {
            _airTemp = window.climateMetrics.temperature.mean || null;
        }

        var t = null;
        if (_soilTemp !== null || _airTemp !== null) {
            t = {
                current: { temperature: _airTemp },
                soil: { temperature: _soilTemp },
                forecast: null
            };
        } else if (window.climateMetrics && window.climateMetrics.temperature) t = {
            current: {
                temperature: window.climateMetrics.temperature.mean
            },
            soil: {
                temperature: window.climateMetrics.temperature.soil
            },
            forecast: null
        };
        else if (window.GAIP_STATE && window.GAIP_STATE.climateMetrics) {
            var a = window.GAIP_STATE.climateMetrics;
            t = {
                current: {
                    temperature: a.temperature ? a.temperature.mean : null
                },
                soil: {
                    temperature: a.temperature ? a.temperature.soil : null
                }
            }
        }
        var i = null;
        if (window.gaip_overseed_multiplier) try {
            i = {
                multiplier: window.gaip_overseed_multiplier(e.stage || "establishing", e.variety || "", e.species || "couch", e.seedingRate).combinedMultiplier,
                stage: e.stage || "establishing"
            }
        } catch (e) {
            console.warn("Could not get base overseed calculation:", e)
        }
        return i || (i = {
            multiplier: e.multiplier || .75,
            stage: e.stage || "establishing"
        }), d(i, t, e)
    }

    function p(e, t, a) {
        if ("undefined" != typeof window && window.GAIP_SOIL_TEMP?.raw?.T_50mm?.length > 0) {
            var i = window.GAIP_SOIL_TEMP.raw.T_50mm,
                s = 24 * (a || 0),
                r = Math.min(s + 24, i.length);
            if (r > s) {
                for (var n = 0, o = 0, m = s; m < r; m++) void 0 !== i[m] && null !== i[m] && (n += i[m], o++);
                if (o > 0) return Math.round(n / o * 10) / 10
            }
            var l = window.GAIP_SOIL_TEMP.summary?.depths?.["50mm"]?.mean;
            if (l) return Math.round(10 * l) / 10
        }
        var d = (e + t) / 2,
            c = 15 * (1 - .85);
        return Math.round(10 * (.85 * d + c)) / 10
    }

    function g(e) {
        var t = i(e),
            a = null;
        if (window.rawWeatherData && (window.rawWeatherData.forecast && window.rawWeatherData.forecast.daily ? a = window.rawWeatherData.forecast.daily : window.rawWeatherData.daily && (a = window.rawWeatherData.daily)), !a || !a.time || 0 === a.time.length) return {
            available: !1,
            message: "Forecast data not available. Run analysis with weather data first.",
            recommendation: null
        };
        for (var r = [], n = null, o = -1, m = 0; m < a.time.length; m++) {
            var d = a.time[m],
                c = a.temperature_2m_max ? a.temperature_2m_max[m] : null,
                u = a.temperature_2m_min ? a.temperature_2m_min[m] : null;
            if (null !== c && null !== u) {
                var g = p(c, u, m),
                    w = ("undefined" != typeof window && window.GAIP_SOIL_TEMP, l(g, (c + u) / 2, e)),
                    T = s(g, e),
                    y = {
                        date: d,
                        dayIndex: m,
                        airTempMax: c,
                        airTempMin: u,
                        airTempAvg: Math.round((c + u) / 2 * 10) / 10,
                        soilTempEst: g,
                        score: w.score,
                        suitable: w.suitable,
                        germDays: T.days,
                        germStatus: T.status
                    };
                r.push(y), w.score > o && (o = w.score, n = y)
            }
        }
        var b = function(e) {
                for (var t = [], a = null, i = 0; i < e.length; i++) {
                    var s = e[i];
                    s.score >= 60 ? (a || (a = {
                        startIndex: i,
                        startDate: s.date,
                        days: [],
                        avgScore: 0,
                        avgSoilTemp: 0
                    }), a.days.push(s)) : (a && a.days.length >= 2 && (f(a), t.push(a)), a = null)
                }
                a && a.days.length >= 2 && (f(a), t.push(a));
                return t
            }(r),
            M = function(e, t, a, i) {
                if (!e || 0 === e.length) return {
                    action: "unknown",
                    message: "No forecast data available",
                    details: null
                };
                var s = e[0],
                    r = s.score >= 60;
                if (s.score >= 80) return {
                    action: "seed_now",
                    urgency: "optimal",
                    message: "Excellent conditions today. Seed now.",
                    details: {
                        soilTemp: s.soilTempEst + "°C",
                        score: s.score + "/100",
                        germDays: s.germDays ? "Expect germination in ~" + s.germDays + " days" : null
                    },
                    forecast: v(e, 7)
                };
                if (r) return a && a.dayIndex > 0 && a.score > s.score + 15 ? {
                    action: "wait_or_seed",
                    urgency: "flexible",
                    message: "Good conditions today, but better in " + a.dayIndex + " days.",
                    details: {
                        todayScore: s.score + "/100",
                        bestDayScore: a.score + "/100",
                        bestDate: a.date,
                        waitDays: a.dayIndex
                    },
                    forecast: v(e, 7)
                } : {
                    action: "seed_now",
                    urgency: "good",
                    message: "Good conditions today. Safe to seed.",
                    details: {
                        soilTemp: s.soilTempEst + "°C",
                        score: s.score + "/100",
                        germDays: s.germDays ? "Expect germination in ~" + s.germDays + " days" : null
                    },
                    forecast: v(e, 7)
                };
                if (t.length > 0) {
                    var n = t[0],
                        o = n.startIndex;
                    return {
                        action: "wait",
                        urgency: "patient",
                        message: "Wait " + o + " day" + (o > 1 ? "s" : "") + ". Better window starting " + n.startDate + ".",
                        details: {
                            todayScore: s.score + "/100",
                            todayIssue: "unsuitable" === s.suitable ? "Conditions too extreme" : "Sub-optimal conditions",
                            windowStart: n.startDate,
                            windowDuration: n.duration + " days",
                            windowAvgScore: n.avgScore + "/100",
                            windowAvgTemp: n.avgSoilTemp + "°C"
                        },
                        forecast: v(e, 7)
                    }
                }
                if (a && a.score > s.score) return {
                    action: "wait",
                    urgency: "marginal",
                    message: "No ideal window in forecast. Best day: " + a.date + " (score " + a.score + "/100).",
                    details: {
                        todayScore: s.score + "/100",
                        bestDayScore: a.score + "/100",
                        bestDate: a.date,
                        issue: h(s, i)
                    },
                    forecast: v(e, 7)
                };
                return {
                    action: "delay",
                    urgency: "not_recommended",
                    message: "Conditions not suitable for overseed in forecast period.",
                    details: {
                        issue: h(s, i),
                        avgScore: Math.round(e.reduce(function(e, t) {
                            return e + t.score
                        }, 0) / e.length)
                    },
                    forecast: v(e, 7)
                }
            }(r, b, n, t);
        return {
            available: !0,
            species: t.name,
            optimalRange: t.optimalMin + "-" + t.optimalMax + "°C",
            dailyAnalysis: r,
            windows: b,
            bestDay: n,
            recommendation: M
        }
    }

    function f(e) {
        for (var t = 0, a = 0, i = 0; i < e.days.length; i++) t += e.days[i].score, a += e.days[i].soilTempEst;
        e.avgScore = Math.round(t / e.days.length), e.avgSoilTemp = Math.round(a / e.days.length * 10) / 10, e.endDate = e.days[e.days.length - 1].date, e.duration = e.days.length
    }

    function h(e, t) {
        return e.soilTempEst < t.optimalMin ? e.soilTempEst < t.baseTemp + 4 ? "Too cold (soil " + e.soilTempEst + "°C) - germination very slow or stalled" : "Cool conditions (soil " + e.soilTempEst + "°C) - below optimal " + t.optimalMin + "°C" : e.soilTempEst > t.optimalMax ? e.soilTempEst >= t.maxTemp ? "Too hot (soil " + e.soilTempEst + "°C) - germination failure likely" : "Warm conditions (soil " + e.soilTempEst + "°C) - above optimal " + t.optimalMax + "°C" : "Marginal conditions"
    }

    function v(e, t) {
        for (var a = [], i = Math.min(t, e.length), s = 0; s < i; s++) {
            var r = e[s];
            a.push({
                date: r.date,
                temp: r.airTempAvg + "°C",
                soilEst: r.soilTempEst + "°C",
                score: r.score,
                rating: r.score >= 80 ? "★★★" : r.score >= 60 ? "★★" : r.score >= 40 ? "★" : "○"
            })
        }
        return a
    }

    function w(e) {
        if (!e) return "";
        var t, a, i = "overseed-climate-" + Date.now(),
            s = function(e) {
                if (!e || "unknown" === e.status) return '<span style="font-size: 10px; color: var(--gaip-text); margin-left: 8px;">(weather: unknown)</span>';
                var t = {
                        live: {
                            icon: "●",
                            color: "#10b981",
                            label: "Live"
                        },
                        cached: {
                            icon: "●",
                            color: "#f59e0b",
                            label: "Cached"
                        },
                        cached_stale: {
                            icon: "●",
                            color: "#ea580c",
                            label: "Cached (aging)"
                        },
                        estimated: {
                            icon: "○",
                            color: "var(--gaip-text-muted)",
                            label: "Estimated"
                        },
                        error: {
                            icon: "●",
                            color: "#ef4444",
                            label: "Error"
                        }
                    },
                    a = t[e.status] || t.estimated;
                return '<span style="font-size: 10px; color: ' + a.color + '; margin-left: 8px;" title="Weather data: ' + a.label + '">' + a.icon + " " + a.label + "</span>"
            }(e.weatherStatus),
            r = (e.stage || "establishing").toLowerCase(),
            n = "transitioning" === r || "fading" === r || "dying" === r,
            o = "dominant_summer" === r || "established_summer" === r || "stressed" === r,
            m = "germinating" === r || "pre-seed" === r;
        o ? (t = "stressed" === r ? "status-deficient" : "status-borderline", a = "dominant_summer" === r ? "Summer Maintenance (High Cover)" : "established_summer" === r ? "Summer Maintenance" : "Summer Stress (Low Cover)") : n ? (t = "status-borderline", a = "transitioning" === r ? "Transition Period" : "fading" === r ? "Ryegrass Fading" : "Ryegrass Dying") : (t = function(e) {
            switch (e) {
                case "none":
                    return "status-adequate";
                case "mild":
                case "moderate":
                default:
                    return "status-borderline";
                case "severe":
                    return "status-deficient";
                case "critical":
                    return "status-critical"
            }
        }(e.temperatureStress), a = function(e) {
            switch (e) {
                case "none":
                    return "Optimal Conditions";
                case "mild":
                    return "Mild Temperature Stress";
                case "moderate":
                    return "Moderate Temperature Stress";
                case "severe":
                    return "Severe Temperature Stress";
                case "critical":
                    return "Critical Temperature Stress";
                default:
                    return "Unknown"
            }
        }(e.temperatureStress));
        var l, d, c = n ? "Overseed Transition Status" : o ? "Overseed Summer Maintenance" : "Climate-Adjusted Overseed Status",
            u = "";
        if (o) {
            var p = "Low",
                g = "✓";
            e.airTemp > 32 ? (p = "Critical", g = "🔴") : e.airTemp > 28 ? (p = "High", g = "⚠️") : e.airTemp > 24 && (p = "Moderate", g = "⚠️"), u = "                <p><strong>Mode:</strong> Maintaining ryegrass through summer</p>                <p><strong>Current temp:</strong> " + (null !== e.airTemp ? e.airTemp.toFixed(1) + "°C" : "N/A") + "</p>                <p><strong>Heat stress:</strong> " + p + " " + g + "</p>"
        } else u = n ? "                <p><strong>Stage:</strong> " + T(r) + "</p>                <p><strong>Current temp:</strong> " + (null !== e.effectiveTemp ? e.effectiveTemp.toFixed(1) + "°C (" + (e.effectiveTempSource === 'soil' ? 'soil' : 'air') + ")" : "N/A") + "</p>                <p><strong>Management focus:</strong> " + ("transitioning" === r ? "Managing ryegrass decline, encouraging C4" : "fading" === r ? "C4 recovery, reduce ryegrass inputs" : "C4 base grass only") + "</p>" : m ? "                <p><strong>Temperature effect:</strong> " + e.temperatureNote + "</p>                " + (e.germination && e.germination.days ? "<p><strong>Germination:</strong> ~" + e.germination.days + " days at current temps</p>" : "") + "                " + (e.overseedWindow ? "<p><strong>Window score:</strong> " + e.overseedWindow.score + "/100 (" + e.overseedWindow.suitable + ")</p>" : "") : "                <p><strong>Stage:</strong> " + T(r) + "</p>                <p><strong>Temperature effect:</strong> " + e.temperatureNote + "</p>                <p><strong>Current temp:</strong> " + (null !== e.effectiveTemp ? e.effectiveTemp.toFixed(1) + "°C (" + (e.effectiveTempSource === 'soil' ? 'soil' : 'air') + ")" : "N/A") + "</p>";
        return n ? (l = T(r.replace("_", " ")), d = "overseed status") : o ? (l = "Maintain", d = "summer mode") : (l = Math.round(100 * e.adjustedMultiplier) + "%", d = "wear tolerance"), '            <div class="gaip-diagnostic-card overseed-climate-card">                <div class="gaip-card-header">                    <span class="gaip-card-title">' + c + "</span>" + s + '                </div>                <div class="gaip-verdict">                    <span class="gaip-status-indicator ' + t + '"></span>                    <span class="gaip-status-text">' + a + '</span>                </div>                <div class="gaip-primary-value">                    <span class="gaip-value">' + l + '</span>                    <span class="gaip-unit">' + d + '</span>                </div>                <div class="gaip-overseed-summary">' + u + '</div>                <button class="gaip-expand-btn" onclick="document.getElementById(\'' + i + "').style.display = document.getElementById('" + i + "').style.display === 'none' ? 'block' : 'none'\">Details ▼</button>                <div id=\"" + i + '" class="gaip-detail-panel" style="display: none;">                    <div class="gaip-overseed-detail">                        <p><strong>Air temp:</strong> ' + (null !== e.airTemp ? e.airTemp.toFixed(1) + "°C" : "N/A") + "</p>                        <p><strong>Soil temp:</strong> " + (null !== e.soilTemp ? e.soilTemp.toFixed(1) + "°C (" + e.soilTempSource + ")" : "N/A") + "</p>                        <p><strong>Weather data:</strong> " + (e.weatherStatus ? e.weatherStatus.status : "unknown") + "</p>                        " + (n || o ? "" : "<p><strong>Base multiplier:</strong> " + Math.round(100 * e.baseMultiplier) + "%</p>") + "                        " + (n || o ? "" : "<p><strong>Temp coefficient:</strong> " + e.temperatureCoefficient.toFixed(2) + "</p>") + "                    </div>                    " + (e.recommendation && e.recommendation.length > 0 ? '                    <div class="gaip-recommendations">                        <p><strong>Recommendations:</strong></p>                        <ul>' + e.recommendation.map(function(e) {
            return "<li>" + e + "</li>"
        }).join("") + "</ul>                    </div>" : "") + "                </div>            </div>"
    }

    function T(e) {
        return e.charAt(0).toUpperCase() + e.slice(1)
    }

    function y() {
        if ("function" != typeof window.gaip_overseed_multiplier) return console.warn("Overseed Climate: Base overseed multiplier not loaded"), !1;
        var e = window.gaip_overseed_multiplier;
        return window.gaip_overseed_multiplier = function(t, a, i, s) {
            var r = e(t, a, i, s),
                n = null;
            // b35fix138: sensor.soilTemp → canonical soilTemp → air temp
            var _ySoilTemp = null, _yAirTemp = null;
            if (window.GAIP_CANONICAL_STATE) {
                var _ycc = window.GAIP_CANONICAL_STATE;
                // Priority 1: raw sensor soilTemp
                if (_ycc.sensor && typeof _ycc.sensor.soilTemp === 'number') {
                    _ySoilTemp = _ycc.sensor.soilTemp;
                }
                // Priority 2: orchestrator-resolved soilTemp
                if (_ySoilTemp === null && _ycc.soilTemp && _ycc.soilTemp.mean != null) {
                    _ySoilTemp = _ycc.soilTemp.mean;
                }
                if (_ycc.temperature && _ycc.temperature.current != null) _yAirTemp = _ycc.temperature.current;
                else if (_ycc.temperature && _ycc.temperature.mean != null) _yAirTemp = _ycc.temperature.mean;
            }
            if (_ySoilTemp !== null || _yAirTemp !== null) {
                n = {
                    current: { temperature: _yAirTemp },
                    soil: { temperature: _ySoilTemp }
                };
            } else if (window.climateMetrics && window.climateMetrics.temperature) {
                n = {
                    current: { temperature: window.climateMetrics.temperature.mean },
                    soil: { temperature: window.climateMetrics.temperature.soil }
                };
            } else if (window.GAIP_STATE && window.GAIP_STATE.climateMetrics && window.GAIP_STATE.climateMetrics.temperature) {
                var o = window.GAIP_STATE.climateMetrics;
                n = {
                    current: { temperature: o.temperature.mean },
                    soil: { temperature: o.temperature.soil }
                };
            }
            if (n && (n.current.temperature || n.soil.temperature)) {
                var m = d({
                    multiplier: r.combinedMultiplier,
                    stage: t
                }, n, {
                    species: "perennial_ryegrass",
                    stage: t
                });
                m && (r.climateEnhanced = !0, r.climateAdjustedMultiplier = m.adjustedMultiplier, r.temperatureCoefficient = m.temperatureCoefficient, r.temperatureStress = m.temperatureStress, r.temperatureNote = m.temperatureNote, r.germination = m.germination, r.overseedWindow = m.overseedWindow, r.climateRecommendations = m.recommendation, r.airTemp = m.airTemp, r.soilTemp = m.soilTemp, r.effectiveTemp = m.effectiveTemp, r.effectiveTempSource = m.effectiveTempSource)
            }
            return r
        }, !0
    }
    document.addEventListener("gaip:hub-state-update", function(e) {
            var t = e.detail,
                a = t ? t.state : null;
            if (a && a.turf) {
                var i = a.turf.overseedStatus || "none";

                // v1.2.0 FIX: Improved isC4Base detection for overseed scenarios
                // Check multiple sources to determine if there's a C4 base:
                // 1. Explicit grassType === "C4"
                // 2. grassSpecies is a known C4 grass
                // 3. warmBase field contains a C4 grass (even if grassSpecies is the C3 overseed)
                // 4. coolOverseed is populated AND we're in a C4-viable climate zone (inferred overseed)

                var c4GrassList = ["couch", "bermuda", "kikuyu", "buffalo", "zoysia", "seashore_paspalum", "st_augustine", "centipede", "bahia"];
                var c3GrassList = ["perennial_ryegrass", "annual_ryegrass", "fine_fescue", "tall_fescue", "kentucky_bluegrass", "poa_trivialis", "creeping_bentgrass", "colonial_bentgrass", "poa_annua"];

                var normalizedGrassSpecies = (a.turf.grassSpecies || "").toLowerCase().replace(/\s+/g, "_");
                var normalizedWarmBase = (a.turf.warmBase || "").toLowerCase().replace(/\s+/g, "_");
                var normalizedCoolOverseed = (a.turf.coolOverseed || "").toLowerCase().replace(/\s+/g, "_");

                // Primary check: Is the selected grassSpecies a C4 grass?
                var grassSpeciesIsC4 = "C4" === a.turf.grassType || c4GrassList.includes(normalizedGrassSpecies);

                // Secondary check: Is there a C4 warm base specified?
                var hasC4WarmBase = normalizedWarmBase && c4GrassList.includes(normalizedWarmBase);

                // Tertiary check: Is grassSpecies a C3 but coolOverseed matches it? (User selected overseed as main species)
                var grassSpeciesIsC3 = c3GrassList.includes(normalizedGrassSpecies);
                var coolOverseedMatchesGrassSpecies = normalizedCoolOverseed && normalizedGrassSpecies &&
                    (normalizedCoolOverseed === normalizedGrassSpecies ||
                        normalizedGrassSpecies.includes(normalizedCoolOverseed) ||
                        normalizedCoolOverseed.includes(normalizedGrassSpecies));

                // Climate zone check for C4 viability (subtropical/tropical latitudes)
                var lat = a.climate ? a.climate.lat : null;
                var isC4ViableClimate = lat !== null && Math.abs(lat) < 38; // Roughly transition zone and warmer

                // Determine isC4Base using all available signals
                var s = grassSpeciesIsC4 || hasC4WarmBase;

                // v1.2.2 FIX: Do NOT infer overseed just because C3 is selected in C4-viable climate
                // Many sports fields maintain permanent cool-season turf in subtropical climates
                // Only treat as overseed if warmBase is EXPLICITLY set by the user
                if (!s && grassSpeciesIsC3 && isC4ViableClimate) {
                    // Previously this would set s=true and infer couch base - REMOVED
                    // Now we only log that this is straight C3 turf in a warm climate
                }
                
                // v1.2.3 FIX: Pure C4 site with no overseed configured — exit early.
                // If the base species is C4 but coolOverseed is empty, there is no overseed
                // programme. Skip the entire overseed block to prevent stale c3Fraction values
                // or default "perennial_ryegrass" fallbacks corrupting the N distribution.
                if (s && !normalizedCoolOverseed) {
                    // Clear any stale overseed state from a previous site/species
                    if (window.GAIP_OVERSEED_STATE) {
                        window.GAIP_OVERSEED_STATE = null;
                        window.GAIP_OVERSEED_CLIMATE_RESULT = null;
                        document.dispatchEvent(new CustomEvent("gaip:overseed-fraction-update", {
                            detail: { c3Fraction: 0, c4Fraction: 1, isC4Base: true, cleared: true, source: "overseed-climate-integration-v1.2.3" }
                        }));
                    }
                    var card = document.getElementById("gaip-overseed-climate-container");
                    if (card) card.remove();
                    return; // Nothing more to do for pure C4
                }

                // c3Fraction: use explicit value or calculate from scenario
                var r = a.turf.species && a.turf.species.c3Fraction || a.turf.c3Fraction || (a.turf.percentC3Cover ? a.turf.percentC3Cover / 100 : 0);

                // v1.2.0: If we inferred C4 base but c3Fraction is 0, set a reasonable default based on season
                if (s && r === 0 && (normalizedCoolOverseed || grassSpeciesIsC3)) {
                    var month = (new Date).getMonth() + 1;
                    var isSouthern = lat && lat < 0;
                    var isSummer = isSouthern ? (month >= 11 || month <= 2) : (month >= 5 && month <= 8);
                    var isWinter = isSouthern ? (month >= 5 && month <= 8) : (month >= 11 || month <= 2);
                    // Default c3Fraction based on season for maintained overseed
                    r = isSummer ? 0.3 : isWinter ? 0.8 : 0.5;
                }

                var n = null;
                window.climateMetrics && window.climateMetrics.temperature ? n = window.climateMetrics.temperature.mean : a.climateMetrics && a.climateMetrics.temperature && (n = a.climateMetrics.temperature.mean);
                var o = a.climate ? a.climate.lat : null,
                    m = o && o < 0,
                    l = (new Date).getMonth() + 1,
                    d = m ? l >= 11 || l <= 2 : l >= 5 && l <= 8,
                    c = m ? l >= 3 && l <= 5 : l >= 9 && l <= 11,
                    p = a.turf.overseedSummerIntent || "transition";
                if (s && r >= .2 && "none" === i && (i = d ? "maintain" === p ? r >= .7 ? "dominant_summer" : r >= .5 ? "established_summer" : "stressed" : r >= .5 ? "transitioning" : "fading" : r >= .7 ? "dominant" : r >= .5 ? "established" : "establishing"), "none" !== i) {

                    // v1.2.0: Determine the actual base species and overseed species correctly
                    var actualBaseSpecies, actualOverseedSpecies;
                    if (grassSpeciesIsC4) {
                        // Normal case: grassSpecies is C4, coolOverseed is the overseed
                        actualBaseSpecies = a.turf.grassSpecies || "couch";
                        actualOverseedSpecies = a.turf.coolOverseed || "perennial_ryegrass";
                    } else if (hasC4WarmBase) {
                        // warmBase contains the C4 base
                        actualBaseSpecies = a.turf.warmBase;
                        actualOverseedSpecies = a.turf.coolOverseed || a.turf.grassSpecies || "perennial_ryegrass";
                    } else if (grassSpeciesIsC3 && s) {
                        // Inferred scenario: grassSpecies is the C3 overseed, base is unknown C4
                        actualBaseSpecies = "couch"; // Default to couch for Australian context
                        actualOverseedSpecies = a.turf.grassSpecies;
                    } else {
                        actualBaseSpecies = a.turf.grassSpecies || "couch";
                        actualOverseedSpecies = a.turf.coolOverseed || "perennial_ryegrass";
                    }

                    var g = u({
                        species: actualOverseedSpecies,
                        stage: i,
                        variety: a.turf.overseedVariety || a.turf.variety || "",
                        baseSpecies: actualBaseSpecies,
                        seedingRate: a.turf.overseedRate,
                        c3Fraction: r,
                        isSummer: d,
                        isAutumn: c,
                        currentTemp: n,
                        summerIntent: p
                    });
                    window.GAIP_OVERSEED_CLIMATE_RESULT = g;

                    // v1.2.0: Propagate corrected overseed state to global for other modules
                    window.GAIP_OVERSEED_STATE = {
                        isC4Base: s,
                        c3Fraction: r,
                        baseSpecies: actualBaseSpecies,
                        overseedSpecies: actualOverseedSpecies,
                        stage: i,
                        isSummer: d,
                        isAutumn: c,
                        summerIntent: p,
                        inferred: grassSpeciesIsC3 && s // Flag if this was an inferred scenario
                    };

                    document.dispatchEvent(new CustomEvent("gaip:overseed-climate-update", {
                        detail: g
                    }));

                    // v1.2.0: Also dispatch corrected c3Fraction for Climate Module V2 and N distribution
                    document.dispatchEvent(new CustomEvent("gaip:overseed-fraction-update", {
                        detail: {
                            c3Fraction: r,
                            c4Fraction: 1 - r,
                            isC4Base: s,
                            source: "overseed-climate-integration"
                        }
                    }));

                    g && !g.error && function(e) {
                        var t = document.querySelector(".gaip-results");
                        if (!t) return void console.warn("[OverseedClimate] No .gaip-results container found");
                        var a = document.getElementById("gaip-overseed-climate-container");
                        a && a.remove();
                        var i = (e.stage || "").toLowerCase(),
                            s = "dominant_summer" === i || "established_summer" === i || "stressed" === i,
                            r = "transitioning" === i || "fading" === i || "dying" === i ? "Overseed Transition" : s ? "Overseed Summer Management" : "Winter Overseed Status",
                            n = document.createElement("div");
                        n.id = "gaip-overseed-climate-container", n.className = "gaip-integration-module", n.style.cssText = "margin-top: 20px;", n.innerHTML = '            <h3 style="font-size: 16px; font-weight: 600; color: #1e3a5f; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #10b981;">                🌱 ' + r + "            </h3>" + w(e);
                        var o = t.querySelector('[data-section="wear"]'),
                            m = t.querySelector('[data-section="climate"]'),
                            l = t.querySelector('[data-section="disease"]');
                        o ? o.parentNode.insertBefore(n, o.nextSibling) : l ? l.parentNode.insertBefore(n, l.nextSibling) : m ? m.parentNode.insertBefore(n, m.nextSibling) : t.appendChild(n);
                    }(g)
                } else {
                    var f = document.getElementById("gaip-overseed-climate-container");
                    f && f.remove();

                    // v1.2.1: Clear global overseed state when no active overseed scenario
                    // This prevents stale state from PRG->Couch transitions causing two-click issues
                    if (window.GAIP_OVERSEED_STATE) {
                        window.GAIP_OVERSEED_STATE = null;
                        window.GAIP_OVERSEED_CLIMATE_RESULT = null;

                        // Notify other modules that overseed state has been cleared
                        document.dispatchEvent(new CustomEvent("gaip:overseed-fraction-update", {
                            detail: {
                                c3Fraction: 0,
                                c4Fraction: 1,
                                isC4Base: grassSpeciesIsC4,
                                cleared: true,
                                source: "overseed-climate-integration"
                            }
                        }));
                    }
                }
            }
        }),

        // v1.2.1: Listen to turf profile changes to clear stale overseed state IMMEDIATELY
        // This fires when user changes species dropdown, BEFORE clicking Run
        document.addEventListener("gaip:turf-profile-change", function(e) {
            var detail = e.detail;
            if (!detail || !detail.species) return;

            var c4GrassList = ["couch", "bermuda", "kikuyu", "buffalo", "zoysia", "seashore_paspalum", "st_augustine", "centipede", "bahia"];
            var normalizedSpecies = (detail.species || "").toLowerCase().replace(/\s+/g, "_");
            var isC4Species = c4GrassList.includes(normalizedSpecies);

            // If switching to C4 and there's stale overseed state, clear it immediately
            if (isC4Species && window.GAIP_OVERSEED_STATE) {
                // Check if coolOverseed is populated - if not, it's a pure C4 scenario
                var coolOverseed = detail.coolOverseed || "";
                if (!coolOverseed) {
                    window.GAIP_OVERSEED_STATE = null;
                    window.GAIP_OVERSEED_CLIMATE_RESULT = null;

                    // Remove the overseed card if present
                    var card = document.getElementById("gaip-overseed-climate-container");
                    if (card) card.remove();

                    // Notify other modules
                    document.dispatchEvent(new CustomEvent("gaip:overseed-fraction-update", {
                        detail: {
                            c3Fraction: 0,
                            c4Fraction: 1,
                            isC4Base: true,
                            cleared: true,
                            source: "overseed-climate-integration-turf-change"
                        }
                    }));
                }
            }
        });

        // b35fix138: re-run overseed calculation when sensor data arrives.
        // gaip:sensor-data-imported = CSV import. gaip:sensor:updated = Hydrosight live fetch.
        var _overseedOnSensorUpdate = function() {
            if (window.GAIP_OVERSEED_STATE) setTimeout(y, 300);
        };
        document.addEventListener("gaip:sensor-data-imported", _overseedOnSensorUpdate);
        document.addEventListener("gaip:sensor:updated", _overseedOnSensorUpdate);

        "function" == typeof window.gaip_overseed_multiplier ? y() : document.addEventListener("DOMContentLoaded", function() {
            setTimeout(y, 200)
        }), window.gaip_overseed_climate = {
            calculateDaysToGermination: s,
            getTemperatureCoefficient: n,
            calculateTransitionStatus: o,
            assessOverseedWindow: l,
            estimateSoilTemp: function(e) {
                if ("undefined" != typeof window && window.GAIP_SOIL_TEMP?.summary?.depths?.["50mm"]?.mean) return window.GAIP_SOIL_TEMP.summary.depths["50mm"].mean;
                if (!e || 0 === e.length) return null;
                var t = e.slice(-3),
                    a = t.reduce(function(e, t) {
                        return e + t
                    }, 0) / t.length,
                    i = a + .15 * (15 - a);
                return Math.round(10 * i) / 10
            },
            analyzeOverseedWindow: g,
            enhanceMultiplier: d,
            getEnhanced: u,
            renderCard: w,
            renderWindowCard: function(e) {
                if (!e || !e.available) return "";
                var t = e.recommendation,
                    a = "overseed-window-" + Date.now(),
                    i = function(e) {
                        switch (e) {
                            case "seed_now":
                            case "wait_or_seed":
                                return "status-adequate";
                            case "wait":
                            default:
                                return "status-borderline";
                            case "delay":
                                return "status-deficient"
                        }
                    }(t.action),
                    s = "";
                if (t.forecast && t.forecast.length > 0)
                    for (var r = 0; r < t.forecast.length; r++) {
                        var n = t.forecast[r];
                        s += "<tr><td>" + n.date + "</td><td>" + n.temp + "</td><td>" + n.soilEst + "</td><td>" + n.score + "</td><td>" + n.rating + "</td></tr>"
                    }
                return '            <div class="gaip-diagnostic-card overseed-window-card">                <div class="gaip-card-header">                    <span class="gaip-card-title">Overseed Window Analysis</span>                </div>                <div class="gaip-verdict">                    <span class="gaip-status-indicator ' + i + '"></span>                    <span class="gaip-status-text">' + t.message + '</span>                </div>                <div class="gaip-overseed-recommendation">                    <p><strong>Species:</strong> ' + e.species + "</p>                    <p><strong>Optimal soil temp:</strong> " + e.optimalRange + "</p>                    " + (t.details ? function(e) {
                    var t = '<div class="gaip-rec-details" style="margin-top:8px; padding:8px; background:var(--gaip-surface-muted); border-radius:4px; font-size:13px;">';
                    for (var a in e) {
                        if (e.hasOwnProperty(a) && null !== e[a]) t += '<p style="margin:2px 0;"><strong>' + a.replace(/([A-Z])/g, " $1").replace(/^./, function(e) {
                            return e.toUpperCase()
                        }) + ":</strong> " + e[a] + "</p>"
                    }
                    return t += "</div>"
                }(t.details) : "") + '                </div>                <button class="gaip-expand-btn" onclick="document.getElementById(\'' + a + "').style.display = document.getElementById('" + a + "').style.display === 'none' ? 'block' : 'none'\">7-Day Forecast ▼</button>                <div id=\"" + a + '" class="gaip-detail-panel" style="display: none;">                    <table class="gaip-forecast-table" style="width:100%; font-size:12px; border-collapse:collapse;">                        <thead><tr style="background:var(--gaip-surface-hover);"><th>Date</th><th>Air</th><th>Soil</th><th>Score</th><th>Rating</th></tr></thead>                        <tbody>' + s + '</tbody>                    </table>                    <p style="font-size:11px; color:var(--gaip-text); margin-top:8px;">★★★ = Excellent (80+) | ★★ = Good (60-79) | ★ = Marginal (40-59) | ○ = Poor</p>                </div>            </div>'
            },
            GERMINATION_PARAMS: e,
            ESTABLISHMENT_COEFFICIENTS: t,
            TRANSITION_TRIGGERS: a
        }, window.gaip_overseed_germination = s, window.gaip_overseed_temp_coeff = n, window.gaip_overseed_transition = o, window.gaip_overseed_window = l, window.gaip_overseed_forecast = g
}();