/**
 * ============================================================================
 * NZ FINE FESCUE VARIETY TRAITS DATABASE v1.0.0
 * ============================================================================
 * 
 * REGION: New Zealand ONLY (not AU - fine fescues don't tolerate Australian summers)
 * 
 * USE CASES:
 * - Golf greens (Chewings, Slender creeping red) - mown at 4-6mm
 * - Golf fairways (Chewings, Slender creeping red, Strong creeping red) - mown at 12-20mm
 * - Low-maintenance/shade areas
 * 
 * SPECIES INCLUDED:
 * - Chewings fescue (Festuca rubra subsp. commutata) - bunch-type, greens-capable
 * - Slender creeping red fescue (F. rubra subsp. litoralis) - short rhizomes, salt tolerant
 * - Strong creeping red fescue (F. rubra subsp. rubra) - long rhizomes, fairway-only
 * 
 * SPECIES EXCLUDED (per spec):
 * - Hard fescue (F. brevipila) - not used for greens/fairways in NZ
 * - Sheep fescue (F. ovina) - not used for greens/fairways in NZ
 * 
 * DATA SOURCES:
 * - NTEP 2014 National Fineleaf Fescue Test (2015-2019 data) - ntep.org
 * - NTEP 2020 National Fineleaf Fescue Test (2021-2024 data) - ntep.org
 * - BSPB Turfgrass Seed 2025 Tables L3, L4, L5, G2, G3 (STRI trials, Bingley)
 * - NZ supplier technical sheets (PGG Wrightson, Living Turf)
 * 
 * DATA TIER SYSTEM:
 * - Tier 1 (HIGH confidence): Both NTEP + BSPB data available
 * - Tier 2 (MEDIUM confidence): Single source (NTEP or BSPB only)
 * - Tier 3 (LOW confidence): Supplier data only, no independent trials
 * 
 * TRAIT CONVERSION METHODOLOGY:
 * - BSPB 1-9 scores → multipliers: multiplier = 1.30 - (score × 0.05)
 *   Score 9 → 0.85, Score 7 → 0.95, Score 5 → 1.05
 * - NTEP 1-9 scores → multipliers: same formula
 * - Disease resistance: multiplier = 1.40 - (score × 0.06)
 *   Score 9 → 0.86, Score 7 → 0.98, Score 5 → 1.10
 * 
 * @author Gilba Solutions
 * @version 1.0.0
 * @source NTEP 2014/2020, BSPB 2025, NZ supplier data
 * ============================================================================
 */

