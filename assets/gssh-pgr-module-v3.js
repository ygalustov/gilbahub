! function(e) {
    "use strict";
    const a = {
        version: "3.6.0",  // v3.6.0: Forward-port from GAIP v3.6.0 — amplitude-dampened sinewave, PHC reapplication fix
        gddBaseTemperatures: {
            c3: {
                value: 0,
                label: "0°C (Kreuser standard for C3)",
                source: "Kreuser & Soldat 2011"
            },
            c4: {
                value: 10,
                label: "10°C (Reasor standard for C4)",
                source: "Reasor et al. 2018"
            },
            kikuyu: {
                value: 10,
                label: "10°C (C4 grass)",
                source: "Extrapolated from C4"
            }
        },
        defaults: {
            maxDailyGDD: 30
        },
        crownTemperature: {
            enabled: !0,
            airWeight: .6,
            soilWeight: .4,
            source: "Beard (1973), adapted from crown temp studies"
        },
        mowingHeightCategories: {
            greens: {
                label: "Greens (<6mm)",
                maxHeight: 6,
                thresholdMultiplier: 1,
                description: "Putting greens, bowling greens"
            },
            tees: {
                label: "Tees (6-15mm)",
                maxHeight: 15,
                thresholdMultiplier: 1.25,
                description: "Tees, surrounds, approaches"
            },
            fairways: {
                label: "Fairways (15-20mm)",
                maxHeight: 20,
                thresholdMultiplier: 1.5,
                description: "Fairways, cricket wicket blocks"
            },
            athletic: {
                label: "Athletic/Sports (20-40mm)",
                maxHeight: 40,
                thresholdMultiplier: 1.75,
                description: "Sports fields, cricket outfields, stadium turf"
            },
            rough: {
                label: "Rough/Lawns (>40mm)",
                maxHeight: 1 / 0,
                thresholdMultiplier: 2,
                description: "Semi-rough, lawns, general turf"
            }
        },
        speciesThresholds: {
            TE: {
                creeping_bentgrass: {
                    gddBase: 0,
                    confidence: "HIGH",
                    greens: {
                        gdd: 200,
                        source: "Kreuser & Soldat 2011"
                    },
                    tees: {
                        gdd: 250,
                        source: "Kreuser research"
                    },
                    fairways: {
                        gdd: 300,
                        source: "Kreuser 2016"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .35,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                browntop_bentgrass: {
                    gddBase: 0,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 200,
                        source: "Extrapolated from creeping bent"
                    },
                    tees: {
                        gdd: 250,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 300,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .32,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                annual_bluegrass: {
                    gddBase: 0,
                    confidence: "HIGH",
                    greens: {
                        gdd: 200,
                        source: "Kreuser - same timing as bentgrass"
                    },
                    tees: {
                        gdd: 250,
                        source: "Kreuser research"
                    },
                    fairways: {
                        gdd: 300,
                        source: "Cornell Turf"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    sensitivityModifier: 1.4,
                    sinewave: {
                        amplitude: .45,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                perennial_ryegrass: {
                    gddBase: 0,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 250,
                        source: "Estimated - no GDD study"
                    },
                    tees: {
                        gdd: 280,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 320,
                        source: "Extrapolated from bentgrass"
                    },
                    athletic: {
                        gdd: 380,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 400,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .55,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                kentucky_bluegrass: {
                    gddBase: 0,
                    confidence: "LOW",
                    greens: {
                        gdd: 200,
                        source: "Extrapolated from bentgrass"
                    },
                    tees: {
                        gdd: 280,
                        source: 'Kreuser notes KBG "more sensitive"'
                    },
                    fairways: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 400,
                        source: "Conservative"
                    }
                },
                fine_fescue: {
                    gddBase: 0,
                    confidence: "LOW",
                    fairways: {
                        gdd: 300,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 350,
                        source: "Extrapolated"
                    }
                },
                tall_fescue: {
                    gddBase: 0,
                    confidence: "LOW",
                    fairways: {
                        gdd: 320,
                        source: "Extrapolated - less responsive"
                    },
                    athletic: {
                        gdd: 380,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 380,
                        source: "Extrapolated"
                    }
                },
                ultradwarf_bermuda: {
                    gddBase: 10,
                    confidence: "HIGH",
                    greens: {
                        gdd: 220,
                        source: "Reasor et al. 2018"
                    },
                    tees: {
                        gdd: 275,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .55,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .75,
                        decayCoeff: 400
                    }
                },
                bermudagrass: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 240,
                        source: "Extrapolated from ultradwarf"
                    },
                    tees: {
                        gdd: 280,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 320,
                        source: "Extrapolated - higher HOC"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Fagerness & Yelverton 2000"
                    },
                    rough: {
                        gdd: 380,
                        source: "Conservative estimate"
                    },
                    sinewave: {
                        amplitude: .45,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .6,
                        decayCoeff: 800
                    }
                },
                couch: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 240,
                        source: "Same as bermudagrass"
                    },
                    tees: {
                        gdd: 280,
                        source: "Same as bermudagrass"
                    },
                    fairways: {
                        gdd: 320,
                        source: "Same as bermudagrass"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Same as bermudagrass"
                    },
                    rough: {
                        gdd: 380,
                        source: "Same as bermudagrass"
                    },
                    sinewave: {
                        amplitude: .45,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .6,
                        decayCoeff: 800
                    }
                },
                santa_ana: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 240,
                        source: "Hybrid couch - same as bermuda"
                    },
                    tees: {
                        gdd: 280,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 320,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 380,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .45,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .6,
                        decayCoeff: 800
                    }
                },
                zoysiagrass: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 260,
                        source: "Ledford 2019 - Diamond zoysia"
                    },
                    tees: {
                        gdd: 300,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 340,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 380,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 400,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .4,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .6,
                        decayCoeff: 400
                    }
                },
                kikuyu: {
                    gddBase: 10,
                    confidence: "LOW",
                    notes: "No peer-reviewed GDD curve. Operational calibration: 180-220 GDD re-application interval (base 10°C), peak suppression 7-14d, decline 14-21d, rebound ~200 GDD. Roche 2013 (rate-response), Petelewicz/Schiavon/Baird (quality), Mock 2016 (integrated management). Kikuyu not used on greens. Athletic/rough scaled from fairway anchor.",
                    firstApplication: {
                        gdd: 110,
                        source: "Operational: 100-120 GDD after active growth commencement"
                    },
                    tees: {
                        gdd: 200,
                        source: "Operational calibration: 180-220 GDD interval, lower end for close-mown tees"
                    },
                    fairways: {
                        gdd: 200,
                        source: "Operational calibration: 180-220 GDD interval, lower end for managed fairways"
                    },
                    athletic: {
                        gdd: 220,
                        source: "Operational calibration: 180-220 GDD interval, upper end for sports turf"
                    },
                    rough: {
                        gdd: 280,
                        source: "Extrapolated from athletic with HOC adjustment"
                    },
                    nitrogenInteraction: {
                        lowN: "Shortens effective suppression, accelerates rebound",
                        adequateN: "Extends suppression, improves density and firmness"
                    }
                },
                buffalo: {
                    gddBase: 10,
                    confidence: "LOW",
                    greens: {
                        gdd: 300,
                        source: "Estimated"
                    },
                    tees: {
                        gdd: 340,
                        source: "Estimated"
                    },
                    fairways: {
                        gdd: 380,
                        source: "Estimated"
                    },
                    athletic: {
                        gdd: 400,
                        source: "Estimated"
                    }
                },
                seashore_paspalum: {
                    gddBase: 10,
                    confidence: "LOW",
                    greens: {
                        gdd: 250,
                        source: "Extrapolated from bermuda"
                    },
                    tees: {
                        gdd: 290,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 330,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 370,
                        source: "Extrapolated"
                    }
                },
                bahiagrass: {
                    gddBase: 10,
                    confidence: "LOW",
                    fairways: {
                        gdd: 350,
                        source: "Limited research"
                    },
                    athletic: {
                        gdd: 400,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 420,
                        source: "Extrapolated"
                    }
                },
                c3_default: {
                    gddBase: 0,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 200,
                        source: "Kreuser bentgrass baseline"
                    },
                    tees: {
                        gdd: 250,
                        source: "Kreuser research"
                    },
                    fairways: {
                        gdd: 300,
                        source: "Kreuser 2016"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .35,
                        periodMultiplier: 2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                c4_default: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 240,
                        source: "Extrapolated from bermuda"
                    },
                    tees: {
                        gdd: 280,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 320,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 350,
                        source: "Extrapolated"
                    },
                    rough: {
                        gdd: 380,
                        source: "Conservative"
                    },
                    sinewave: {
                        amplitude: .45,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .6,
                        decayCoeff: 400
                    }
                }
            },
            PBZ: {
                creeping_bentgrass: {
                    gddBase: 0,
                    confidence: "HIGH",
                    greens: {
                        gdd: 285,
                        source: "Kreuser 2018: 269-302 GDD₀"
                    },
                    tees: {
                        gdd: 340,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 380,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .5,
                        periodMultiplier: 2.2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                annual_bluegrass: {
                    gddBase: 0,
                    confidence: "HIGH",
                    greens: {
                        gdd: 285,
                        source: "Kreuser 2018"
                    },
                    tees: {
                        gdd: 340,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 380,
                        source: "Extrapolated"
                    },
                    sensitivityModifier: 1.5,
                    sinewave: {
                        amplitude: .55,
                        periodMultiplier: 2.2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                zoysiagrass: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 300,
                        source: "Ledford 2019"
                    },
                    tees: {
                        gdd: 340,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .4,
                        periodMultiplier: 2.2,
                        hasRebound: !1,
                        mspRatio: .5,
                        decayCoeff: 400
                    }
                },
                c3_default: {
                    gddBase: 0,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 285,
                        source: "Kreuser 2018"
                    },
                    tees: {
                        gdd: 340,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 380,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 420,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .45,
                        periodMultiplier: 2.2,
                        hasRebound: !0,
                        mspRatio: .5,
                        decayCoeff: 800
                    }
                },
                c4_default: {
                    gddBase: 10,
                    confidence: "LOW",
                    greens: {
                        gdd: 280,
                        source: "No research"
                    },
                    tees: {
                        gdd: 320,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 360,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 400,
                        source: "Extrapolated"
                    }
                }
            },
            PHC: {
                ultradwarf_bermuda: {
                    gddBase: 10,
                    confidence: "HIGH",
                    greens: {
                        gdd: 123,
                        source: "Reasor et al. 2018: MSP 92-97 GDD₁₀, reapplication 1.3×MSP = 120-126 GDD₁₀"
                    },
                    tees: {
                        gdd: 160,
                        source: "Extrapolated from greens reapplication interval"
                    },
                    sinewave: {
                        amplitude: .52,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .75,
                        decayCoeff: 400
                    }
                },
                bermudagrass: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 123,
                        source: "Reasor et al. 2018: reapplication 1.3×MSP, adapted from ultradwarf"
                    },
                    tees: {
                        gdd: 160,
                        source: "Extrapolated from greens reapplication interval"
                    },
                    fairways: {
                        gdd: 150,
                        source: "Higher HOC"
                    },
                    athletic: {
                        gdd: 180,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .48,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .7,
                        decayCoeff: 400
                    }
                },
                couch: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 123,
                        source: "Same as bermudagrass (Reasor reapplication interval)"
                    },
                    tees: {
                        gdd: 160,
                        source: "Same as bermudagrass"
                    },
                    fairways: {
                        gdd: 150,
                        source: "Same as bermudagrass"
                    },
                    athletic: {
                        gdd: 180,
                        source: "Same as bermudagrass"
                    },
                    sinewave: {
                        amplitude: .48,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .7,
                        decayCoeff: 400
                    }
                },
                creeping_bentgrass: {
                    gddBase: 0,
                    confidence: "HIGH",
                    greens: {
                        gdd: 300,
                        source: "Kreuser 2015: 300 GDD₀ on bentgrass greens"
                    },
                    tees: {
                        gdd: 320,
                        source: "Label: 280-350 GDD"
                    },
                    fairways: {
                        gdd: 350,
                        source: "Nufarm label: 280-350 GDD for fairways"
                    },
                    sinewave: {
                        amplitude: .40,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .6,
                        decayCoeff: 400
                    }
                },
                annual_bluegrass: {
                    gddBase: 0,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 200,
                        source: "Poa more sensitive - shorter interval than bentgrass"
                    },
                    tees: {
                        gdd: 250,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 280,
                        source: "Label lower end"
                    },
                    sensitivityModifier: 1.4,
                    sinewave: {
                        amplitude: .50,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .55,
                        decayCoeff: 400
                    },
                    note: "Risk of over-regulation and yellowing on Poa"
                },
                perennial_ryegrass: {
                    gddBase: 0,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 280,
                        source: "Less absorption than Poa - similar to bentgrass"
                    },
                    tees: {
                        gdd: 300,
                        source: "Extrapolated"
                    },
                    fairways: {
                        gdd: 350,
                        source: "Label guidance"
                    },
                    sinewave: {
                        amplitude: .38,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .6,
                        decayCoeff: 400
                    }
                },
                c4_default: {
                    gddBase: 10,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 123,
                        source: "Bermuda reapplication interval baseline"
                    },
                    tees: {
                        gdd: 160,
                        source: "Extrapolated from greens"
                    },
                    fairways: {
                        gdd: 195,
                        source: "Extrapolated"
                    },
                    athletic: {
                        gdd: 225,
                        source: "Extrapolated"
                    },
                    sinewave: {
                        amplitude: .45,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .7,
                        decayCoeff: 400
                    }
                },
                c3_default: {
                    gddBase: 0,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 280,
                        source: "Conservative - between bentgrass (300) and Poa (200)"
                    },
                    tees: {
                        gdd: 300,
                        source: "Label: 280-350 GDD"
                    },
                    fairways: {
                        gdd: 350,
                        source: "Nufarm label"
                    },
                    sinewave: {
                        amplitude: .40,
                        periodMultiplier: 2,
                        hasRebound: !1,
                        mspRatio: .6,
                        decayCoeff: 400
                    }
                }
            },
            ETH: {
                c3_default: {
                    gddBase: 0,
                    confidence: "HIGH",
                    greens: {
                        gdd: 200,
                        source: "Calhoun 2010, Golfdom 2019: 150-200 GDD32 from Jan 1 (Northern) or 50 GDD50 from Feb 1 (Mid-Atlantic)"
                    },
                    tees: {
                        gdd: 250,
                        source: "Fairway timing - slightly later"
                    },
                    fairways: {
                        gdd: 300,
                        source: "Higher HOC tolerance"
                    },
                    modelType: "seedhead_timing",
                    sinewave: null,
                    timing: {
                        autumnApp: {
                            recommended: true,
                            timing: "After last mowing, before dormancy",
                            rate: "5 oz/1000 sqft",
                            note: "Improves spring control ~25%"
                        },
                        springApp1: {
                            gdd32: 200,
                            gdd50: 50,
                            biofix32: "Jan 1",
                            biofix50: "Feb 1",
                            indicators: ["Forsythia bloom", "Poa boot stage", "South-facing slope seedheads"]
                        },
                        springApp2: {
                            interval: "3-4 weeks after first",
                            gddSinceFirst: 200,
                            tankMix: "Add TE for growth regulation and safety"
                        },
                        maxApps: 6,
                        maxRatePerYear: "30 oz/1000 sqft"
                    }
                },
                annual_bluegrass: {
                    gddBase: 0,
                    confidence: "HIGH",
                    greens: {
                        gdd: 200,
                        source: "Calhoun GDD32 model validated"
                    },
                    modelType: "seedhead_timing",
                    sinewave: null
                },
                perennial_poa: {
                    gddBase: 6,
                    confidence: "MEDIUM",
                    greens: {
                        gdd: 160,
                        source: "European model - perennial biotype flowers later"
                    },
                    modelType: "seedhead_timing",
                    sinewave: null
                },
                c4_default: {
                    gddBase: 0,
                    confidence: "LOW",
                    greens: {
                        gdd: 200,
                        source: "Limited use on warm-season - mainly for Poa contamination"
                    },
                    modelType: "seedhead_timing",
                    sinewave: null
                }
            }
        },
        shadeThresholds: {
            suspend: 10,
            reduce: 15,
            caution: 20
        }
    };

    function t(e) {
        return "number" == typeof e && !isNaN(e)
    }

    function r(e, a, t) {
        return Math.max(a, Math.min(t, e))
    }
    const s = {
        "creeping bentgrass": "c3",
        creeping_bentgrass: "c3",
        "agrostis stolonifera": "c3",
        "browntop bentgrass": "c3",
        browntop_bentgrass: "c3",
        "browntop bent": "c3",
        "colonial bentgrass": "c3",
        "agrostis capillaris": "c3",
        "annual bluegrass": "c3",
        annual_bluegrass: "c3",
        "poa annua": "c3",
        poa: "c3",
        "perennial ryegrass": "c3",
        perennial_ryegrass: "c3",
        "lolium perenne": "c3",
        prg: "c3",
        "kentucky bluegrass": "c3",
        kentucky_bluegrass: "c3",
        "poa pratensis": "c3",
        kbg: "c3",
        "fine fescue": "c3",
        fine_fescue: "c3",
        "creeping red fescue": "c3",
        "tall fescue": "c3",
        tall_fescue: "c3",
        "festuca arundinacea": "c3",
        bermudagrass: "c4",
        bermuda: "c4",
        cynodon: "c4",
        "ultradwarf bermuda": "c4",
        ultradwarf_bermuda: "c4",
        ultradwarf: "c4",
        tifeagle: "c4",
        miniverde: "c4",
        champion: "c4",
        couch: "c4",
        couchgrass: "c4",
        "couch grass": "c4",
        "santa ana": "c4",
        santa_ana: "c4",
        tifway: "c4",
        tiftuf: "c4",
        zoysiagrass: "c4",
        zoysia: "c4",
        "zoysia japonica": "c4",
        "zoysia matrella": "c4",
        "seashore paspalum": "c4",
        seashore_paspalum: "c4",
        paspalum: "c4",
        buffalo: "c4",
        "st augustine": "c4",
        st_augustine: "c4",
        stenotaphrum: "c4",
        bahiagrass: "c4",
        bahia: "c4",
        "paspalum notatum": "c4",
        kikuyu: "kikuyu",
        kikuyugrass: "kikuyu",
        "pennisetum clandestinum": "kikuyu"
    };

    function o(e) {
        if (!e) return null;
        // v3.5.1: Strip parenthetical suffixes e.g. "(Greens)", "(Tees)", "(Fairways)" 
        // added by TurfProfileController before normalising
        return e.toLowerCase()
            .replace(/\s*\([^)]*\)\s*/g, "")  // strip (Greens), (Sports), etc.
            .replace(/['']/g, "")
            .replace(/\s+/g, "_")
            .replace(/-/g, "_")
            .trim()
    }

    function i(e) {
        if (!e) return "c3";
        const a = o(e);
        return s[a] || s[e.toLowerCase()] || "c3"
    }

    function d(e) {
        const t = i(e);
        return (a.gddBaseTemperatures[t] || a.gddBaseTemperatures.c3).value
    }

    // v3.5.0: Pure version — accepts soilTempData parameter.
    // Orchestrator assembles this from GAIP_Sensor / climateMetrics before calling.
    function n(soilTempData) {
        if (soilTempData && null !== soilTempData.soilTemp && void 0 !== soilTempData.soilTemp) {
            return {
                soilTemp: soilTempData.soilTemp,
                source: soilTempData.source || "provided",
                depth: soilTempData.depth || null
            }
        }
        return {
            soilTemp: null,
            source: null,
            depth: null
        }
    }

    // Legacy global-reading version for backward compatibility (UI direct calls)
    function n_legacy() {
        if (e.GAIP_Sensor && typeof e.GAIP_Sensor.hasData === 'function' && e.GAIP_Sensor.hasData()) {
            const sensorData = e.GAIP_Sensor.getIrrigationData();
            if (sensorData && null !== sensorData.soilTemp) return {
                soilTemp: sensorData.soilTemp,
                source: "sensor:" + (sensorData.source || "TDR"),
                depth: sensorData.measurementDepth || null
            }
        }
        return null !== e.climateMetrics?.temperature?.soil?.mean && void 0 !== e.climateMetrics?.temperature?.soil?.mean ? {
            soilTemp: e.climateMetrics.temperature.soil.mean,
            source: "climate:" + (e.climateMetrics.temperature.soil.source || "api"),
            depth: null
        } : {
            soilTemp: null,
            source: null,
            depth: null
        }
    }

    function c(e, r) {
        if (!t(e)) return {
            crownTemp: null,
            method: "none",
            airContribution: null,
            soilContribution: null
        };
        const s = a.crownTemperature;
        if (!s.enabled || !t(r)) return {
            crownTemp: e,
            method: "air_only",
            airContribution: e,
            soilContribution: null
        };
        const o = s.airWeight * e,
            i = s.soilWeight * r,
            d = o + i;
        return {
            crownTemp: Math.round(10 * d) / 10,
            method: "blended",
            airContribution: Math.round(10 * o) / 10,
            soilContribution: Math.round(10 * i) / 10,
            airTemp: e,
            soilTemp: r,
            weights: {
                air: s.airWeight,
                soil: s.soilWeight
            }
        }
    }

    function l(e, r, s, o) {
        if (!t(e) || !t(r)) return {
            gdd: 0,
            method: "none"
        };
        const i = (e + r) / 2,
            d = c(i, o),
            n = d.crownTemp,
            l = Math.max(0, n - s);
        return {
            gdd: Math.min(l, a.defaults.maxDailyGDD),
            method: d.method,
            airTemp: i,
            crownTemp: n,
            soilTemp: o
        }
    }

    function u(e, a, t, r, s, soilTempData) {
        let o = 0,
            i = 0;
        const d = [],
            c = n(soilTempData),
            u = c.soilTemp,
            g = c.source;
        let p = !1;
        const m = a.toISOString().split("T")[0],
            h = t ? t.toISOString().split("T")[0] : "none";
        let f = [],
            y = [],
            w = [];
        for (let n = 0; n < e.length; n++) {
            const c = e[n],
                g = c.date.split("-"),
                m = new Date(Date.UTC(parseInt(g[0]), parseInt(g[1]) - 1, parseInt(g[2])));
            if (m < a) {
                f.push(c.date);
                continue
            }
            if (t && m > t) {
                y.push(c.date);
                continue
            }
            w.push(c.date);
            const h = void 0 !== c.soilTemp ? c.soilTemp : u,
                D = l(c.tmax, c.tmin, r, h);
            o += D.gdd, i++, "blended" === D.method && (p = !0), d.push({
                date: c.date,
                gdd: D.gdd,
                tmax: c.tmax,
                tmin: c.tmin,
                crownTemp: D.crownTemp,
                soilTemp: h,
                method: D.method,
                source: c.source || s
            })
        }
        return console.log("[GDD Filter] appDate:", m, "| maxDate:", h), f.length > 0 && console.log("[GDD Filter] Skipped (before appDate):", f.join(", ")), y.length > 0 && console.log("[GDD Filter] Skipped (after today):", y.join(", ")), console.log("[GDD Filter] Included:", w.join(", ")), {
            totalGDD: Math.round(o),
            days: i,
            estimated: !1,
            source: s,
            baseTemp: r,
            dailyGDD: d,
            crownTempModel: {
                used: p,
                soilTempSource: g,
                soilTemp: u
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // v3.5.0: PURE accumulateGDD — receives pre-assembled dailyData array.
    // The orchestrator is responsible for merging historical + forecast
    // and passing it in via state.weatherData.dailyData.
    // No global reads, no fetch(), no DOM events.
    // ═══════════════════════════════════════════════════════════════════
    function g_pure(startDate, species, baseOverride, weatherData, soilTempData) {
        const r = void 0 !== baseOverride ? baseOverride : d(species),
            s = startDate.split("-"),
            o = new Date(Date.UTC(parseInt(s[0]), parseInt(s[1]) - 1, parseInt(s[2]))),
            i = new Date,
            c = new Date(Date.UTC(i.getFullYear(), i.getMonth(), i.getDate()));

        // If pre-assembled dailyData provided (orchestrator path), use it directly
        if (weatherData && weatherData.dailyData && weatherData.dailyData.length > 0) {
            console.log("[PGR:pure] Using provided dailyData:", weatherData.dailyData.length, "days");
            return u(weatherData.dailyData, o, c, r, weatherData.source || "orchestrator", soilTempData);
        }

        // If raw weather data provided (historical + forecast already merged by orchestrator)
        if (weatherData && weatherData.historical && weatherData.historical.daily) {
            try {
                const hist = weatherData.historical.daily,
                    merged = [];
                for (let j = 0; j < hist.time.length; j++) merged.push({
                    date: hist.time[j],
                    tmax: hist.temperature_2m_max[j],
                    tmin: hist.temperature_2m_min[j],
                    source: "historical"
                });
                // Merge forecast if available
                if (weatherData.forecast && weatherData.forecast.hourly) {
                    const fh = weatherData.forecast.hourly,
                        hrsPerDay = 24,
                        numDays = Math.ceil(fh.time.length / hrsPerDay);
                    for (let j = 0; j < numDays; j++) {
                        const start = j * hrsPerDay,
                            end = Math.min(start + hrsPerDay, fh.time.length),
                            temps = fh.temperature_2m.slice(start, end),
                            dateStr = fh.time[start].split("T")[0];
                        !merged.find(m => m.date === dateStr) && temps.length > 0 && merged.push({
                            date: dateStr,
                            tmax: Math.max.apply(null, temps),
                            tmin: Math.min.apply(null, temps),
                            source: "forecast"
                        })
                    }
                }
                merged.sort((a, b) => new Date(a.date) - new Date(b.date));
                console.log("[PGR:pure] Merged historical+forecast:", merged.length, "days");
                const result = u(merged, o, c, r, "climate_engine_historical", soilTempData);
                if (result.days > 0) return result;
            } catch (err) {
                console.warn("[PGR:pure] Error processing raw weather data:", err);
            }
        }

        // If hourly-only forecast data provided
        if (weatherData && (weatherData.hourly || (weatherData.forecast && weatherData.forecast.hourly))) {
            const hourly = weatherData.hourly || weatherData.forecast.hourly;
            if (hourly) try {
                const hrsPerDay = 24,
                    numDays = Math.ceil(hourly.time.length / hrsPerDay);
                let totalGDD = 0,
                    dayCount = 0;
                const dailyGDD = [];
                for (let j = 0; j < numDays; j++) {
                    const start = j * hrsPerDay,
                        end = Math.min(start + hrsPerDay, hourly.time.length),
                        temps = hourly.temperature_2m.slice(start, end),
                        dateStr = hourly.time[start].split("T")[0],
                        dayDate = new Date(dateStr);
                    dayDate.setHours(0, 0, 0, 0);
                    if (dayDate >= o && temps.length > 0) {
                        const tmax = Math.max.apply(null, temps),
                            tmin = Math.min.apply(null, temps),
                            st = n(soilTempData),
                            dayGDD = l(tmax, tmin, r, st.soilTemp);
                        totalGDD += dayGDD.gdd; dayCount++;
                        dailyGDD.push({
                            date: dateStr, gdd: dayGDD.gdd, tmax: tmax, tmin: tmin,
                            crownTemp: dayGDD.crownTemp, soilTemp: st.soilTemp,
                            method: dayGDD.method, source: "forecast"
                        });
                    }
                }
                if (dayCount > 0) return {
                    totalGDD: Math.round(totalGDD), days: dayCount,
                    estimated: false, source: "weather_api",
                    baseTemp: r, dailyGDD: dailyGDD
                };
            } catch (err) {
                console.warn("[PGR:pure] Error processing hourly data:", err);
            }
        }

        // If daily-only data provided
        if (weatherData && weatherData.daily) try {
            const daily = weatherData.daily,
                appDate = new Date(startDate);
            appDate.setHours(0, 0, 0, 0);
            let totalGDD = 0, dayCount = 0;
            const dailyGDD = [];
            for (let j = 0; j < daily.time.length; j++) {
                const dateStr = daily.time[j],
                    dayDate = new Date(dateStr);
                dayDate.setHours(0, 0, 0, 0);
                if (dayDate >= appDate) {
                    const tmax = daily.temperature_2m_max[j],
                        tmin = daily.temperature_2m_min[j];
                    if (void 0 !== tmax && void 0 !== tmin) {
                        const st = n(soilTempData),
                            dayGDD = l(tmax, tmin, r, st.soilTemp);
                        totalGDD += dayGDD.gdd; dayCount++;
                        dailyGDD.push({
                            date: dateStr, gdd: dayGDD.gdd, tmax: tmax, tmin: tmin,
                            crownTemp: dayGDD.crownTemp, soilTemp: st.soilTemp,
                            method: dayGDD.method
                        });
                    }
                }
            }
            if (dayCount > 0) return {
                totalGDD: Math.round(totalGDD), days: dayCount,
                estimated: false, source: "weather_api",
                baseTemp: r, dailyGDD: dailyGDD
            };
        } catch (err) {
            console.warn("[PGR:pure] Error processing daily data:", err);
        }

        // Final fallback: estimate from average temp if provided
        const daysSinceApp = Math.max(0, Math.floor((c - o) / 864e5));
        if (daysSinceApp > 0 && weatherData && weatherData.avgTemp) {
            const avgDailyGDD = Math.max(0, weatherData.avgTemp - r);
            return {
                totalGDD: Math.round(avgDailyGDD * daysSinceApp),
                days: daysSinceApp, estimated: true, source: "estimated",
                baseTemp: r, avgTemp: weatherData.avgTemp,
                dailyGDDRate: Math.round(10 * avgDailyGDD) / 10
            };
        }

        console.warn("[PGR:pure] No weather data available for GDD calculation");
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Legacy accumulateGDD — reads globals for backward compatibility.
    // Used when PGR module is called directly from UI without orchestrator.
    // ═══════════════════════════════════════════════════════════════════
    function g(a, t, baseOverride) {
        // If orchestrator has pre-assembled weather data in state, use pure path
        // (This bridges calls from w_legacy that still use g() directly)
        
        const r = void 0 !== baseOverride ? baseOverride : d(t),
            s = a.split("-"),
            o = new Date(Date.UTC(parseInt(s[0]), parseInt(s[1]) - 1, parseInt(s[2]))),
            i = new Date,
            c = new Date(Date.UTC(i.getFullYear(), i.getMonth(), i.getDate()));
        console.log("=== PGR GDD DEBUG (legacy) ==="), console.log("Input startDate:", a), console.log("Parsed appDate (UTC):", o.toISOString()), console.log("Today (UTC):", c.toISOString()), console.log("Base temp:", r + "°C");
        const needsHistorical = o < c;
        if (console.log("Needs historical:", needsHistorical), e.GAIP_PGR_WEATHER_CACHE && e.GAIP_PGR_WEATHER_CACHE.dailyData) {
            const t = e.GAIP_PGR_WEATHER_CACHE;
            if (t.applicationDate === a) return console.log("Using CACHED data for", a), u(t.dailyData, o, c, r, "cached_historical", n_legacy())
        }
        if (needsHistorical && e.rawWeatherData && e.rawWeatherData.historical && e.rawWeatherData.historical.daily) try {
            const legacySoil = n_legacy();
            const result = g_pure(a, t, baseOverride, e.rawWeatherData, legacySoil);
            if (result && result.days > 0) return result;
        } catch (err) {
            console.warn("PGR: Error using climate engine historical data:", err)
        }
        if (e.rawWeatherData) {
            const legacySoil = n_legacy();
            const result = g_pure(a, t, baseOverride, e.rawWeatherData, legacySoil);
            if (result && result.days > 0) return result;
        }
        // Fallback: estimate from elapsed days
        const p = Math.max(0, Math.floor((c - o) / 864e5));
        if (p > 0) {
            let avgTemp = 20;
            if (e.rawWeatherData && e.rawWeatherData.hourly) {
                const temps = e.rawWeatherData.hourly.temperature_2m;
                temps && temps.length > 0 && (avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length)
            }
            const dailyGDD = Math.max(0, avgTemp - r),
                total = dailyGDD * p;
            return {
                totalGDD: Math.round(total), days: p, estimated: true,
                source: "estimated", baseTemp: r, avgTemp: avgTemp,
                dailyGDDRate: Math.round(10 * dailyGDD) / 10
            }
        }
        // Trigger async historical fetch for next run (fire-and-forget)
        if (needsHistorical) {
            _triggerHistoricalFetch(a);
        }
        return null
    }

    // Async historical fetch — extracted from old g() for legacy path only
    function _triggerHistoricalFetch(appDate) {
        const lat = e.GAIP_STATE?.climate?.lat || e.GAIP_STATE?.turf?.lat || e.rawWeatherData?.latitude,
            lon = e.GAIP_STATE?.climate?.lon || e.GAIP_STATE?.turf?.lon || e.rawWeatherData?.longitude;
        if (!lat || !lon) return void console.warn("PGR: Cannot fetch historical weather - no coordinates");
        const startD = new Date(appDate),
            endD = new Date,
            startStr = startD.toISOString().split("T")[0],
            endStr = endD.toISOString().split("T")[0],
            url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
        console.log("PGR: Fetching historical weather from", startStr, "to", endStr);
        fetch(url).then(r => r.json()).then(data => {
            if (data.daily && data.daily.time) {
                const dailyArr = [];
                for (let j = 0; j < data.daily.time.length; j++) dailyArr.push({
                    date: data.daily.time[j],
                    tmax: data.daily.temperature_2m_max[j],
                    tmin: data.daily.temperature_2m_min[j],
                    source: "historical"
                });
                if (e.rawWeatherData && e.rawWeatherData.hourly) {
                    const fh = e.rawWeatherData.hourly,
                        hpd = 24, nd = Math.ceil(fh.time.length / hpd);
                    for (let j = 0; j < nd; j++) {
                        const s = j * hpd, end = Math.min(s + hpd, fh.time.length),
                            temps = fh.temperature_2m.slice(s, end),
                            dateStr = fh.time[s].split("T")[0];
                        !dailyArr.find(x => x.date === dateStr) && temps.length > 0 && dailyArr.push({
                            date: dateStr, tmax: Math.max.apply(null, temps),
                            tmin: Math.min.apply(null, temps), source: "forecast"
                        })
                    }
                }
                dailyArr.sort((a, b) => new Date(a.date) - new Date(b.date));
                e.GAIP_PGR_WEATHER_CACHE = {
                    applicationDate: appDate, dailyData: dailyArr,
                    fetchedAt: (new Date).toISOString()
                };
                console.log("PGR: Historical weather cached -", dailyArr.length, "days");
                "undefined" != typeof document && document.dispatchEvent(new CustomEvent("gaip:pgr-weather-updated"))
            }
        }).catch(err => {
            console.warn("PGR: Failed to fetch historical weather:", err)
        });
    }

    function p(e, t, r = "greens") {
        const s = o(e),
            d = i(e),
            n = a.speciesThresholds[t];
        if (!n) return {
            gdd: 200,
            gddBase: 0,
            confidence: "LOW",
            source: "Default autumnback",
            speciesKey: "unknown"
        };
        let c = n[s],
            l = s;
        if (!c) {
            const e = "kikuyu" === d ? "c4_default" : `${d}_default`;
            c = n[e], l = e
        }
        if (!c) return {
            gdd: 200,
            gddBase: 0,
            confidence: "LOW",
            source: "No threshold data",
            speciesKey: l
        };
        const u = c[r] || c.greens || c.fairways || c.athletic;
        return u ? {
            gdd: u.gdd,
            gddBase: c.gddBase,
            confidence: c.confidence || "LOW",
            source: u.source,
            speciesKey: l,
            sinewave: c.sinewave || null,
            sensitivityModifier: c.sensitivityModifier || 1
        } : {
            gdd: 200,
            gddBase: c.gddBase || 0,
            confidence: "LOW",
            source: "No surface data",
            speciesKey: l
        }
    }

    // v3.6.0: Amplitude-dampened sinewave decay (Kreuser 2017).
    // decayCoeff controls how quickly the amplitude decays with GDD.
    // Larger decayCoeff = slower decay. When absent, falls back to
    // the previous fixed-amplitude behaviour for backward compat.
    // Ref: Kreuser 2017, Ag & Env Letters 2(1), doi:10.2134/ael2017.01.0001
    function m(e, a, t) {
        if (!t) {
            const t = r(e / a, 0, 1.5);
            return {
                relativeYield: t < 1 ? .7 : 1,
                suppression: t < 1 ? .3 : 0,
                suppressionPct: t < 1 ? 30 : 0,
                phase: t < 1 ? "active" : "expired",
                phaseDescription: t < 1 ? "Active regulation" : "Effect expired",
                isThresholdOnly: !0
            }
        }
        const {
            amplitude: s = .4,
            periodMultiplier: o = 2,
            hasRebound: i = !0,
            mspRatio: d = .5,
            decayCoeff: D = null
        } = t, n = a * o;
        // Amplitude-dampening: if decayCoeff is set, amplitude decays
        // exponentially with GDD (Kreuser 2017 Eq. with decay coefficient).
        // effectiveAmplitude = amplitude * exp(-gdd / D)
        // When D is null, effectiveAmplitude = amplitude (legacy behaviour).
        const sEff = D && D > 0 ? s * Math.exp(-e / D) : s;
        let c;
        if (i) c = 1 - sEff * Math.sin(Math.PI * e / n * 2);
        else if (e <= a) c = 1 - sEff * Math.sin(Math.PI * e / a);
        else {
            const t = (e - a) / a;
            c = 1 - sEff * Math.max(0, 1 - t)
        }
        const l = 1 - c;
        let u = "active",
            g = "";
        const p = a * d;
        return e < .5 * p ? (u = "onset", g = "Building suppression") : e < 1.2 * p ? (u = "peak", g = "Peak suppression") : e < a ? (u = "declining", g = "Declining - approaching reapply window") : i && e < 1.5 * a ? (u = "rebound", g = "Rebound phase - growth exceeds untreated") : (u = "expired", g = "Effect expired"), {
            relativeYield: Math.round(1e3 * c) / 1e3,
            suppression: Math.round(1e3 * l) / 1e3,
            suppressionPct: Math.round(100 * Math.max(0, l)),
            phase: u,
            phaseDescription: g,
            isInRebound: i && c > 1,
            reboundFactor: c > 1 ? c : null,
            isThresholdOnly: !1,
            isDampened: D != null && D > 0,
            raw: {
                gdd: e,
                threshold: a,
                period: n,
                amplitude: s,
                effectiveAmplitude: Math.round(1e4 * sEff) / 1e4,
                decayCoeff: D,
                mspGDD: p
            }
        }
    }

    function h(e) {
        if (!e || e <= 0) return {
            category: "greens",
            label: a.mowingHeightCategories.greens.label,
            multiplier: 1
        };
        for (const [t, r] of Object.entries(a.mowingHeightCategories))
            if (e <= r.maxHeight) return {
                category: t,
                label: r.label,
                multiplier: r.thresholdMultiplier,
                description: r.description
            };
        return {
            category: "rough",
            label: a.mowingHeightCategories.rough.label,
            multiplier: 2
        }
    }

    function f(e) {
        return h(e).category
    }

    function y(e) {
        if (null == e) {
            return {
                status: "unknown",
                message: null,
                action: null
            };
        }
        if (e < a.shadeThresholds.suspend) {
            const msg = `DLI ${e.toFixed(1)} mol/m²/day is critically low - SUSPEND PGR applications`;
            return {
                status: "suspend",
                message: msg,
                action: msg,
                severity: "critical"
            };
        }
        if (e < a.shadeThresholds.reduce) {
            const msg = `DLI ${e.toFixed(1)} mol/m²/day is low - reduce PGR rate by 25-50%`;
            return {
                status: "reduce",
                message: msg,
                action: msg,
                severity: "warning"
            };
        }
        if (e < a.shadeThresholds.caution) {
            const msg = `DLI ${e.toFixed(1)} mol/m²/day is marginal - monitor closely`;
            return {
                status: "caution",
                message: msg,
                action: msg,
                severity: "caution"
            };
        }
        return {
            status: "ok",
            message: null,
            action: null
        };
    }
    const _PT = {
        TE120: "TE",
        TE175: "TE",
        TE250: "TE",
        PRIMO250: "TE",
        PRIMO_MAXX: "TE",
        REGULATE: "PBZ",
        TRIMMIT: "PBZ",
        PBZ200: "PBZ",
        ANUEW: "PHC",
        INCOGNITO: "ETH",
        PROXY: "ETH"
    };

    function _getPT(x) {
        return _PT[x] || x.replace(/\d+$/, "") || "TE"
    }

    // Derive surface type from turf profile, with HOC fallback
    function S(state, hoc) {
        const turfType = state?.turf?.turfType;
        const subCategory = state?.turf?.subCategory;
        
        // Map turf profile to PGR surface categories
        if (turfType === 'golf') {
            if (subCategory === 'greens') return 'greens';
            if (subCategory === 'tees') return 'tees';
            if (subCategory === 'fairways') return 'fairways';
            if (subCategory === 'surrounds') return 'tees';
            return 'fairways'; // default for golf
        }
        if (turfType === 'sports') return 'athletic';
        if (turfType === 'lawn') return 'rough';
        if (turfType === 'bowling') return 'greens';
        if (turfType === 'cricket') {
            if (subCategory === 'wicket') return 'fairways';
            return 'athletic'; // outfield
        }
        
        // Fallback to HOC-based detection
        return f(hoc);
    }
    
    // Get appropriate default HOC for turf type
    function H(state) {
        const turfType = state?.turf?.turfType;
        const subCategory = state?.turf?.subCategory;
        
        if (turfType === 'golf') {
            if (subCategory === 'greens') return 4;
            if (subCategory === 'tees') return 12;
            if (subCategory === 'fairways') return 18;
            return 15;
        }
        if (turfType === 'sports') return 25;
        if (turfType === 'lawn') return 50;
        if (turfType === 'bowling') return 4;
        if (turfType === 'cricket') {
            if (subCategory === 'wicket') return 12;
            return 30;
        }
        return 4; // legacy default
    }

    // ═══════════════════════════════════════════════════════════════════
    // v3.5.0: PURE calculate — called by orchestrator with fully assembled state.
    // state.weatherData = pre-merged daily data from orchestrator
    // state.soilTempData = {soilTemp, source, depth} from orchestrator
    // No global reads. Fully testable.
    // ═══════════════════════════════════════════════════════════════════
    function w_pure(state, options = {}) {
        if (!state) return {
            success: false,
            error: "No state provided"
        };
        const species = state.turf?.grassSpecies || state.grassSpecies || "creeping bentgrass",
            speciesClass = i(species);
        let baseTemp = d(species),
            productCode = options.productType || state.pgr?.productType || "TE250",
            productType = _getPT(productCode),
            hoc = state.turf?.hoc || state.turf?.mowingHeightMM || state.mowingHeightMM || options.mowingHeightMM || H(state),
            surface = S(state, hoc),
            threshold = p(species, productType, surface);

        void 0 !== threshold.gddBase && (baseTemp = threshold.gddBase);
        const gddThreshold = options.gddThreshold || threshold.gdd,
            appDate = options.applicationDate || state.pgr?.applicationDate || (new Date).toISOString().split("T")[0],
            // PURE PATH: use g_pure with provided weather data
            gddResult = g_pure(appDate, species, baseTemp, state.weatherData || null, state.soilTempData || null),
            gddAccumulated = gddResult ? gddResult.totalGDD : 0,
            decay = m(gddAccumulated, gddThreshold, threshold.sinewave),
            dli = state.shade?.ambientDLI || state.shade?.dli || state.turf?.ambientDLI || null,
            shadeWarning = y(dli),
            progress = r(gddAccumulated / gddThreshold, 0, 1.5),
            remaining = Math.max(0, gddThreshold - gddAccumulated);

        return {
            success: true,
            gdd: {
                accumulated: Math.round(gddAccumulated),
                threshold: gddThreshold,
                remaining: Math.round(remaining),
                progress: Math.round(100 * progress) / 100,
                progressPct: Math.round(100 * progress),
                base: baseTemp,
                baseTemp: baseTemp,
                source: gddResult?.source || "estimated",
                estimated: false !== gddResult?.estimated,
                days: gddResult?.days || null,
                isOverdue: gddAccumulated >= gddThreshold,
                overdue: gddAccumulated >= gddThreshold ? Math.round(gddAccumulated - gddThreshold) : 0
            },
            effect: {
                suppression: decay.suppression,
                suppressionPct: decay.suppressionPct,
                phase: decay.phase,
                phaseDescription: decay.phaseDescription,
                isInRebound: decay.isInRebound,
                reboundFactor: decay.reboundFactor,
                relativeYield: decay.relativeYield,
                reapplicationStatus: progress >= 0.75 ? 'due' : progress >= 0.60 ? 'approaching' : 'active' // b35fix178c: window opens at 75% GDD (Kreuser & Soldat 2011), not at expiry
            },
            confidence: {
                level: threshold.confidence,
                showSinewave: "LOW" !== threshold.confidence && null !== threshold.sinewave,
                source: threshold.source,
                isThresholdOnly: decay.isThresholdOnly
            },
            species: {
                input: species,
                class: speciesClass,
                key: threshold.speciesKey,
                gddBase: baseTemp,
                sensitivityModifier: threshold.sensitivityModifier
            },
            surface: {
                type: surface,
                mowingHeightMM: hoc
            },
            product: (function() {
                const productInfo = {
                    TE120: { name: "Indigo Amigo (TE 120g/L)", activeIngredient: "trinexapac-ethyl" },
                    TE175: { name: "Indigo Amigo (TE 175g/L)", activeIngredient: "trinexapac-ethyl" },
                    TE250: { name: "Primo 250 EC", activeIngredient: "trinexapac-ethyl" },
                    PRIMO250: { name: "Primo 250 EC", activeIngredient: "trinexapac-ethyl" },
                    PRIMO_MAXX: { name: "Primo MAXX", activeIngredient: "trinexapac-ethyl" },
                    REGULATE: { name: "Indigo Regulate", activeIngredient: "paclobutrazol" },
                    TRIMMIT: { name: "Trimmit 2SC", activeIngredient: "paclobutrazol" },
                    PBZ200: { name: "Paclobutrazol 200g/L", activeIngredient: "paclobutrazol" },
                    PBZ250: { name: "Paclobutrazol 250g/L", activeIngredient: "paclobutrazol" },
                    ANUEW: { name: "Anuew", activeIngredient: "prohexadione-calcium" },
                    INCOGNITO: { name: "Indigo Incognito", activeIngredient: "ethephon" },
                    PROXY: { name: "Proxy", activeIngredient: "ethephon" },
                    ETH: { name: "Ethephon", activeIngredient: "ethephon" }
                };
                const info = productInfo[productCode] || { name: productCode, activeIngredient: productType };
                return {
                    type: productType,
                    code: productCode,
                    name: info.name,
                    activeIngredient: info.activeIngredient
                };
            })(),
            thresholdConfig: {
                gddThreshold: gddThreshold,
                surfaceKey: surface,
                source: threshold.source || "Unknown",
                validated: threshold.confidence === "HIGH" && !(threshold.source || "").toLowerCase().includes("extrapolat"),
                confidence: threshold.confidence
            },
            shade: {
                dli: dli,
                warning: shadeWarning
            },
            recommendation: D(progress, shadeWarning, decay.phase)
        }
    }

    // Legacy calculate — reads globals when no orchestrator data present.
    function w(e, a = {}) {
        if (!e) return {
            success: !1,
            error: "No state provided"
        };
        const t = e.turf?.grassSpecies || e.grassSpecies || "creeping bentgrass",
            s = i(t);
        let o = d(t),
            productCode = a.productType || e.pgr?.productType || "TE250",
            n = _getPT(productCode),
            // Use explicit HOC if provided, otherwise derive from turf profile
            c = e.turf?.hoc || e.turf?.mowingHeightMM || e.mowingHeightMM || a.mowingHeightMM || H(e),
            // Derive surface from turf profile first, then HOC fallback
            l = S(e, c),
            u = p(t, n, l);
        
        // Debug logging for threshold selection
        void 0 !== u.gddBase && (o = u.gddBase);
        const h = a.gddThreshold || u.gdd,
            w = g(a.applicationDate || e.pgr?.applicationDate || (new Date).toISOString().split("T")[0], t, o),
            b = w ? w.totalGDD : 0,
            E = m(b, h, u.sinewave),
            T = e.shade?.ambientDLI || e.turf?.ambientDLI || null,
            M = y(T),
            x = r(b / h, 0, 1.5),
            v = Math.max(0, h - b);
        return {
            success: !0,
            gdd: {
                accumulated: Math.round(b),
                threshold: h,
                remaining: Math.round(v),
                progress: Math.round(100 * x) / 100,
                progressPct: Math.round(100 * x),
                base: o,
                baseTemp: o,
                source: w?.source || "estimated",
                estimated: !1 !== w?.estimated,
                days: w?.days || null,
                isOverdue: b >= h,
                overdue: b >= h ? Math.round(b - h) : 0
            },
            effect: {
                suppression: E.suppression,
                suppressionPct: E.suppressionPct,
                phase: E.phase,
                phaseDescription: E.phaseDescription,
                isInRebound: E.isInRebound,
                reboundFactor: E.reboundFactor,
                relativeYield: E.relativeYield,
                reapplicationStatus: x >= 0.75 ? 'due' : x >= 0.60 ? 'approaching' : 'active' // b35fix178c: legacy path — same 75% window
            },
            confidence: {
                level: u.confidence,
                showSinewave: "LOW" !== u.confidence && null !== u.sinewave,
                source: u.source,
                isThresholdOnly: E.isThresholdOnly
            },
            species: {
                input: t,
                class: s,
                key: u.speciesKey,
                gddBase: o,
                sensitivityModifier: u.sensitivityModifier
            },
            surface: {
                type: l,
                mowingHeightMM: c
            },
            product: (function() {
                const productInfo = {
                    TE120: { name: "Indigo Amigo (TE 120g/L)", activeIngredient: "trinexapac-ethyl" },
                    TE175: { name: "Indigo Amigo (TE 175g/L)", activeIngredient: "trinexapac-ethyl" },
                    TE250: { name: "Primo 250 EC", activeIngredient: "trinexapac-ethyl" },
                    PRIMO250: { name: "Primo 250 EC", activeIngredient: "trinexapac-ethyl" },
                    PRIMO_MAXX: { name: "Primo MAXX", activeIngredient: "trinexapac-ethyl" },
                    REGULATE: { name: "Indigo Regulate", activeIngredient: "paclobutrazol" },
                    TRIMMIT: { name: "Trimmit 2SC", activeIngredient: "paclobutrazol" },
                    PBZ200: { name: "Paclobutrazol 200g/L", activeIngredient: "paclobutrazol" },
                    PBZ250: { name: "Paclobutrazol 250g/L", activeIngredient: "paclobutrazol" },
                    ANUEW: { name: "Anuew", activeIngredient: "prohexadione-calcium" },
                    INCOGNITO: { name: "Indigo Incognito", activeIngredient: "ethephon" },
                    PROXY: { name: "Proxy", activeIngredient: "ethephon" },
                    ETH: { name: "Ethephon", activeIngredient: "ethephon" }
                };
                const info = productInfo[productCode] || { name: productCode, activeIngredient: n };
                return {
                    type: n,
                    code: productCode,
                    name: info.name,
                    activeIngredient: info.activeIngredient
                };
            })(),
            thresholdConfig: {
                gddThreshold: h,
                surfaceKey: l,
                source: u.source || "Unknown",
                validated: u.confidence === "HIGH" && !(u.source || "").toLowerCase().includes("extrapolat"),
                confidence: u.confidence
            },
            shade: {
                dli: T,
                warning: M
            },
            recommendation: D(x, M, E.phase)
        }
    }

    function D(e, a, t) {
        return "suspend" === a.status ? {
            action: "suspend",
            message: "Suspend PGR - shade stress",
            severity: "critical"
        } : e >= 1 ? {
            action: "reapply",
            message: "GDD threshold reached - reapply now",
            severity: "action"
        } : e >= .85 ? {
            action: "prepare",
            message: "Approaching reapplication window",
            severity: "watch"
        } : "rebound" === t ? {
            action: "reapply",
            message: "In rebound phase - reapply to maintain regulation",
            severity: "action"
        } : {
            action: "monitor",
            message: "PGR active - continue monitoring",
            severity: "good"
        }
    }

    function b(e, a, t = "greens", r = 50) {
        const s = p(e, a, t);
        if ("LOW" === s.confidence || !s.sinewave) return {
            available: !1,
            reason: "Insufficient research data for sinewave display",
            confidence: s.confidence
        };
        const o = s.gdd,
            i = 2 * o,
            d = i / r,
            n = [];
        for (let e = 0; e <= i; e += d) {
            const a = m(e, o, s.sinewave);
            n.push({
                gdd: Math.round(e),
                relativeYield: a.relativeYield,
                suppressionPct: a.suppressionPct,
                phase: a.phase
            })
        }
        return {
            available: !0,
            confidence: s.confidence,
            gddBase: s.gddBase,
            threshold: o,
            source: s.source,
            hasRebound: s.sinewave.hasRebound,
            mspGDD: Math.round(o * s.sinewave.mspRatio),
            dataPoints: n
        }
    }
    const E = {
        version: a.version,
        calculate: w,
        calculatePure: w_pure,          // v3.5.0: Pure function for orchestrator
        calculateDailyGDD: l,
        calculateDailyGDDSimple: function(e, a, t) {
            return l(e, a, t, null).gdd || 0
        },
        accumulateGDD: g,
        accumulateGDDPure: g_pure,       // v3.5.0: Pure GDD accumulation
        getGDDBaseTemp: d,
        calculateCrownTemperature: c,
        getSensorSoilTemp: n,
        getSensorSoilTempLegacy: n_legacy,
        crownTempConfig: a.crownTemperature,
        getSpeciesThreshold: p,
        sinewaveDecay: m,
        generateChartData: b,
        getSpeciesClass: i,
        normalizeSpeciesName: o,
        getMowingHeightCategory: h,
        getSurfaceType: f,
        deriveSurfaceFromProfile: S,     // v3.5.0: Expose for orchestrator
        getDefaultHOC: H,               // v3.5.0: Expose for orchestrator
        mowingHeightCategories: a.mowingHeightCategories,
        getShadeWarning: y,
        products: {
            TE120: {
                name: "Indigo Amigo (TE 120g/L)",
                activeIngredient: "trinexapac-ethyl",
                formulation: "120 g/L",
                aiPerL: .12,
                productType: "TE",
                registered: ["c3", "c4", "kikuyu", "bahia"],
                colour: "#2563eb"
            },
            TE175: {
                name: "Indigo Amigo (TE 175g/L)",
                activeIngredient: "trinexapac-ethyl",
                formulation: "175 g/L",
                aiPerL: .175,
                productType: "TE",
                registered: ["c3", "c4", "kikuyu", "bahia"],
                colour: "#2563eb"
            },
            PRIMO250: {
                name: "Primo 250 EC",
                activeIngredient: "trinexapac-ethyl",
                formulation: "250 g/L",
                aiPerL: .25,
                productType: "TE",
                registered: ["c3", "c4", "kikuyu", "bahia"],
                colour: "#2563eb"
            },
            PRIMO_MAXX: {
                name: "Primo MAXX",
                activeIngredient: "trinexapac-ethyl",
                formulation: "120 g/L",
                aiPerL: .12,
                productType: "TE",
                registered: ["c3", "c4", "kikuyu", "bahia"],
                colour: "#2563eb"
            },
            REGULATE: {
                name: "Indigo Regulate",
                activeIngredient: "paclobutrazol",
                formulation: "250 g/L",
                aiPerL: .25,
                productType: "PBZ",
                registered: ["c3", "c4"],
                colour: "#7c3aed"
            },
            TRIMMIT: {
                name: "Trimmit 2SC",
                activeIngredient: "paclobutrazol",
                formulation: "200 g/L",
                aiPerL: .2,
                productType: "PBZ",
                registered: ["c3", "c4"],
                colour: "#7c3aed"
            },
            ANUEW: {
                name: "Anuew",
                activeIngredient: "prohexadione-calcium",
                formulation: "270 g/kg",
                aiPerKg: .27,
                productType: "PHC",
                registered: ["c3", "c4"],
                colour: "#059669"
            },
            INCOGNITO: {
                name: "Indigo Incognito",
                activeIngredient: "ethephon",
                formulation: "480 g/L",
                aiPerL: .48,
                productType: "ETH",
                registered: ["c3"],
                restrictions: ["Golf greens only"],
                colour: "#dc2626"
            },
            PROXY: {
                name: "Proxy",
                activeIngredient: "ethephon",
                formulation: "217 g/L",
                aiPerL: .217,
                productType: "ETH",
                registered: ["c3"],
                colour: "#dc2626"
            }
        },
        config: a,
        speciesThresholds: a.speciesThresholds,
        gddBaseTemperatures: a.gddBaseTemperatures
    };
    e.GAIP_PGR = E, e.gaip_pgr_calculate = w, e.gaip_pgr_calculate_pure = w_pure, e.gaip_pgr_status = w, e.gaip_pgr_sinewave = m, e.gaip_pgr_chart_data = b, e.gaip_pgr_species_threshold = p, e.gaip_pgr_gdd_base = d, e.gaip_pgr_module = w, console.log("✅ GSSH PGR Module v3.6.0 loaded (forward-port: amplitude-dampened sinewave, PHC reapplication fix)")
}("undefined" != typeof window ? window : "undefined" != typeof global ? global : this);