(function(global) {
    'use strict';


    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Convert BSPB/NTEP 1-9 score to wear/quality multiplier
     * Higher score = better = lower multiplier (less penalty)
     */
    function scoreToMultiplier(score) {
        if (!score || score === '') return 1.0;
        return Math.round((1.30 - (parseFloat(score) * 0.05)) * 100) / 100;
    }

    /**
     * Convert BSPB/NTEP 1-9 score to disease risk multiplier
     * Higher score = more resistant = lower multiplier (less risk)
     */
    function diseaseScoreToMultiplier(score) {
        if (!score || score === '') return null;
        return Math.round((1.40 - (parseFloat(score) * 0.06)) * 100) / 100;
    }

    /**
     * Average two scores with optional weighting
     * Used when variety has both NTEP and BSPB data
     */
    function averageScores(ntepScore, bspbScore, ntepWeight = 0.5) {
        if (!ntepScore && !bspbScore) return null;
        if (!ntepScore) return bspbScore;
        if (!bspbScore) return ntepScore;
        return Math.round((ntepScore * ntepWeight + bspbScore * (1 - ntepWeight)) * 10) / 10;
    }

    // ========================================================================
    // NZ FINE FESCUE VARIETY DATABASE
    // ========================================================================

    const NZ_FINE_FESCUE_TRAITS = {

        // ====================================================================
        // CHEWINGS FESCUE (Festuca rubra subsp. commutata)
        // Bunch-type growth, no rhizomes, excellent for greens
        // Best close-mowing tolerance of fine fescues
        // ====================================================================

        chewingsFescue: {

            // ----------------------------------------------------------------
            // TIER 1: NTEP + BSPB DATA (Highest confidence)
            // ----------------------------------------------------------------

            'Compass II': {
                species: 'chewingsFescue',
                subspecies: 'Festuca rubra subsp. commutata',
                displayName: 'Compass II',
                region: 'NZ',
                dataTier: 1,
                nzAvailable: true,
                nzSupplier: 'Living Turf NZ',

                // NTEP 2014 Trial Data (Entry PPG-FRC 113)
                ntepData: {
                    trial: 'NTEP 2014 National Fineleaf Fescue Test',
                    entryId: 'PPG-FRC 113',
                    years: '2015-2019',
                    livingGroundCover: 90.2,  // % mean across 7 locations
                    summerPatchResistance: 6.7,
                    droughtTolerance: 5.3,
                    turfQualityUnderTraffic: 6.9,
                    turfQualityUnderShade: 7.0,
                    turfQualityFairwayHeight: 6.4
                },

                // NTEP 2020 Trial Data (Entry #29, Standard Entry)
                ntep2020Data: {
                    trial: 'NTEP 2020 National Fineleaf Fescue Test',
                    entryNo: 29,
                    status: 'Standard Entry',
                    years: '2021-2024'
                    // Data still accumulating - 2023 progress report available
                },

                // BSPB 2025 Data (Table L3 - Lawns, Table G2 - Greens)
                bspbData: {
                    source: 'BSPB Turfgrass Seed 2025',
                    tableL3: {  // Lawns, mown at 10-15mm
                        shootDensity: 7.2,
                        visualMerit: 7.4,
                        mean: 7.3,
                        redThreadResistance: 5.8,
                        winterGreenness: 5.4,
                        summerGreenness: 5.5
                    },
                    tableG2: {  // Greens, mown at 5mm
                        shootDensity: 7.4,
                        visualMerit: 7.2,
                        mean: 7.3,
                        redThreadResistance: 5.6,
                        winterGreenness: 6.1,
                        summerGreenness: 6.0
                    }
                },

                traits: {
                    // MOWING TOLERANCE
                    closeMowing: {
                        minimumHeight: 5,  // mm - greens capable
                        optimalHeight: { min: 5, max: 20 },
                        confidence: 'high',
                        source: 'BSPB 2025 Table G2 - Greens trial at 5mm'
                    },

                    // WEAR & RECOVERY
                    wear: {
                        multiplier: 0.93,  // Good for fine fescue
                        confidence: 'high',
                        source: 'NTEP 2014 traffic stress rating 6.9, BSPB mean 7.3',
                        notes: 'Above average wear tolerance for Chewings type'
                    },

                    // SHADE TOLERANCE
                    shade: {
                        multiplier: 0.90,  // Excellent
                        minimumDLI: 12,    // mol/m²/day - lower than bentgrass
                        confidence: 'high',
                        source: 'NTEP 2014 shade quality 7.0',
                        notes: 'Fine fescues are shade specialists'
                    },

                    // DROUGHT TOLERANCE
                    drought: {
                        multiplier: 1.05,  // Average for fine fescue
                        confidence: 'high',
                        source: 'NTEP 2014 drought tolerance 5.3',
                        notes: 'Chewings less drought tolerant than creeping reds'
                    },

                    // SALINITY TOLERANCE
                    salinity: {
                        multiplier: 1.0,   // Baseline
                        confidence: 'medium',
                        source: 'Species baseline - Chewings not salt-specialist',
                        notes: 'Use slender creeping red for coastal/saline sites'
                    },

                    // DISEASE RESISTANCE
                    disease: {
                        redThread: {
                            riskMultiplier: 1.05,  // Below average resistance
                            confidence: 'high',
                            source: 'BSPB 2025 rating 5.8, NTEP similar'
                        },
                        dollarSpot: {
                            riskMultiplier: 0.95,
                            confidence: 'medium',
                            source: 'NTEP 2014 - good relative to other fine fescues'
                        },
                        summerPatch: {
                            riskMultiplier: 0.88,
                            confidence: 'high',
                            source: 'NTEP 2014 rating 6.7 - excellent resistance'
                        },
                        microdochiumPatch: {
                            riskMultiplier: 1.0,
                            confidence: 'low',
                            source: 'Species baseline - no specific cultivar data'
                        },
                        leafSpot: {
                            riskMultiplier: 1.0,
                            confidence: 'low',
                            source: 'Species baseline'
                        }
                    },

                    // ESTABLISHMENT
                    establishment: {
                        germinationDays: { min: 10, max: 21 },
                        establishmentSpeed: 'slow',
                        seedingRate: { greens: 5, fairways: 4 },  // lbs/1000 sq ft
                        confidence: 'high',
                        source: 'NTEP establishment data, species standard',
                        notes: 'Turf quality slow to develop - 6-18 months to mature'
                    },

                    // COLOUR
                    colour: {
                        geneticColour: 'medium-dark green',
                        winterGreenness: 5.5,  // BSPB average
                        summerGreenness: 5.5,
                        confidence: 'high',
                        source: 'BSPB 2025'
                    }
                },

                notes: 'Tier 1 variety - full NTEP + BSPB data. Dark green colour, excellent density. Performs well at fairway height and under shade. Good summer patch resistance. Available in NZ from Living Turf.',
                recommendation: 'Recommended for NZ golf greens and fairways in temperate/cool regions'
            },

            'Brittany 2': {
                species: 'chewingsFescue',
                subspecies: 'Festuca rubra subsp. commutata',
                displayName: 'Brittany 2',
                region: 'NZ',
                dataTier: 1,
                nzAvailable: false,  // May need to import
                nzSupplier: null,

                ntepData: {
                    trial: 'NTEP 2020 National Fineleaf Fescue Test',
                    entryNo: 7,
                    status: 'Commercially Available',
                    sponsor: 'SiteOne Landscape Supply'
                },

                bspbData: {
                    source: 'BSPB Turfgrass Seed 2025',
                    tableL3: {
                        shootDensity: 7.3,
                        visualMerit: 7.1,
                        mean: 7.2,
                        redThreadResistance: 5.8,
                        winterGreenness: 5.4,
                        summerGreenness: 5.5
                    }
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 5,
                        optimalHeight: { min: 5, max: 20 },
                        confidence: 'high',
                        source: 'BSPB 2025 - Series G capable'
                    },
                    wear: {
                        multiplier: 0.94,
                        confidence: 'high',
                        source: 'BSPB 2025 mean 7.2'
                    },
                    shade: {
                        multiplier: 0.90,
                        minimumDLI: 12,
                        confidence: 'medium',
                        source: 'Species characteristic'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 1.05,
                            confidence: 'high',
                            source: 'BSPB 2025 rating 5.8'
                        }
                    }
                },

                notes: 'Tier 1 variety - NTEP + BSPB data. Not confirmed available in NZ - may require import.',
                recommendation: 'Good alternative if available'
            },

            // ----------------------------------------------------------------
            // TIER 2: SINGLE SOURCE DATA (Medium confidence)
            // ----------------------------------------------------------------

            'Radar II': {
                species: 'chewingsFescue',
                subspecies: 'Festuca rubra subsp. commutata',
                displayName: 'Radar II',
                region: 'NZ',
                dataTier: 2,
                nzAvailable: false,
                nzSupplier: null,

                ntepData: {
                    trial: 'NTEP 2020 National Fineleaf Fescue Test',
                    entryNo: 34,
                    entryId: 'PPG-FRC 127',
                    status: 'Commercially Available',
                    sponsor: 'Mountain View Seeds',
                    // From 2014 trial - top performer
                    livingGroundCover2014: 90.8,  // #1 in 2014 trial
                    crabgrassSuppression: 'Top performer'
                },

                bspbData: {
                    source: 'BSPB 2025 (as Radar)',
                    tableG2: {
                        shootDensity: 7.5,
                        visualMerit: 7.4,
                        mean: 7.5,
                        redThreadResistance: 7.2  // Good resistance
                    }
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 5,
                        optimalHeight: { min: 5, max: 20 },
                        confidence: 'high',
                        source: 'BSPB Table G2'
                    },
                    wear: {
                        multiplier: 0.91,
                        confidence: 'high',
                        source: 'NTEP 2014 #1 ground cover, BSPB mean 7.5'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 0.92,  // Good resistance
                            confidence: 'high',
                            source: 'BSPB 2025 rating 7.2'
                        }
                    }
                },

                notes: 'Tier 2 - excellent performer in NTEP trials. #1 ground cover in 2014 trial. Good red thread resistance. Not confirmed NZ availability.',
                recommendation: 'Top performer - source if possible'
            },

            'Jamestown VII': {
                species: 'chewingsFescue',
                subspecies: 'Festuca rubra subsp. commutata',
                displayName: 'Jamestown VII',
                region: 'NZ',
                dataTier: 2,
                nzAvailable: false,
                nzSupplier: null,

                ntepData: {
                    trial: 'NTEP 2020 National Fineleaf Fescue Test',
                    entryNo: 17,
                    status: 'Commercially Available',
                    sponsor: 'The Scotts Company'
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 5,
                        optimalHeight: { min: 5, max: 20 },
                        confidence: 'medium',
                        source: 'NTEP standard entry'
                    },
                    wear: {
                        multiplier: 0.95,
                        confidence: 'medium',
                        source: 'NTEP 2020 - data accumulating'
                    }
                },

                notes: 'Tier 2 - NTEP only. 7th generation Jamestown series. Limited NZ availability.',
                recommendation: 'Consider if available'
            },

            // ----------------------------------------------------------------
            // TIER 3: NZ SUPPLIER DATA ONLY (Lower confidence)
            // ----------------------------------------------------------------

            'Lygia': {
                species: 'chewingsFescue',
                subspecies: 'Festuca rubra subsp. commutata',
                displayName: 'Lygia',
                region: 'NZ',
                dataTier: 3,
                nzAvailable: true,
                nzSupplier: 'PGG Wrightson Turf',

                supplierData: {
                    source: 'PGG Wrightson Turf technical sheet',
                    claims: {
                        colour: 'Vibrant bright green',
                        density: 'Excellent',
                        leafFineness: 'Excellent',
                        winterActivity: 'Outstanding year-round growth',
                        redThreadResistance: 'High - scored highly against Laetisaria fuciformis',
                        overallQuality: 'Significantly higher than similar varieties'
                    }
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 5,
                        optimalHeight: { min: 5, max: 20 },
                        confidence: 'medium',
                        source: 'PGG Wrightson - Chewings type'
                    },
                    wear: {
                        multiplier: 0.95,
                        confidence: 'low',
                        source: 'Supplier claims - no independent trial data'
                    },
                    shade: {
                        multiplier: 0.90,
                        minimumDLI: 12,
                        confidence: 'medium',
                        source: 'Species characteristic'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 0.90,  // Supplier claims high resistance
                            confidence: 'low',
                            source: 'PGG Wrightson claims - unverified'
                        }
                    },
                    colour: {
                        geneticColour: 'bright green',
                        winterGreenness: 7.0,  // Estimated from claims
                        confidence: 'low',
                        source: 'Supplier claims'
                    }
                },

                notes: 'Tier 3 - NZ supplier data only. No NTEP or BSPB trial data found. Likely newer European variety (Barenbrug/DLF genetics). Claims good red thread resistance.',
                recommendation: 'Available in NZ - use with caution, verify performance locally'
            }
        },

        // ====================================================================
        // SLENDER CREEPING RED FESCUE (Festuca rubra subsp. litoralis)
        // Short rhizomes, salt tolerant, good for coastal courses
        // ====================================================================

        slenderCreepingRedFescue: {

            'Seamist': {
                species: 'slenderCreepingRedFescue',
                subspecies: 'Festuca rubra subsp. litoralis',
                displayName: 'Seamist',
                region: 'NZ',
                dataTier: 2,
                nzAvailable: true,
                nzSupplier: 'Living Turf NZ',

                ntepData: {
                    trial: 'NTEP 2014 National Fineleaf Fescue Test',
                    entryId: 'PPG-FRT 101',
                    years: '2015-2019',
                    livingGroundCover: 87.3,
                    salinityNote: 'Can germinate in water up to 40% as saline as seawater'
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 5,
                        optimalHeight: { min: 5, max: 25 },
                        confidence: 'high',
                        source: 'Slender creeping red tolerates close mowing'
                    },
                    wear: {
                        multiplier: 0.95,
                        confidence: 'medium',
                        source: 'NTEP 2014 - good wear tolerance noted'
                    },
                    shade: {
                        multiplier: 0.88,
                        minimumDLI: 10,
                        confidence: 'medium',
                        source: 'Species excellent shade tolerance'
                    },
                    salinity: {
                        multiplier: 0.70,  // Excellent salt tolerance
                        ecThreshold: 8.0,  // dS/m - much higher than other fine fescues
                        confidence: 'high',
                        source: 'NTEP, species characteristic - "littoralis" = seashore',
                        notes: 'Ideal for coastal courses, effluent irrigation'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 1.05,
                            confidence: 'medium',
                            source: 'Species generally moderate red thread resistance'
                        }
                    },
                    establishment: {
                        germinationDays: { min: 10, max: 18 },
                        establishmentSpeed: 'moderate',
                        seedlingVigor: 'excellent',
                        confidence: 'high',
                        source: 'NTEP - noted excellent seedling vigor'
                    }
                },

                notes: 'Tier 2 - NTEP data. Salt tolerance specialist - can handle up to 40% seawater salinity during germination. Ideal for NZ coastal links courses. Available from Living Turf.',
                recommendation: 'First choice for coastal/saline NZ sites'
            },

            'Sybille': {
                species: 'slenderCreepingRedFescue',
                subspecies: 'Festuca rubra subsp. litoralis',
                displayName: 'Sybille',
                region: 'NZ',
                dataTier: 2,
                nzAvailable: false,
                nzSupplier: null,

                bspbData: {
                    source: 'BSPB Turfgrass Seed 2025',
                    tableL4: {
                        shootDensity: 8.0,
                        visualMerit: 7.6,
                        mean: 7.8,
                        redThreadResistance: 8.2,  // Excellent
                        winterGreenness: 5.3,
                        summerGreenness: 7.2
                    },
                    tableG3: {
                        shootDensity: 8.4,
                        visualMerit: 8.3,
                        mean: 8.4,  // #1 in G3 table
                        redThreadResistance: 7.6,
                        winterGreenness: 4.7,
                        summerGreenness: 6.3
                    }
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 5,
                        optimalHeight: { min: 5, max: 25 },
                        confidence: 'high',
                        source: 'BSPB Table G3 - #1 rated for greens'
                    },
                    wear: {
                        multiplier: 0.86,  // Excellent
                        confidence: 'high',
                        source: 'BSPB 2025 - #1 in G3 mean 8.4'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 0.85,  // Very good resistance
                            confidence: 'high',
                            source: 'BSPB 2025 rating 7.6-8.2'
                        }
                    },
                    salinity: {
                        multiplier: 0.75,
                        ecThreshold: 6.0,
                        confidence: 'medium',
                        source: 'Species characteristic'
                    }
                },

                notes: 'Tier 2 - BSPB data. #1 rated slender creeping red in BSPB G3 (greens). Excellent red thread resistance. Not confirmed NZ availability.',
                recommendation: 'Top performer - import if possible'
            },

            'Barnoustie': {
                species: 'slenderCreepingRedFescue',
                subspecies: 'Festuca rubra subsp. litoralis',
                displayName: 'Barnoustie',
                region: 'NZ',
                dataTier: 2,
                nzAvailable: false,
                nzSupplier: null,

                bspbData: {
                    source: 'BSPB Turfgrass Seed 2025',
                    tableL4: {
                        shootDensity: 7.9,
                        visualMerit: 8.1,
                        mean: 8.0,
                        redThreadResistance: 7.7,
                        winterGreenness: 5.8,
                        summerGreenness: 5.8
                    },
                    tableG3: {
                        shootDensity: 8.2,
                        visualMerit: 8.4,
                        mean: 8.3,  // #2 in G3
                        redThreadResistance: 7.3
                    }
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 5,
                        optimalHeight: { min: 5, max: 25 },
                        confidence: 'high',
                        source: 'BSPB Table G3'
                    },
                    wear: {
                        multiplier: 0.87,
                        confidence: 'high',
                        source: 'BSPB 2025 - #2 in G3 mean 8.3'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 0.88,
                            confidence: 'high',
                            source: 'BSPB 2025 rating 7.3-7.7'
                        }
                    }
                },

                notes: 'Tier 2 - BSPB data. #2 rated in BSPB G3 (greens). Named after Carnoustie Golf Links. Good red thread resistance.',
                recommendation: 'Excellent option for links-style greens'
            }
        },

        // ====================================================================
        // STRONG CREEPING RED FESCUE (Festuca rubra subsp. rubra)
        // Long vigorous rhizomes, NOT suitable for greens, fairway+ only
        // ====================================================================

        strongCreepingRedFescue: {

            'Cardinal II': {
                species: 'strongCreepingRedFescue',
                subspecies: 'Festuca rubra subsp. rubra',
                displayName: 'Cardinal II',
                region: 'NZ',
                dataTier: 2,
                nzAvailable: true,
                nzSupplier: 'Living Turf NZ',

                ntepData: {
                    trial: 'NTEP 2014 National Fineleaf Fescue Test',
                    entryId: 'PPG-FRR 111',
                    years: '2015-2019',
                    livingGroundCover: 88.2,
                    notes: 'Top performer among strong creeping reds'
                },

                ntep2020Data: {
                    trial: 'NTEP 2020 National Fineleaf Fescue Test',
                    entryNo: 31,
                    status: 'Standard Entry'
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 12,  // NOT greens capable
                        optimalHeight: { min: 15, max: 75 },
                        confidence: 'high',
                        source: 'Strong creeping reds do not tolerate close mowing',
                        notes: 'Use for fairways and roughs ONLY, not greens'
                    },
                    wear: {
                        multiplier: 0.92,
                        confidence: 'high',
                        source: 'NTEP 2014 - top strong creeping red performer'
                    },
                    shade: {
                        multiplier: 0.88,
                        minimumDLI: 10,
                        confidence: 'medium',
                        source: 'Species characteristic'
                    },
                    recovery: {
                        multiplier: 0.85,  // Excellent recovery via rhizomes
                        confidence: 'high',
                        source: 'Species characteristic - vigorous rhizomes'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 1.15,  // Higher susceptibility
                            confidence: 'high',
                            source: 'Strong creeping reds generally more susceptible'
                        },
                        dollarSpot: {
                            riskMultiplier: 1.10,
                            confidence: 'medium',
                            source: 'Species susceptibility noted'
                        }
                    }
                },

                notes: 'Tier 2 - NTEP data. Top strong creeping red performer. Available from Living Turf. NOT for greens - minimum HOC 12mm. Excellent for fairway/rough due to recovery.',
                recommendation: 'Recommended for NZ fairways and roughs'
            },

            'Navigator III': {
                species: 'strongCreepingRedFescue',
                subspecies: 'Festuca rubra subsp. rubra',
                displayName: 'Navigator III',
                region: 'NZ',
                dataTier: 2,
                nzAvailable: false,
                nzSupplier: null,

                ntepData: {
                    trial: 'NTEP 2020 National Fineleaf Fescue Test',
                    entryNo: 37,
                    entryId: 'PPG-FRR 127',
                    status: 'Commercially Available',
                    sponsor: 'Mountain View Seeds'
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 12,
                        optimalHeight: { min: 15, max: 75 },
                        confidence: 'medium',
                        source: 'Species characteristic'
                    },
                    wear: {
                        multiplier: 0.93,
                        confidence: 'medium',
                        source: 'NTEP 2020 - data accumulating'
                    },
                    recovery: {
                        multiplier: 0.85,
                        confidence: 'medium',
                        source: 'Species characteristic'
                    }
                },

                notes: 'Tier 2 - NTEP data. 3rd generation Navigator. Strong creeping type for fairways/roughs. Not confirmed NZ availability.',
                recommendation: 'Consider for fairways if available'
            },

            'Governors': {
                species: 'strongCreepingRedFescue',
                subspecies: 'Festuca rubra subsp. rubra',
                displayName: 'Governors',
                region: 'NZ',
                dataTier: 3,
                nzAvailable: true,
                nzSupplier: 'PGG Wrightson Turf',

                supplierData: {
                    source: 'PGG Wrightson Turf technical sheet',
                    breeding: 'NZ genetic material - bred in New Zealand',
                    claims: {
                        winterActivity: 'Outstanding - retains green colour over winter when others go dormant',
                        colour: 'Medium-textured, mid-green',
                        use: 'Golf course roughs, mowing height above 50mm'
                    }
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 50,  // Rough use only
                        optimalHeight: { min: 50, max: 100 },
                        confidence: 'high',
                        source: 'PGG Wrightson - "mowing height above 50mm"'
                    },
                    wear: {
                        multiplier: 1.00,
                        confidence: 'low',
                        source: 'No trial data - species baseline'
                    },
                    winterColour: {
                        rating: 'excellent',
                        confidence: 'medium',
                        source: 'PGG Wrightson - key selling point',
                        notes: 'Selected for NZ conditions - maintains winter green'
                    }
                },

                notes: 'Tier 3 - NZ supplier data only. NZ-bred variety. Roughs use only (50mm+). Winter colour specialist. Not for greens or fairways.',
                recommendation: 'Use for NZ golf roughs where winter colour important'
            },

            'Boreal': {
                species: 'strongCreepingRedFescue',
                subspecies: 'Festuca rubra subsp. rubra',
                displayName: 'Boreal',
                region: 'NZ',
                dataTier: 1,
                nzAvailable: false,
                nzSupplier: null,

                ntepData: {
                    trial: 'NTEP 2020 National Fineleaf Fescue Test',
                    entryNo: 27,
                    status: 'Standard Entry'
                },

                bspbData: {
                    source: 'BSPB Turfgrass Seed 2025',
                    tableL5: {
                        shootDensity: 3.2,
                        visualMerit: 3.5,
                        mean: 3.3,  // Very poor
                        redThreadResistance: 3.9
                    }
                },

                traits: {
                    closeMowing: {
                        minimumHeight: 25,
                        optimalHeight: { min: 25, max: 100 },
                        confidence: 'high',
                        source: 'BSPB - poor turf quality'
                    },
                    wear: {
                        multiplier: 1.20,  // Poor
                        confidence: 'high',
                        source: 'BSPB 2025 mean 3.3'
                    },
                    disease: {
                        redThread: {
                            riskMultiplier: 1.25,
                            confidence: 'high',
                            source: 'BSPB 2025 rating 3.9'
                        }
                    }
                },

                notes: 'Tier 1 - both NTEP + BSPB confirm poor performance. Common type grown in Canada. NOT RECOMMENDED for quality turf.',
                recommendation: 'NOT RECOMMENDED - low quality, poor disease resistance'
            }
        }
    };

    // ========================================================================
    // SPECIES CHARACTERISTICS (Defaults when variety-specific data unavailable)
    // ========================================================================

    const FINE_FESCUE_SPECIES_DEFAULTS = {

        chewingsFescue: {
            scientificName: 'Festuca rubra subsp. commutata',
            growthHabit: 'bunch-type',
            rhizomes: false,
            minimumMowingHeight: 5,  // mm
            optimalMowingHeight: { min: 10, max: 25 },
            greensCapable: true,
            fairwaysCapable: true,
            roughsCapable: true,
            shadeToleranceRank: 2,  // 1=best, 5=worst among fine fescues
            droughtToleranceRank: 4,
            saltToleranceRank: 4,
            wearToleranceRank: 3,
            redThreadSusceptibility: 'moderate',
            thatchPotential: 'high',
            establishmentSpeed: 'slow',
            winterColourRetention: 'moderate',
            germinationDays: { min: 10, max: 21 }
        },

        slenderCreepingRedFescue: {
            scientificName: 'Festuca rubra subsp. litoralis',
            growthHabit: 'creeping - short rhizomes',
            rhizomes: true,
            rhizomeVigor: 'moderate',
            minimumMowingHeight: 5,
            optimalMowingHeight: { min: 10, max: 30 },
            greensCapable: true,
            fairwaysCapable: true,
            roughsCapable: true,
            shadeToleranceRank: 2,
            droughtToleranceRank: 2,
            saltToleranceRank: 1,  // Best - "littoralis" = seashore
            wearToleranceRank: 3,
            redThreadSusceptibility: 'moderate-high',
            thatchPotential: 'moderate',
            establishmentSpeed: 'moderate',
            winterColourRetention: 'good',
            germinationDays: { min: 10, max: 18 }
        },

        strongCreepingRedFescue: {
            scientificName: 'Festuca rubra subsp. rubra',
            growthHabit: 'creeping - long vigorous rhizomes',
            rhizomes: true,
            rhizomeVigor: 'high',
            minimumMowingHeight: 12,  // NOT greens capable
            optimalMowingHeight: { min: 20, max: 75 },
            greensCapable: false,  // Critical distinction
            fairwaysCapable: true,
            roughsCapable: true,
            shadeToleranceRank: 3,
            droughtToleranceRank: 3,
            saltToleranceRank: 3,
            wearToleranceRank: 2,
            redThreadSusceptibility: 'high',
            thatchPotential: 'moderate',
            establishmentSpeed: 'moderate',
            winterColourRetention: 'moderate',
            germinationDays: { min: 10, max: 15 },
            recoveryAbility: 'excellent'  // Key advantage
        }
    };

    // ========================================================================
    // NZ FINE FESCUE DISEASE MODIFIERS
    // For integration with disease engine
    // ========================================================================

    const NZ_FINE_FESCUE_DISEASE_MODIFIERS = {

        // Red thread - major disease for fine fescues in NZ
        redThread: {
            speciesBaseline: {
                chewingsFescue: 1.10,
                slenderCreepingRedFescue: 1.15,
                strongCreepingRedFescue: 1.25
            },
            notes: 'Fine fescues generally susceptible. Red thread pressure high in NZ maritime climate.',
            seasonalPeak: ['May', 'June', 'September', 'October'],
            riskFactors: ['low nitrogen', 'cool wet conditions', 'slow growth']
        },

        // Dollar spot
        dollarSpot: {
            speciesBaseline: {
                chewingsFescue: 1.05,
                slenderCreepingRedFescue: 1.10,
                strongCreepingRedFescue: 1.15
            },
            notes: 'Moderate susceptibility. Strong creeping reds most affected.'
        },

        // Microdochium patch (Fusarium)
        microdochiumPatch: {
            speciesBaseline: {
                chewingsFescue: 1.00,
                slenderCreepingRedFescue: 1.00,
                strongCreepingRedFescue: 1.00
            },
            notes: 'Species-level data limited. Use cultivar-specific data where available.'
        },

        // Leaf spot (Bipolaris/Drechslera)
        leafSpot: {
            speciesBaseline: {
                chewingsFescue: 1.15,
                slenderCreepingRedFescue: 1.10,
                strongCreepingRedFescue: 1.20
            },
            notes: 'Fine fescues particularly susceptible. Worse in shade.'
        }
    };

    // ========================================================================
    // API FUNCTIONS
    // ========================================================================

    /**
     * Get all NZ fine fescue varieties
     */
    function getNZFineFescueVarieties() {
        const varieties = [];

        // Chewings
        Object.keys(NZ_FINE_FESCUE_TRAITS.chewingsFescue || {}).forEach(name => {
            const v = NZ_FINE_FESCUE_TRAITS.chewingsFescue[name];
            varieties.push({
                name: name,
                displayName: v.displayName || name,
                species: 'chewingsFescue',
                speciesDisplay: 'Chewings Fescue',
                dataTier: v.dataTier,
                nzAvailable: v.nzAvailable,
                nzSupplier: v.nzSupplier,
                greensCapable: true
            });
        });

        // Slender creeping red
        Object.keys(NZ_FINE_FESCUE_TRAITS.slenderCreepingRedFescue || {}).forEach(name => {
            const v = NZ_FINE_FESCUE_TRAITS.slenderCreepingRedFescue[name];
            varieties.push({
                name: name,
                displayName: v.displayName || name,
                species: 'slenderCreepingRedFescue',
                speciesDisplay: 'Slender Creeping Red Fescue',
                dataTier: v.dataTier,
                nzAvailable: v.nzAvailable,
                nzSupplier: v.nzSupplier,
                greensCapable: true
            });
        });

        // Strong creeping red
        Object.keys(NZ_FINE_FESCUE_TRAITS.strongCreepingRedFescue || {}).forEach(name => {
            const v = NZ_FINE_FESCUE_TRAITS.strongCreepingRedFescue[name];
            varieties.push({
                name: name,
                displayName: v.displayName || name,
                species: 'strongCreepingRedFescue',
                speciesDisplay: 'Strong Creeping Red Fescue',
                dataTier: v.dataTier,
                nzAvailable: v.nzAvailable,
                nzSupplier: v.nzSupplier,
                greensCapable: false  // Key distinction
            });
        });

        return varieties;
    }

    /**
     * Get varieties suitable for greens (Chewings + Slender only)
     */
    function getNZFineFescueGreensVarieties() {
        return getNZFineFescueVarieties().filter(v => v.greensCapable);
    }

    /**
     * Get NZ-available varieties only
     */
    function getNZAvailableFineFescueVarieties() {
        return getNZFineFescueVarieties().filter(v => v.nzAvailable);
    }

    /**
     * Get variety trait data
     */
    function getNZFineFescueTraits(species, varietyName) {
        const speciesData = NZ_FINE_FESCUE_TRAITS[species];
        if (!speciesData) return null;
        return speciesData[varietyName] || null;
    }

    /**
     * Get species defaults
     */
    function getFineFescueSpeciesDefaults(species) {
        return FINE_FESCUE_SPECIES_DEFAULTS[species] || null;
    }

    /**
     * Get disease modifier for variety
     */
    function getNZFineFescueDiseaseModifier(species, varietyName, disease) {
        // First check variety-specific data
        const variety = getNZFineFescueTraits(species, varietyName);
        if (variety?.traits?.disease?.[disease]?.riskMultiplier) {
            return {
                multiplier: variety.traits.disease[disease].riskMultiplier,
                confidence: variety.traits.disease[disease].confidence || 'medium',
                source: variety.traits.disease[disease].source || 'Variety data'
            };
        }

        // Fall back to species baseline
        const diseaseData = NZ_FINE_FESCUE_DISEASE_MODIFIERS[disease];
        if (diseaseData?.speciesBaseline?.[species]) {
            return {
                multiplier: diseaseData.speciesBaseline[species],
                confidence: 'low',
                source: 'Species baseline'
            };
        }

        return { multiplier: 1.0, confidence: 'none', source: 'No data' };
    }

    /**
     * Check if variety is greens-capable
     */
    function isGreensCapable(species, varietyName) {
        const defaults = FINE_FESCUE_SPECIES_DEFAULTS[species];
        if (!defaults) return false;

        // Species-level check first
        if (!defaults.greensCapable) return false;

        // Variety-level override if exists
        const variety = getNZFineFescueTraits(species, varietyName);
        if (variety?.traits?.closeMowing?.minimumHeight) {
            return variety.traits.closeMowing.minimumHeight <= 6;
        }

        return defaults.greensCapable;
    }

    // ========================================================================
    // EXPORT TO GLOBAL SCOPE
    // ========================================================================

    global.NZ_FINE_FESCUE_TRAITS = NZ_FINE_FESCUE_TRAITS;
    global.FINE_FESCUE_SPECIES_DEFAULTS = FINE_FESCUE_SPECIES_DEFAULTS;
    global.NZ_FINE_FESCUE_DISEASE_MODIFIERS = NZ_FINE_FESCUE_DISEASE_MODIFIERS;

    // API functions
    global.gaip_getNZFineFescueVarieties = getNZFineFescueVarieties;
    global.gaip_getNZFineFescueGreensVarieties = getNZFineFescueGreensVarieties;
    global.gaip_getNZAvailableFineFescueVarieties = getNZAvailableFineFescueVarieties;
    global.gaip_getNZFineFescueTraits = getNZFineFescueTraits;
    global.gaip_getFineFescueSpeciesDefaults = getFineFescueSpeciesDefaults;
    global.gaip_getNZFineFescueDiseaseModifier = getNZFineFescueDiseaseModifier;
    global.gaip_isFineFescueGreensCapable = isGreensCapable;


})(typeof window !== 'undefined' ? window : this);
